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
  // Trim whitespace and remove any non-ASCII characters
  const cleaned = key.trim().replace(/[^\x00-\x7F]/g, '');
  return cleaned.length > 10 ? cleaned : null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    
    const rawKey = Deno.env.get('OPENAI_API_KEY');
    const OPENAI_API_KEY = cleanApiKey(rawKey);
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured or invalid. Please add it in Supabase Edge Function Secrets.');
    }

    // Initialize Supabase client with service role for profile fetching
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization')!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const isCronWithUserId = requestBody.triggeredByCron === true &&
      authHeader === `Bearer ${supabaseServiceKey}` &&
      typeof requestBody.user_id === 'string';

    let user: { id: string; email?: string } | null = null;

    if (isCronWithUserId) {
      const { data } = await supabaseAdmin.auth.admin.getUserById(requestBody.user_id);
      user = data?.user ?? null;
      if (!user) throw new Error('Cron: user_id not found');
      console.log('Cron mode: acting as user ID:', user.id);
    } else {
      const supabaseAnon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } }
      });
      const { data: { user: authUser }, error: userError } = await supabaseAnon.auth.getUser();
      if (userError || !authUser) {
        console.error('Auth error:', userError);
        throw new Error('User not authenticated');
      }
      user = authUser;
      console.log('Authenticated user ID:', user.id);
    }

    // Fetch user profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('full_name, email, job_title, phone, website')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
    }
    console.log('Fetched profile data:', JSON.stringify(profile));

    // Fetch business profile
    const { data: businessProfile, error: businessError } = await supabaseAdmin
      .from('business_profiles')
      .select('company_name, website, phone')
      .eq('user_id', user.id)
      .single();

    if (businessError) {
      console.error('Error fetching business profile:', businessError);
    }
    console.log('Fetched business profile data:', JSON.stringify(businessProfile));

    // Extract sender information with fallbacks
    const senderName = profile?.full_name || 'Your Name';
    const senderEmail = profile?.email || user.email || '';
    const senderTitle = profile?.job_title || '';
    const senderCompany = businessProfile?.company_name || '';
    const senderPhone = profile?.phone || businessProfile?.phone || '';
    const senderWebsite = profile?.website || businessProfile?.website || '';

    // Build email signature exactly as shown in profile preview
    const emailSignature = `Best regards,
${senderName}
${senderTitle}
${senderCompany}${senderEmail ? '\n' + senderEmail : ''}${senderPhone ? '\n' + senderPhone : ''}${senderWebsite ? '\n' + senderWebsite : ''}`;

    console.log('Using sender info:', { senderName, senderTitle, senderCompany, senderEmail, senderPhone, senderWebsite, emailSignature });

    let systemPrompt: string;
    let userPrompt: string;

    // Check if this is a newsletter generation request
    if (requestBody.context === 'newsletter' && requestBody.prompt) {
      console.log('Processing newsletter generation');
      const templateStyle = typeof requestBody.templateStyle === 'string' ? requestBody.templateStyle.toLowerCase().trim() : '';
      const styleHints: Record<string, string> = {
        professional: 'Use a balanced, trustworthy tone. Clear section headings and concise paragraphs.',
        minimal: 'Keep it sparse: at most 2 sections with <h2>, short paragraphs, minimal lists. No filler.',
        modern: 'Use a confident, contemporary voice. Include one tight bullet list and a clear takeaway.',
        creative: 'Be vivid and distinctive; varied sentence length; one memorable metaphor or example is welcome.',
        corporate: 'Formal, precise language; emphasize reliability and outcomes; suitable for B2B readers.',
        bold: 'Strong opinions welcome; short punchy sentences; a clear call-to-action style closing section.',
        elegant: 'Polished, refined wording; slightly more formal; smooth transitions between sections.',
      };
      const styleExtra = templateStyle && styleHints[templateStyle] ? `\nVisual/voice target for this edition (${templateStyle}): ${styleHints[templateStyle]}` : '';

      systemPrompt = `You are an expert newsletter copywriter. Write engaging, well-structured marketing newsletter content in HTML. 
Use semantic HTML tags: <h2> for section headings, <p> for paragraphs, <strong> for emphasis, <ul>/<li> for lists.
Structure the newsletter with 2-4 clearly separated sections, each with its own <h2> heading (unless the design brief asks for fewer).
Between sections, insert a placeholder comment <!-- IMAGE_PLACEHOLDER --> so the user knows where to add images.
Do NOT include a subject line, greeting, or email signature — just the newsletter body content.
Make the content informative, valuable, and action-oriented.
Each edition should feel fresh: vary opening hook, section titles, and examples from one day to the next.${styleExtra}`;

      userPrompt = requestBody.prompt;

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
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI API error:', response.status, errorText);
        if (response.status === 429) throw new Error('Rate limit exceeded. Please try again later.');
        if (response.status === 401 || response.status === 402) throw new Error('OpenAI API key invalid or billing issue.');
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      let htmlContent = data.choices?.[0]?.message?.content || '';

      // Strip markdown code fences if the model wrapped it
      if (htmlContent.includes('```html')) {
        htmlContent = htmlContent.split('```html')[1].split('```')[0].trim();
      } else if (htmlContent.includes('```')) {
        htmlContent = htmlContent.split('```')[1].split('```')[0].trim();
      }

      // Replace image placeholder comments with visible drop-zone divs
      htmlContent = htmlContent.replace(
        /<!--\s*IMAGE_PLACEHOLDER\s*-->/g,
        '<div class="newsletter-image-slot" style="border:2px dashed #cbd5e1;border-radius:8px;padding:24px;text-align:center;margin:16px 0;color:#94a3b8;font-size:14px;">📷 Click "Insert Image" below to add an image here</div>'
      );

      console.log('Newsletter generated, length:', htmlContent.length);

      return new Response(JSON.stringify({ generatedEmail: htmlContent }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Campaign TEMPLATE generation: one email sent to many recipients, with merge tokens.
    if (requestBody.context === 'campaign' && requestBody.prompt) {
      const sys = `You are an expert outreach/campaign copywriter. Write ONE short email (about 90-140 words) that will be sent to MANY recipients.
Personalize with these EXACT merge tokens where natural: {{firstName}} and {{company}}. Never invent other tokens or use real names.
Tone: warm, human, concise, non-salesy, with ONE clear call to action. Plain text with line breaks — no HTML, no markdown.
Do NOT include a signature or sign-off name; the system appends the sender's signature automatically.
Return ONLY JSON: {"subject":"...","body":"..."}`;
      const usr = `Sender/business: ${senderCompany || 'a business'}${senderTitle ? ', ' + senderTitle : ''}.
Campaign brief: ${requestBody.prompt}
${requestBody.audience ? 'Target audience: ' + requestBody.audience : ''}
Write the subject and body now.`;
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'system', content: sys }, { role: 'user', content: usr }],
          temperature: 0.7, max_tokens: 700, response_format: { type: 'json_object' },
        }),
      });
      if (!response.ok) {
        const t = await response.text();
        if (response.status === 429) throw new Error('Rate limit exceeded. Please try again later.');
        if (response.status === 401 || response.status === 402) throw new Error('OpenAI API key invalid or billing issue.');
        throw new Error(`OpenAI API error: ${response.status} ${t}`);
      }
      const data = await response.json();
      let parsed: { subject?: string; body?: string } = {};
      try { parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}'); } catch { parsed = {}; }
      return new Response(JSON.stringify({ subject: parsed.subject || '', body: parsed.body || '' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if this is an invoice/quotation request (has 'type' field)
    if (requestBody.type) {
      const { context, type } = requestBody;
      console.log('Processing invoice/quotation email:', type);
      
      // Create prompt based on invoice/quotation type
      systemPrompt = type === 'invoice' 
        ? `You are a professional business communication assistant. Generate a polite and professional email to accompany an invoice. The email should be concise, friendly, and include all relevant details. ALWAYS use the actual sender information provided - NEVER use placeholders.`
        : `You are a professional business communication assistant. Generate a polite and professional email to accompany a quotation. The email should be persuasive, highlight value, and encourage a response. ALWAYS use the actual sender information provided - NEVER use placeholders.`;

      userPrompt = type === 'invoice'
        ? `Generate a professional email to send with invoice ${context.invoiceNumber} to ${context.companyName}.

SENDER SIGNATURE (USE EXACTLY AS SHOWN):
${emailSignature}

INVOICE DETAILS:
Amount: $${context.amount}
Due Date: ${context.dueDate}
Items: ${context.lineItems}

The email should:
- Thank them for their business
- Clearly state the invoice details
- Include payment instructions
- Provide contact information for questions
- Be warm and professional

CRITICAL: Use the EXACT signature provided above. Do not modify it or add placeholders.

Return the response as JSON with 'subject' and 'body' fields.`
        : `Generate a professional quotation email for quote ${context.invoiceNumber} to ${context.companyName}.

SENDER SIGNATURE (USE EXACTLY AS SHOWN):
${emailSignature}

QUOTATION DETAILS:
Amount: $${context.amount}
Valid Until: ${context.dueDate}
Services: ${context.lineItems}

The email should:
- Introduce the quotation
- Highlight the value proposition
- Create urgency (valid until date)
- Encourage them to accept or discuss
- Include a clear call to action
- Be persuasive yet professional

CRITICAL: Use the EXACT signature provided above. Do not modify it or add placeholders.

Return the response as JSON with 'subject' and 'body' fields.`;
    } else {
      // This is a personal/sales email request
      const { recipientName, companyName, companyData, context, persona } = requestBody;
      console.log('Processing personal email for:', recipientName, 'with persona:', persona?.product_focus);
      
      // Build company context from companyData if provided
      let companyContext = '';
      if (companyData) {
        const contextParts: string[] = [];
        if (companyData.description) contextParts.push(`Description: ${companyData.description}`);
        if (companyData.industry) contextParts.push(`Industry: ${companyData.industry}`);
        const enrichmentData = companyData.enrichment_data || {};
        if (enrichmentData.products || companyData.products) {
          const products = enrichmentData.products || companyData.products;
          contextParts.push(`Products/Services: ${Array.isArray(products) ? products.join(', ') : products}`);
        }
        if (companyData.recent_news || enrichmentData.recentNews) {
          contextParts.push(`Recent News: ${companyData.recent_news || enrichmentData.recentNews}`);
        }
        if (companyData.funding_stage || enrichmentData.fundingInfo) {
          contextParts.push(`Funding: ${companyData.funding_stage || enrichmentData.fundingInfo}`);
        }
        if (companyData.employee_count || enrichmentData.employeeCount) {
          contextParts.push(`Company Size: ${companyData.employee_count || enrichmentData.employeeCount} employees`);
        }
        if (companyData.tech_stack && Array.isArray(companyData.tech_stack) && companyData.tech_stack.length > 0) {
          contextParts.push(`Technologies: ${companyData.tech_stack.join(', ')}`);
        }
        companyContext = contextParts.length > 0 ? `\nCOMPANY INFORMATION:\n${contextParts.join('\n')}\n` : '';
      }
      
      // Build persona-specific instructions if provided
      let personaInstructions = '';
      if (persona) {
        personaInstructions = `
MARKETING PERSONA CONTEXT:
${persona.product_focus ? `- Product/Service: ${persona.product_focus}` : ''}
${persona.value_proposition ? `- Value Proposition: ${persona.value_proposition}` : ''}
${persona.talking_points?.length ? `- Key Talking Points: ${persona.talking_points.join(', ')}` : ''}
${persona.call_to_action ? `- Call to Action: ${persona.call_to_action}` : ''}
${persona.email_tone ? `- Tone: Write in a ${persona.email_tone} tone` : ''}

Use this marketing context to craft the email. Focus on the product/service mentioned and highlight the value proposition. Naturally incorporate the key talking points. End with the specified call to action instead of a generic request.
`;
      }

      systemPrompt = `You are an expert sales email writer. Write complete, ready-to-send emails with REAL CONTENT ONLY. NEVER use brackets, placeholders, or instructions in the output. Replace any missing information with professional, general language.`;

      userPrompt = `Write a complete professional outreach email to ${recipientName}${companyName ? ` at ${companyName}` : ''}.

You are: ${senderName}${senderTitle ? `, ${senderTitle}` : ''}${senderCompany ? ` from ${senderCompany}` : ''}

${companyContext}${personaInstructions}${context ? `ADDITIONAL CONTEXT: ${context}\n` : ''}

STRICT RULES - NO EXCEPTIONS:
1. NEVER write [brackets] or (placeholders) anywhere in the email
2. If company name is missing, use general terms like "your team" or "your organization"
3. Write ACTUAL content, not instructions like "mention their work" - just write the actual content
${persona?.product_focus ? `4. Focus on ${persona.product_focus} and its benefits` : '4. Make the email about AI solutions that streamline sales processes and increase efficiency'}
${persona?.talking_points?.length ? `5. Naturally incorporate these points: ${persona.talking_points.join(', ')}` : '5. Be specific about benefits: lead qualification, automated outreach, CRM integration'}
${persona?.call_to_action ? `6. End with this call to action: ${persona.call_to_action}` : '6. End with: "Would you be open to a brief 15-minute call next week to discuss this further?"'}
7. Close with this EXACT signature:

${persona?.email_signature_override || emailSignature}

FORBIDDEN PATTERNS (never use these):
- [Your Company Name]
- [Sales Director Company]
- [mention something specific]
- (e.g., your team's recent success)
- any text in brackets or parentheses with instructions

Return as JSON: {"subject": "${persona?.product_focus ? `Regarding ${persona.product_focus.slice(0, 30)}` : 'Streamlining Sales with AI'}", "body": "actual email content here"}`;
    }

    console.log('Calling OpenAI API...');

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
        tools: [
          {
            type: 'function',
            function: {
              name: 'format_email',
              description: 'Format the email with subject and body',
              parameters: {
                type: 'object',
                properties: {
                  subject: {
                    type: 'string',
                    description: 'The email subject line'
                  },
                  body: {
                    type: 'string',
                    description: 'The complete email body text'
                  }
                },
                required: ['subject', 'body'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'format_email' } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      if (response.status === 401 || response.status === 402) {
        throw new Error('OpenAI API key invalid or billing issue.');
      }
      
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('AI response:', JSON.stringify(data, null, 2));
    
    let result;
    
    // Extract from tool call if available
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        result = JSON.parse(toolCall.function.arguments);
        console.log('Parsed from tool call:', result);
      } catch (e) {
        console.error('Failed to parse tool call arguments:', e);
      }
    }
    
    // Fallback to content parsing if tool call failed
    if (!result) {
      const content = data.choices[0].message.content;
      console.log('Raw content:', content);
      
      try {
        // Try to extract JSON from markdown code blocks
        let jsonStr = content;
        
        // Remove ```json and ``` markers
        if (jsonStr.includes('```json')) {
          jsonStr = jsonStr.split('```json')[1].split('```')[0].trim();
        } else if (jsonStr.includes('```')) {
          jsonStr = jsonStr.split('```')[1].split('```')[0].trim();
        }
        
        result = JSON.parse(jsonStr);
        console.log('Parsed from content:', result);
      } catch (e) {
        console.error('Failed to parse content as JSON:', e);
        
        // Last resort: create structured response from plain text
        const fallbackSubject = requestBody.type 
          ? `${requestBody.type === 'invoice' ? 'Invoice' : 'Quotation'} - ${requestBody.context?.companyName || 'Business Communication'}`
          : `Message to ${requestBody.recipientName || 'Contact'}`;
        
        result = {
          subject: fallbackSubject,
          body: content
        };
        console.log('Using fallback structure:', result);
      }
    }
    
    // Validate result has required fields
    if (!result.subject || !result.body) {
      throw new Error('AI response missing required fields (subject or body)');
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error generating email:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to generate email' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
