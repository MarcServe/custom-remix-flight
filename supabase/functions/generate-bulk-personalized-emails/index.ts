import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Clean and validate API key - removes any non-ASCII characters
 */
function cleanApiKey(key: string | undefined): string | null {
  if (!key) return null;
  const cleaned = key.trim().replace(/[^\x00-\x7F]/g, '');
  return cleaned.length > 10 ? cleaned : null;
}

/**
 * Build company context string from company data
 */
function buildCompanyContext(companyData: any): string {
  if (!companyData) return '';

  const contextParts: string[] = [];

  if (companyData.name) {
    contextParts.push(`Company: ${companyData.name}`);
  }

  if (companyData.description) {
    contextParts.push(`Description: ${companyData.description}`);
  }

  if (companyData.industry) {
    contextParts.push(`Industry: ${companyData.industry}`);
  }

  const enrichmentData = companyData.enrichment_data || {};
  
  if (enrichmentData.products || companyData.products) {
    const products = enrichmentData.products || companyData.products;
    contextParts.push(`Products/Services: ${Array.isArray(products) ? products.join(', ') : products}`);
  }

  if (companyData.recent_news || enrichmentData.recentNews) {
    contextParts.push(`Recent News: ${companyData.recent_news || enrichmentData.recentNews}`);
  }

  if (companyData.funding_stage || enrichmentData.fundingInfo) {
    const funding = companyData.funding_stage || enrichmentData.fundingInfo;
    if (companyData.funding_total) {
      contextParts.push(`Funding: ${funding} (${companyData.funding_total})`);
    } else {
      contextParts.push(`Funding: ${funding}`);
    }
  }

  if (companyData.employee_count || enrichmentData.employeeCount) {
    contextParts.push(`Company Size: ${companyData.employee_count || enrichmentData.employeeCount} employees`);
  }

  if (companyData.tech_stack && Array.isArray(companyData.tech_stack) && companyData.tech_stack.length > 0) {
    contextParts.push(`Technologies: ${companyData.tech_stack.join(', ')}`);
  } else if (enrichmentData.technologies) {
    const techs = Array.isArray(enrichmentData.technologies) 
      ? enrichmentData.technologies.join(', ')
      : enrichmentData.technologies;
    contextParts.push(`Technologies: ${techs}`);
  }

  if (companyData.key_executives && Array.isArray(companyData.key_executives) && companyData.key_executives.length > 0) {
    const executives = companyData.key_executives
      .slice(0, 3)
      .map((exec: any) => `${exec.name} (${exec.title})`)
      .join(', ');
    contextParts.push(`Key Executives: ${executives}`);
  }

  if (companyData.website) {
    contextParts.push(`Website: ${companyData.website}`);
  }

  return contextParts.join('\n');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    const { recipients, context, persona } = requestBody;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      throw new Error('Recipients array is required');
    }

    if (recipients.length > 100) {
      throw new Error('Maximum 100 recipients allowed per batch');
    }

    const rawKey = Deno.env.get('OPENAI_API_KEY');
    const OPENAI_API_KEY = cleanApiKey(rawKey);
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured or invalid. Please add it in Supabase Edge Function Secrets.');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization')!;
    
    const supabaseAnon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabaseAnon.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch user profile and business profile
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('full_name, email, job_title, phone, website')
      .eq('id', user.id)
      .single();

    const { data: businessProfile } = await supabaseAdmin
      .from('business_profiles')
      .select('company_name, website, phone')
      .eq('user_id', user.id)
      .single();

    const senderName = profile?.full_name || 'Your Name';
    const senderEmail = profile?.email || user.email || '';
    const senderTitle = profile?.job_title || '';
    const senderCompany = businessProfile?.company_name || '';
    const senderPhone = profile?.phone || businessProfile?.phone || '';
    const senderWebsite = profile?.website || businessProfile?.website || '';

    const emailSignature = `Best regards,
${senderName}
${senderTitle}
${senderCompany}${senderEmail ? '\n' + senderEmail : ''}${senderPhone ? '\n' + senderPhone : ''}${senderWebsite ? '\n' + senderWebsite : ''}`;

    // Build persona instructions
    let personaInstructions = '';
    if (persona) {
      personaInstructions = `
PERSONA CONTEXT:
- Product Focus: ${persona.product_focus || 'AI-powered sales solutions'}
- Value Proposition: ${persona.value_proposition || 'Streamline sales processes and increase efficiency'}
- Email Tone: ${persona.email_tone || 'Professional and friendly'}
- Talking Points: ${persona.talking_points?.join(', ') || 'Lead qualification, automated outreach, CRM integration'}
- Call to Action: ${persona.call_to_action || 'Would you be open to a brief 15-minute call next week to discuss this further?'}
`;
    }

    // Generate emails for each recipient
    const generatedEmails = [];

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];
      const recipientName = `${recipient.firstName} ${recipient.lastName}`.trim();
      const companyName = recipient.companyData?.name || '';
      const companyContext = buildCompanyContext(recipient.companyData);
      
      // Include tags in context for better personalization
      const recipientTags = recipient.tags || [];
      const companyTags = recipient.companyData?.tags || [];
      const allTags = [...recipientTags, ...companyTags];
      const tagsContext = allTags.length > 0 
        ? `\nTags/Categories: ${allTags.join(', ')}` 
        : '';

      try {
        const systemPrompt = `You are an expert sales email writer. Write complete, ready-to-send emails with REAL CONTENT ONLY. NEVER use brackets, placeholders, or instructions in the output. Replace any missing information with professional, general language.`;

        const userPrompt = `Write a complete professional outreach email to ${recipientName}${companyName ? ` at ${companyName}` : ''}.

You are: ${senderName}${senderTitle ? `, ${senderTitle}` : ''}${senderCompany ? ` from ${senderCompany}` : ''}

${companyContext ? `COMPANY INFORMATION:
${companyContext}${tagsContext}

` : tagsContext ? `TAGS/CATEGORIES:${tagsContext}

` : ''}${personaInstructions}${context ? `ADDITIONAL CONTEXT: ${context}\n` : ''}

STRICT RULES - NO EXCEPTIONS:
1. NEVER write [brackets] or (placeholders) anywhere in the email
2. If company name is missing, use general terms like "your team" or "your organization"
3. Write ACTUAL content, not instructions like "mention their work" - just write the actual content
4. Reference specific company information when available (industry, products, recent news, funding, etc.)
5. Make the email highly personalized based on the company information provided
${persona?.product_focus ? `6. Focus on ${persona.product_focus} and its benefits` : '6. Make the email about AI solutions that streamline sales processes and increase efficiency'}
${persona?.talking_points?.length ? `7. Naturally incorporate these points: ${persona.talking_points.join(', ')}` : '7. Be specific about benefits: lead qualification, automated outreach, CRM integration'}
${persona?.call_to_action ? `8. End with this call to action: ${persona.call_to_action}` : '8. End with: "Would you be open to a brief 15-minute call next week to discuss this further?"'}
9. Close with this EXACT signature:

${persona?.email_signature_override || emailSignature}

FORBIDDEN PATTERNS (never use these):
- [Your Company Name]
- [Sales Director Company]
- [mention something specific]
- (e.g., your team's recent success)
- any text in brackets or parentheses with instructions

Return as JSON: {"subject": "personalized subject line", "body": "actual email content here"}`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            temperature: 0.7,
            max_tokens: 1500,
          }),
        });

        if (!response.ok) {
          const errorData = await response.text();
          console.error(`OpenAI API error for recipient ${i + 1}:`, errorData);
          throw new Error(`Failed to generate email for ${recipientName}: ${response.statusText}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
          throw new Error(`No content returned for ${recipientName}`);
        }

        // Parse JSON response
        let emailData;
        try {
          // Remove markdown code blocks if present
          const cleanedContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          emailData = JSON.parse(cleanedContent);
        } catch (parseError) {
          console.error('Failed to parse JSON, using raw content:', content);
          // Fallback: use raw content as body
          emailData = {
            subject: `Quick question for ${recipient.firstName}`,
            body: content
          };
        }

        generatedEmails.push({
          personId: recipient.personId,
          subject: emailData.subject || `Quick question for ${recipient.firstName}`,
          body: emailData.body || emailData.content || '',
          bodyHtml: emailData.bodyHtml || `<p>${(emailData.body || emailData.content || '').replace(/\n/g, '</p><p>')}</p>`,
          bodyText: emailData.body || emailData.content || emailData.bodyText || '',
        });

        // Add a small delay to avoid rate limiting (50ms between requests)
        if (i < recipients.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      } catch (error: any) {
        console.error(`Error generating email for ${recipientName}:`, error);
        // Continue with other recipients even if one fails
        generatedEmails.push({
          personId: recipient.personId,
          subject: `Quick question for ${recipient.firstName}`,
          body: `Hi ${recipient.firstName},\n\nI wanted to reach out regarding ${companyName || 'your company'}.\n\n[Email generation failed: ${error.message}]`,
          bodyHtml: `<p>Hi ${recipient.firstName},</p><p>I wanted to reach out regarding ${companyName || 'your company'}.</p><p>[Email generation failed: ${error.message}]</p>`,
          bodyText: `Hi ${recipient.firstName},\n\nI wanted to reach out regarding ${companyName || 'your company'}.\n\n[Email generation failed: ${error.message}]`,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        count: generatedEmails.length,
        emails: generatedEmails,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error in generate-bulk-personalized-emails:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to generate personalized emails',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
