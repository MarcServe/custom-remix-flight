import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.78.0';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

if (!LOVABLE_API_KEY) {
  console.error('LOVABLE_API_KEY environment variable is not set');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recipientName, recipientEmail, companyId, contactId, context } = await req.json();
    
    console.log('Generating email with AI:', { recipientName, companyId, contactId });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get user's business profile
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization required');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Invalid authorization');
    }

    const { data: businessProfile } = await supabase
      .from('business_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!businessProfile) {
      throw new Error('Please complete your business profile first to use AI email generation');
    }

    // Get company and contact details
    let companyData = null;
    let contactData = null;

    if (companyId) {
      const { data: company } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .single();
      companyData = company;
    }

    if (contactId) {
      const { data: contact } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', contactId)
        .single();
      contactData = contact;
    }

    // Build AI prompt
    const prompt = buildEmailPrompt(businessProfile, companyData, contactData, recipientName, context);

    if (!LOVABLE_API_KEY) {
      throw new Error('AI email generation not configured. Please enable Lovable AI in project settings.');
    }

    console.log('Calling AI to generate email...');

    // Call Lovable AI
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert B2B sales email writer. Create personalized, value-driven emails that convert prospects into clients. Always be professional, concise, and focus on the prospect\'s needs.' 
          },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', errorText);
      throw new Error('Failed to generate email with AI');
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices[0].message.content;
    
    let emailContent;
    try {
      emailContent = JSON.parse(content);
    } catch (e) {
      console.error('Failed to parse AI response:', content);
      throw new Error('AI returned invalid response');
    }

    console.log('Email generated successfully');

    return new Response(
      JSON.stringify({
        subject: emailContent.subject,
        body: emailContent.body,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error generating email:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function buildEmailPrompt(
  businessProfile: any,
  company: any,
  contact: any,
  recipientName: string,
  context?: string
): string {
  const businessContext = `
YOUR BUSINESS:
- Company: ${businessProfile.company_name}
- Industry: ${businessProfile.industry}
- Services/Products: ${businessProfile.services_description}
${businessProfile.target_audience ? `- Target Audience: ${businessProfile.target_audience}` : ''}
${businessProfile.value_proposition ? `- Value Proposition: ${businessProfile.value_proposition}` : ''}
`;

  const prospectContext = company ? `
PROSPECT COMPANY:
- Name: ${company.name}
- Industry: ${company.industry || 'Unknown'}
- Size: ${company.size || 'Unknown'}
- Location: ${company.geography || 'Unknown'}
${company.description ? `- Description: ${company.description}` : ''}
${company.recent_news ? `- Recent News: ${company.recent_news}` : ''}
${company.tech_stack?.length ? `- Tech Stack: ${company.tech_stack.join(', ')}` : ''}
${company.ceo_name ? `- CEO: ${company.ceo_name}` : ''}
${company.funding_stage ? `- Funding: ${company.funding_stage}` : ''}
` : '';

  const contactContext = contact ? `
RECIPIENT:
- Name: ${recipientName}
- Title: ${contact.title || 'Contact'}
${contact.department ? `- Department: ${contact.department}` : ''}
` : `
RECIPIENT:
- Name: ${recipientName}
`;

  const additionalContext = context ? `
ADDITIONAL CONTEXT FROM SENDER:
${context}
` : '';

  return `${businessContext}
${prospectContext}
${contactContext}
${additionalContext}

TASK:
Write a personalized cold outreach email from YOUR business to the recipient. 

REQUIREMENTS:
1. Subject line should be personalized and compelling (max 60 characters)
2. Email body should:
   - Start with a personalized greeting using their name
   - Reference something specific about their company (if available) to show you've done research
   - Clearly explain how YOUR services/products can help THEIR business
   - Include a clear, low-friction call-to-action
   - Be concise (100-150 words maximum)
   - Use ${businessProfile.tone_preference || 'professional'} tone
3. Focus on THEIR needs and how YOU can help solve their problems
4. Make it conversational and human, not salesy

Return ONLY a JSON object with this structure (no markdown):
{
  "subject": "personalized subject line",
  "body": "complete email body with proper formatting"
}`;
}
