import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.78.0';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;

interface PersonalizeRequest {
  sequenceId: string;
  companyId: string;
  contactId?: string;
  tone?: 'professional' | 'casual' | 'technical';
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { sequenceId, companyId, contactId, tone = 'professional' }: PersonalizeRequest = await req.json();

    console.log('Personalizing sequence:', { sequenceId, companyId, contactId, tone });

    // Fetch sequence template
    const { data: sequence, error: seqError } = await supabase
      .from('email_sequences')
      .select('*')
      .eq('id', sequenceId)
      .single();

    if (seqError || !sequence) {
      throw new Error(`Sequence not found: ${seqError?.message}`);
    }

    console.log(`Found sequence: ${sequence.name} with ${sequence.steps?.length || 0} steps`);

    // Fetch company data with enrichment
    const { data: company, error: compError } = await supabase
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single();

    if (compError || !company) {
      throw new Error(`Company not found: ${compError?.message}`);
    }

    console.log(`Found company: ${company.name}`);

    // Fetch contacts
    let contacts = [];
    if (contactId) {
      const { data: contact } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', contactId)
        .single();
      if (contact) contacts = [contact];
    } else {
      const { data: allContacts } = await supabase
        .from('contacts')
        .select('*')
        .eq('company_id', companyId)
        .order('is_primary_contact', { ascending: false })
        .limit(1);
      contacts = allContacts || [];
    }

    const primaryContact = contacts[0] || {
      name: 'Hiring Manager',
      title: 'Decision Maker',
      email: company.website ? `contact@${company.website.replace(/^https?:\/\/(www\.)?/, '')}` : null,
    };

    console.log(`Using contact: ${primaryContact.name} (${primaryContact.title})`);

    // Fetch user's business profile for context
    const authHeader = req.headers.get('Authorization');
    let businessProfile = null;
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      
      if (!userError && user) {
        const { data: profile } = await supabase
          .from('business_profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();
        
        businessProfile = profile;
        console.log('Business profile loaded:', businessProfile ? 'Yes' : 'No');
      }
    }

    // Personalize each email step using AI
    const personalizedEmails = [];
    const steps = sequence.steps || [];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      console.log(`Personalizing step ${i + 1}/${steps.length}`);

      const personalizationPrompt = buildPersonalizationPrompt(
        company,
        primaryContact,
        step,
        tone,
        businessProfile
      );

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
            { role: 'system', content: 'You are an expert at personalizing cold outreach emails for B2B sales. You create highly relevant, researched emails that reference real company context.' },
            { role: 'user', content: personalizationPrompt }
          ],
          response_format: { type: 'json_object' },
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        throw new Error(`AI personalization failed: ${errorText}`);
      }

      const aiData = await aiResponse.json();
      const content = aiData.choices[0].message.content;
      
      let personalized;
      try {
        personalized = JSON.parse(content);
      } catch (e) {
        console.error('Failed to parse AI response:', content);
        throw new Error('AI returned invalid JSON');
      }

      personalizedEmails.push({
        stepNumber: i + 1,
        subject: personalized.subject,
        body: personalized.body,
        personalizedHooks: personalized.personalizedHooks || [],
        delayDays: step.delayDays || 0,
        originalSubject: step.subject,
      });

      console.log(`Step ${i + 1} personalized: ${personalized.subject}`);
    }

    // Save to company_sequences table
    const { data: companySequence, error: saveError } = await supabase
      .from('company_sequences')
      .upsert({
        company_id: companyId,
        sequence_id: sequenceId,
        personalized_emails: personalizedEmails,
        status: 'draft',
        current_step: 0,
        auto_respond_enabled: sequence.auto_respond || false,
        metadata: {
          contact_id: primaryContact.id || null,
          contact_name: primaryContact.name,
          tone,
          personalized_at: new Date().toISOString(),
        },
      }, {
        onConflict: 'company_id,sequence_id',
      })
      .select()
      .single();

    if (saveError) {
      throw new Error(`Failed to save personalized sequence: ${saveError.message}`);
    }

    console.log('Personalized sequence saved successfully');

    return new Response(
      JSON.stringify({
        success: true,
        companySequenceId: companySequence.id,
        companyName: company.name,
        sequenceName: sequence.name,
        personalizedEmails,
        contact: {
          name: primaryContact.name,
          title: primaryContact.title,
          email: primaryContact.email,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Personalization error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function buildPersonalizationPrompt(
  company: any,
  contact: any,
  step: any,
  tone: string,
  businessProfile: any = null
): string {
  const businessContext = businessProfile ? `
YOUR BUSINESS CONTEXT:
- Company: ${businessProfile.company_name || 'Your Company'}
- Industry: ${businessProfile.industry || 'Your Industry'}
- Services/Products: ${businessProfile.services_description}
${businessProfile.target_audience ? `- Target Audience: ${businessProfile.target_audience}` : ''}
${businessProfile.value_proposition ? `- Value Proposition: ${businessProfile.value_proposition}` : ''}
` : '';

  const companyContext = `
PROSPECT COMPANY CONTEXT:
- Name: ${company.name}
- Industry: ${company.industry || 'Unknown'}
- Size: ${company.size || 'Unknown'} employees
- Location: ${company.geography || 'Unknown'}
- Website: ${company.website || 'Unknown'}
${company.description ? `- Description: ${company.description}` : ''}
${company.recent_news ? `- Recent News: ${company.recent_news}` : ''}
${company.tech_stack?.length ? `- Tech Stack: ${company.tech_stack.join(', ')}` : ''}
${company.ceo_name ? `- CEO: ${company.ceo_name}` : ''}
${company.funding_stage ? `- Funding Stage: ${company.funding_stage}` : ''}
${company.funding_total ? `- Total Funding: ${company.funding_total}` : ''}
${company.enrichment_data?.products ? `- Products/Services: ${company.enrichment_data.products}` : ''}
`.trim();

  const contactContext = `
RECIPIENT:
- Name: ${contact.name}
- Title: ${contact.title || 'Not specified'}
${contact.department ? `- Department: ${contact.department}` : ''}
${contact.linkedin_url ? `- LinkedIn: ${contact.linkedin_url}` : ''}
`.trim();

  const templateContext = `
TEMPLATE EMAIL:
Subject: ${step.subject}

Body:
${step.body}
`.trim();

  return `${businessContext}
${companyContext}

${contactContext}

${templateContext}

INSTRUCTIONS:
1. Personalize the subject line to reference ${company.name} specifically
2. Replace all placeholder variables:
   - {{company_name}} → ${company.name}
   - {{first_name}} → ${contact.name.split(' ')[0]}
   - {{contact_name}} → ${contact.name}
   - {{title}} → ${contact.title || 'team member'}
3. Add 1-2 sentences that show how YOUR services/products (from business context) can specifically help ${company.name} based on their situation
4. Reference real prospect company context (products, news, funding, tech stack) to show you've done research
5. Keep the core message structure but make it feel researched and relevant
6. Maintain ${tone} tone throughout
7. Keep it concise (under 150 words for the body)
8. Make it feel personal, not generic - connect YOUR value proposition to THEIR specific needs
9. Use the prospect company's actual situation to create urgency or relevance

Return ONLY a JSON object with this exact structure (no markdown, no extra text):
{
  "subject": "personalized subject line",
  "body": "personalized email body with proper formatting",
  "personalizedHooks": ["specific thing mentioned about the company", "another personalized element"]
}`;
}
