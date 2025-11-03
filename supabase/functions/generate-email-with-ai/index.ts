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

    // Initialize Supabase client to fetch user profile
    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get user profile data
    const { data: { user } } = await supabase.auth.getUser();
    let userProfile = null;
    let businessProfile = null;

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email, phone')
        .eq('id', user.id)
        .maybeSingle();
      
      const { data: business } = await supabase
        .from('business_profiles')
        .select('company_name, website, phone')
        .eq('user_id', user.id)
        .maybeSingle();

      userProfile = profile;
      businessProfile = business;
      console.log('Fetched user profile:', userProfile);
      console.log('Fetched business profile:', businessProfile);
    }

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
      
      systemPrompt = `You are a professional business communication assistant. Generate persuasive and warm sales/outreach emails that feel personal and authentic. Keep emails concise, engaging, and action-oriented.`;

      // Build sender information for the prompt
      const senderName = userProfile?.full_name || '[Your Name]';
      const senderEmail = userProfile?.email || '';
      const senderCompany = businessProfile?.company_name || '[Your Company Name]';
      const senderWebsite = businessProfile?.website || '[Your Website]';
      const senderPhone = businessProfile?.phone || userProfile?.phone || '[Your Phone Number]';

      userPrompt = `Generate a professional business outreach email to ${recipientName}${companyName ? ` at ${companyName}` : ''}.

${context ? `Additional context: ${context}\n` : ''}
Email is from: ${senderName} (${senderEmail}) at ${senderCompany}
Company website: ${senderWebsite}
Phone: ${senderPhone}

The email should:
- Start with a warm, personalized greeting
- Be concise and respectful of their time
- Clearly communicate value proposition
- Include a clear call-to-action
- Feel authentic and not overly salesy
- Be professional yet approachable
- End with: "Best regards,\n${senderName}\n${senderCompany}\n${senderPhone}${senderWebsite !== '[Your Website]' ? `\n${senderWebsite}` : ''}"

IMPORTANT: Use the actual sender details provided above. Do NOT use placeholders like [Your Name] or [Your Company Name].

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
