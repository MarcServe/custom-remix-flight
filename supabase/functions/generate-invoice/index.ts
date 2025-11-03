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

    const { companyId, dealId, type, context } = await req.json();

    // Fetch company and deal data
    let companyData = null;
    let dealData = null;

    if (companyId) {
      const { data: company } = await supabaseClient
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .single();
      companyData = company;
    }

    if (dealId) {
      const { data: deal } = await supabaseClient
        .from('deals')
        .select('*')
        .eq('id', dealId)
        .single();
      dealData = deal;
    }

    // Fetch business profile for company details
    const { data: businessProfile } = await supabaseClient
      .from('business_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // Build AI prompt
    const prompt = `Generate a professional ${type === 'quotation' ? 'quotation' : 'invoice'} based on the following information:

Company Details:
${companyData ? `
- Name: ${companyData.name}
- Industry: ${companyData.industry || 'N/A'}
- Website: ${companyData.website || 'N/A'}
` : 'No company data provided'}

Deal Information:
${dealData ? `
- Title: ${dealData.title}
- Amount: $${dealData.amount || 'N/A'}
- Stage: ${dealData.stage}
- Notes: ${dealData.notes || 'N/A'}
` : 'No deal data provided'}

Business Profile:
${businessProfile ? `
- Company: ${businessProfile.company_name || 'N/A'}
- Industry: ${businessProfile.industry || 'N/A'}
- Services: ${businessProfile.services_description || 'N/A'}
` : 'No business profile found'}

Additional Context: ${context || 'None provided'}

Please generate a detailed ${type} with:
1. Line items with descriptions, quantities, unit prices
2. Subtotal, tax (10%), and total
3. Professional terms and conditions
4. Payment terms (Net 30 days)

Return the data in the following JSON format:
{
  "lineItems": [
    {
      "description": "Item description",
      "quantity": 1,
      "unitPrice": 100,
      "total": 100
    }
  ],
  "subtotal": 100,
  "taxRate": 10,
  "taxAmount": 10,
  "totalAmount": 110,
  "notes": "Additional notes",
  "terms": "Payment terms and conditions"
}`;

    // Call Lovable AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

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
            content: 'You are a professional invoice and quotation generator. Generate structured data in valid JSON format only.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      if (aiResponse.status === 402) {
        throw new Error('Payment required. Please add credits to your Lovable AI workspace.');
      }
      
      throw new Error(`AI API error: ${aiResponse.status} - ${errorText}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content;

    if (!aiContent) {
      throw new Error('No content in AI response');
    }

    // Parse JSON from AI response
    let invoiceData;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = aiContent.match(/```json\s*([\s\S]*?)\s*```/) || 
                       aiContent.match(/```\s*([\s\S]*?)\s*```/) ||
                       [null, aiContent];
      invoiceData = JSON.parse(jsonMatch[1].trim());
    } catch (parseError) {
      console.error('Failed to parse AI response:', aiContent);
      throw new Error('Invalid JSON in AI response');
    }

    // Generate invoice number
    const timestamp = Date.now();
    const invoiceNumber = `${type === 'quotation' ? 'QT' : 'INV'}-${timestamp}`;

    // Calculate due date (30 days from now)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    // Create invoice in database
    const { data: invoice, error: invoiceError } = await supabaseClient
      .from('invoices')
      .insert({
        user_id: user.id,
        invoice_number: invoiceNumber,
        company_id: companyId,
        deal_id: dealId,
        invoice_type: type,
        status: 'draft',
        issue_date: new Date().toISOString().split('T')[0],
        due_date: dueDate.toISOString().split('T')[0],
        subtotal: invoiceData.subtotal,
        tax_rate: invoiceData.taxRate,
        tax_amount: invoiceData.taxAmount,
        total_amount: invoiceData.totalAmount,
        line_items: invoiceData.lineItems,
        notes: invoiceData.notes,
        terms: invoiceData.terms,
        ai_generated: true,
        ai_context: { companyId, dealId, context },
      })
      .select()
      .single();

    if (invoiceError) {
      console.error('Database error:', invoiceError);
      throw new Error('Failed to save invoice');
    }

    return new Response(
      JSON.stringify({ success: true, invoice }),
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
