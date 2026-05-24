import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Clean API key - removes any non-ASCII characters that cause ByteString errors
 */
function cleanApiKey(key: string | undefined): string | null {
  if (!key) return null;
  return key.trim().replace(/[^\x00-\x7F]/g, '');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { companyIds, maxOpportunities = 10 } = await req.json();

    // Fetch business profile
    const { data: businessProfile } = await supabaseClient
      .from('business_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!businessProfile) {
      throw new Error('Business profile not found. Please complete your profile first.');
    }

    // Fetch companies
    let companiesQuery = supabaseClient
      .from('companies')
      .select('*')
      .eq('user_id', user.id);

    if (companyIds && companyIds.length > 0) {
      companiesQuery = companiesQuery.in('id', companyIds);
    }

    const { data: companies, error: companiesError } = await companiesQuery.limit(50);

    if (companiesError || !companies || companies.length === 0) {
      throw new Error('No companies found to analyze');
    }

    // Build AI prompt
    const prompt = `You are a strategic sales AI assistant. Analyze these companies and identify sales opportunities based on our business profile.

Business Profile:
- Company: ${businessProfile.company_name || 'N/A'}
- Industry: ${businessProfile.industry || 'N/A'}
- Services: ${businessProfile.services_description}
- Target Audience: ${businessProfile.target_audience || 'N/A'}
- Value Proposition: ${businessProfile.value_proposition || 'N/A'}

Companies to Analyze:
${companies.map((c, i) => `
${i + 1}. ${c.name} [ID: ${c.id}]
   - Industry: ${c.industry || 'Unknown'}
   - Description: ${c.description || 'No description'}
   - Size: ${c.size || 'Unknown'}
   - Geography: ${c.geography || 'Unknown'}
   - Employee Count: ${c.employee_count || 'Unknown'}
   - Tech Stack: ${c.tech_stack?.join(', ') || 'Unknown'}
   - Recent News: ${c.recent_news || 'None'}
`).join('\n')}

For each company, identify the TOP sales opportunity that aligns with our business profile. Return a maximum of ${maxOpportunities} opportunities.

For each opportunity, provide:
1. Company name and ID (MUST use the exact UUID shown in brackets [ID: xxx])
2. Opportunity title (specific, actionable)
3. Opportunity description (why this is a good fit, 2-3 sentences)
4. Estimated value range (low, medium, high)
5. Urgency level (low, medium, high)
6. Email subject line (compelling, personalized)
7. Email body (professional, personalized, under 200 words, with clear CTA)
8. Key talking points (3-5 bullet points)

CRITICAL: The companyId MUST be the exact UUID shown in brackets [ID: xxx] for each company above.

Return ONLY valid JSON in this exact format:
{
  "opportunities": [
    {
      "companyId": "exact-uuid-from-brackets",
      "companyName": "Company Name",
      "title": "Opportunity title",
      "description": "Why this is a good fit",
      "estimatedValue": "medium",
      "urgency": "high",
      "emailSubject": "Subject line",
      "emailBody": "Email body text",
      "talkingPoints": ["point 1", "point 2", "point 3"]
    }
  ]
}`;

    // Call OpenAI with cleaned API key
    const rawKey = Deno.env.get('OPENAI_API_KEY');
    const OPENAI_API_KEY = cleanApiKey(rawKey);
    if (!OPENAI_API_KEY || !OPENAI_API_KEY.startsWith('sk-')) {
      throw new Error('OPENAI_API_KEY not configured or invalid. Please add it in Supabase Edge Function Secrets.');
    }

    console.log('Calling OpenAI to find deal opportunities...');

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a strategic B2B sales AI assistant. Generate structured, actionable sales opportunities in valid JSON format only. Be specific and data-driven. You MUST use the exact company UUIDs provided in the prompt.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('OpenAI API error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      if (aiResponse.status === 401 || aiResponse.status === 402) {
        throw new Error('OpenAI API key invalid or billing issue.');
      }
      
      throw new Error(`OpenAI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content;

    if (!aiContent) {
      throw new Error('No content in AI response');
    }

    // Parse JSON from AI response
    let opportunitiesData;
    try {
      const jsonMatch = aiContent.match(/```json\s*([\s\S]*?)\s*```/) || 
                       aiContent.match(/```\s*([\s\S]*?)\s*```/) ||
                       [null, aiContent];
      opportunitiesData = JSON.parse(jsonMatch[1].trim());
    } catch (parseError) {
      console.error('Failed to parse AI response:', aiContent);
      throw new Error('Invalid JSON in AI response');
    }

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    // filter to valid UUIDs only before DB query
    const validIds = (opportunitiesData.opportunities || [])
      .map((o: any) => o.companyId)
      .filter((id: any) => typeof id === 'string' && UUID_REGEX.test(id));

    const filteredOpportunities = (opportunitiesData.opportunities || []).filter(
      (o: any) => typeof o.companyId === 'string' && UUID_REGEX.test(o.companyId)
    );

    return new Response(
      JSON.stringify({
        success: true,
        opportunities: filteredOpportunities,
        analyzedCompanies: companies.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
