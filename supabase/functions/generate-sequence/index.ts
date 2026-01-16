import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createTrace, createSpan, endSpan } from '../_shared/langfuse.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { size, geography, industry, steps = 3, tone = "professional", provider, model, customInstructions, autoRespond = false } = await req.json();

    console.log("Sequence generation request:", { size, geography, industry, steps, tone, provider, model });

    // Fetch user's business profile for context
    const authHeader = req.headers.get('Authorization');
    let businessContext = '';
    
    let userId: string | null = null;
    
    if (authHeader) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      
      if (!userError && user) {
        userId = user.id;
        
        const { data: profile } = await supabase
          .from('business_profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();
        
        if (profile) {
          businessContext = `

YOUR BUSINESS CONTEXT (use this to tailor the outreach):
- Company: ${profile.company_name}
- Industry: ${profile.industry}
- Services/Products: ${profile.services_description}
${profile.target_audience ? `- Target Audience: ${profile.target_audience}` : ''}
${profile.value_proposition ? `- Value Proposition: ${profile.value_proposition}` : ''}

Create emails that connect YOUR business offerings to the prospect's needs in the ${industry} industry.`;
          console.log('Business profile loaded for sequence generation');
        }
      }
    }

    // Create trace for observability
    const trace = createTrace('generate-sequence', undefined, { size, geography, industry, steps, tone });

    const sequencePrompt = `Generate a ${steps}-step cold email outreach sequence for reaching out to ${industry} companies in ${geography} with ${size} employees.

Tone: ${tone}
${businessContext}

${customInstructions ? `\nCUSTOM INSTRUCTIONS:\n${customInstructions}\n` : ''}

Return ONLY a valid JSON array (no markdown, no code blocks) with exactly ${steps} objects, each having:
- subject (string): Email subject line
- body (string): Email body with placeholders like {{company_name}}, {{first_name}}
- delayDays (number): Days to wait before sending (0 for first email, then increase)

Make each email progressively more specific and value-focused. Keep emails concise and professional.
${businessContext ? 'Use the business context to make the emails relevant and show clear value alignment.' : ''}
${customInstructions ? 'Follow the custom instructions provided above carefully.' : ''}

Return ONLY the JSON array.`;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    // Call ai-provider function
    const aiProviderResponse = await fetch(`${supabaseUrl}/functions/v1/ai-provider`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider: provider || 'openai',
        model: model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert sales copywriter. Return only valid JSON arrays, no markdown.',
          },
          {
            role: 'user',
            content: sequencePrompt,
          },
        ],
        temperature: 0.7,
        traceId: trace.id,
      }),
    });

    if (!aiProviderResponse.ok) {
      const errorText = await aiProviderResponse.text();
      console.error("AI Provider error:", errorText);
      throw new Error(`AI Provider error: ${aiProviderResponse.statusText}`);
    }

    const aiResult = await aiProviderResponse.json();
    const generatedText = aiResult.content.trim();

    // Clean up markdown code blocks
    let cleanedText = generatedText;
    if (cleanedText.startsWith("```json")) {
      cleanedText = cleanedText.replace(/```json\n?/g, "").replace(/```\n?/g, "");
    } else if (cleanedText.startsWith("```")) {
      cleanedText = cleanedText.replace(/```\n?/g, "");
    }

    console.log("Generated sequence (cleaned):", cleanedText);
    console.log("AI Provider used:", aiResult.provider, "Model:", aiResult.model);
    console.log("Usage:", aiResult.usage);

    let sequence;
    try {
      sequence = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      console.error("Raw text:", generatedText);
      throw new Error("Failed to parse AI response as JSON");
    }

    if (!Array.isArray(sequence)) {
      throw new Error("AI response is not an array");
    }

    console.log("Generated sequence steps:", sequence.length);

    // Save the sequence to the database
    const dbSpan = createSpan(trace, 'database-insert');
    
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const sequenceName = `${industry} in ${geography} (${size}) - ${tone}`;

    const { data: savedSequence, error: sequenceError } = await supabase
      .from("email_sequences")
      .insert({
        name: sequenceName,
        steps: sequence,
        segment_filters: {
          size,
          geography,
          industry,
        },
        provider: aiResult.provider,
        model: aiResult.model,
        langfuse_trace_id: aiResult.traceId,
        custom_instructions: customInstructions,
        auto_respond: autoRespond,
        created_by: userId,
      })
      .select()
      .single();

    if (sequenceError) {
      console.error("Error saving sequence:", sequenceError);
      await endSpan(dbSpan, undefined, sequenceError);
      throw sequenceError;
    }

    console.log("Saved sequence:", savedSequence.id);
    await endSpan(dbSpan, { sequenceId: savedSequence.id });

    return new Response(
      JSON.stringify({
        sequence,
        sequenceId: savedSequence.id,
        name: sequenceName,
        provider: aiResult.provider,
        model: aiResult.model,
        usage: aiResult.usage,
        traceUrl: aiResult.traceUrl,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Sequence generation error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
