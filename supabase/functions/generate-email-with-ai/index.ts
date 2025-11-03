import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Initialize Supabase client with service role for profile fetching
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization')!;
    
    // Use anon key client for auth
    const supabaseAnon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get authenticated user
    const { data: { user }, error: userError } = await supabaseAnon.auth.getUser();
    if (userError || !user) {
      console.error('Auth error:', userError);
      throw new Error('User not authenticated');
    }

    console.log('Authenticated user ID:', user.id);

    // Use service role client to fetch profile data (bypasses RLS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

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
      const { recipientName, companyName, context } = requestBody;
      console.log('Processing personal email for:', recipientName);
      
      systemPrompt = `You are an expert sales email writer. Write complete, ready-to-send emails with REAL CONTENT ONLY. NEVER use brackets, placeholders, or instructions in the output. Replace any missing information with professional, general language.`;

      userPrompt = `Write a complete professional outreach email to ${recipientName}${companyName ? ` at ${companyName}` : ''}.

You are: ${senderName}${senderTitle ? `, ${senderTitle}` : ''}${senderCompany ? ` from ${senderCompany}` : ''}

${context ? `CONTEXT: ${context}\n` : ''}

STRICT RULES - NO EXCEPTIONS:
1. NEVER write [brackets] or (placeholders) anywhere in the email
2. If company name is missing, use general terms like "your team" or "your organization"
3. Write ACTUAL content, not instructions like "mention their work" - just write the actual content
4. Make the email about AI solutions that streamline sales processes and increase efficiency
5. Be specific about benefits: lead qualification, automated outreach, CRM integration
6. End with: "Would you be open to a brief 15-minute call next week to discuss this further?"
7. Close with this EXACT signature:

${emailSignature}

FORBIDDEN PATTERNS (never use these):
- [Your Company Name]
- [Sales Director Company]
- [mention something specific]
- (e.g., your team's recent success)
- any text in brackets or parentheses with instructions

Return as JSON: {"subject": "Streamlining Sales with AI", "body": "actual email content here"}`;
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    let result;
    try {
      result = JSON.parse(content);
    } catch (e) {
      // If parsing fails, create a structured response from the text
      const fallbackSubject = requestBody.type 
        ? `${requestBody.type === 'invoice' ? 'Invoice' : 'Quotation'} - ${requestBody.context?.companyName || 'Business Communication'}`
        : `Message to ${requestBody.recipientName || 'Contact'}`;
      
      result = {
        subject: fallbackSubject,
        body: content
      };
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
