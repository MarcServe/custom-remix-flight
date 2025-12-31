import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    const { companyIds } = await req.json();
    
    if (!companyIds || companyIds.length === 0) {
      throw new Error('No company IDs provided');
    }

    // Fetch companies to analyze
    const { data: companies, error: companiesError } = await supabaseClient
      .from('companies')
      .select('*')
      .in('id', companyIds)
      .eq('user_id', user.id);

    if (companiesError) throw companiesError;
    if (!companies || companies.length === 0) {
      throw new Error('No companies found');
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured. Please add it in Supabase Edge Function Secrets.');
    }

    // Prepare company data for AI analysis
    const companyData = companies.map(c => ({
      id: c.id,
      name: c.name,
      industry: c.industry,
      size: c.size,
      geography: c.geography,
      description: c.description,
      website: c.website,
      employee_count: c.employee_count,
      funding_stage: c.funding_stage,
      recent_news: c.recent_news,
      status: c.status,
      enrichment_data: c.enrichment_data,
    }));

    const systemPrompt = `You are a sales intelligence AI that categorizes prospects and suggests next actions.

Analyze each company and assign a temperature (hot/warm/cold) based on:
- HOT: Strong buying signals, recent activity, good fit, urgent need
- WARM: Good potential, needs nurturing, moderate fit
- COLD: Low priority, poor fit, or no recent engagement

Also suggest 2-3 specific next actions to move each prospect forward.

Return JSON array with this structure:
[{
  "companyId": "uuid",
  "temperature": "hot" | "warm" | "cold",
  "reasoning": "Brief explanation of categorization",
  "suggestedActions": [
    { "action": "Specific action", "priority": "high|medium|low", "reason": "Why this action" }
  ]
}]`;

    const prompt = `Analyze these companies and categorize them:\n\n${JSON.stringify(companyData, null, 2)}`;

    console.log('Calling OpenAI to analyze prospects...');

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
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
      
      throw new Error('Failed to analyze prospects');
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices[0].message.content;
    
    let analysis;
    try {
      const parsed = JSON.parse(content);
      // Handle both direct array and wrapped object responses
      analysis = Array.isArray(parsed) ? parsed : (parsed.companies || parsed.analysis || []);
    } catch (e) {
      console.error('Failed to parse AI response:', content);
      throw new Error('Invalid AI response format');
    }

    // Update companies with analysis results
    const updates = [];
    for (const result of analysis) {
      const updatePromise = supabaseClient
        .from('companies')
        .update({
          temperature: result.temperature,
          suggested_actions: result.suggestedActions || [],
          last_analyzed_at: new Date().toISOString(),
        })
        .eq('id', result.companyId)
        .eq('user_id', user.id);
      
      updates.push(updatePromise);
    }

    await Promise.all(updates);

    return new Response(
      JSON.stringify({ 
        success: true,
        analyzed: analysis.length,
        results: analysis 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-prospects:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to analyze prospects' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
