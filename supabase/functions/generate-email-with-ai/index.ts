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

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    // Fetch user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email, job_title, phone')
      .eq('id', user.id)
      .single();

    // Fetch business profile
    const { data: businessProfile } = await supabase
      .from('business_profiles')
      .select('company_name, website, phone')
      .eq('user_id', user.id)
      .single();

    console.log('User profile:', profile);
    console.log('Business profile:', businessProfile);

    // Extract sender information
    const senderName = profile?.full_name || 'Professional';
    const senderEmail = profile?.email || user.email || '';
    const senderTitle = profile?.job_title || '';
    const senderCompany = businessProfile?.company_name || '';

    let systemPrompt: string;
    let userPrompt: string;

    // Check if this is an invoice/quotation request (has 'type' field)
    if (requestBody.type) {
      const { context, type } = requestBody;
      console.log('Processing invoice/quotation email:', type);
      
      // Create prompt based on invoice/quotation type
      systemPrompt = type === 'invoice' 
        ? `You are a professional business communication assistant. Generate a polite and professional email to accompany an invoice. The email should be concise, friendly, and include all relevant details.`
        : `You are a professional business communication assistant. Generate a polite and professional email to accompany a quotation. The email should be persuasive, highlight value, and encourage a response.`;

      userPrompt = type === 'invoice'
        ? `Generate a professional email to send with invoice ${context.invoiceNumber} to ${context.companyName}.
Amount: $${context.amount}
Due Date: ${context.dueDate}
Items: ${context.lineItems}

The email should:
- Thank them for their business
- Clearly state the invoice details
- Include payment instructions
- Provide contact information for questions
- Be warm and professional

Return the response as JSON with 'subject' and 'body' fields.`
        : `Generate a professional quotation email for quote ${context.invoiceNumber} to ${context.companyName}.
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

Return the response as JSON with 'subject' and 'body' fields.`;
    } else {
      // This is a personal/sales email request
      const { recipientName, companyName, context } = requestBody;
      console.log('Processing personal email for:', recipientName);
      
      systemPrompt = `You are a professional business communication assistant. Generate persuasive and warm sales/outreach emails that feel personal and authentic. Keep emails concise, engaging, and action-oriented. ALWAYS use the actual sender information provided - NEVER use placeholders.`;

      userPrompt = `Generate a professional business outreach email with these details:

SENDER INFORMATION (USE THESE EXACT VALUES):
- Sender Name: ${senderName}
- Sender Title: ${senderTitle}
- Sender Company: ${senderCompany}
- Sender Email: ${senderEmail}

RECIPIENT INFORMATION:
- Recipient Name: ${recipientName}
${companyName ? `- Recipient Company: ${companyName}` : ''}

${context ? `ADDITIONAL CONTEXT:\n${context}` : ''}

CRITICAL INSTRUCTIONS:
- Use the ACTUAL sender name "${senderName}" in the signature
- Use the ACTUAL company name "${senderCompany}" in the email
- Use the ACTUAL job title "${senderTitle}" in the signature
- DO NOT use placeholders like [Your Name] or [Your Company]
- DO NOT use generic terms - use the specific information provided above
- Make the email personal and authentic
- Keep it concise and respectful of their time
- Include a clear call-to-action
- Use a professional yet approachable tone

SIGNATURE FORMAT:
Best regards,
${senderName}
${senderTitle}
${senderCompany}

Return the response as JSON with 'subject' and 'body' fields.`;
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
