import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

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
    const { size, geography, industry, steps = 3, tone = "professional" } = await req.json();

    console.log("Sequence generation request:", { size, geography, industry, steps, tone });

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!OPENAI_API_KEY) {
      throw new Error("Missing OpenAI API key");
    }

    const sequencePrompt = `Generate a ${steps}-step cold email outreach sequence for reaching out to ${industry} companies in ${geography} with ${size} employees.

Tone: ${tone}

Return ONLY a valid JSON array (no markdown, no code blocks) with exactly ${steps} objects, each having:
- subject (string): Email subject line
- body (string): Email body with placeholders like {{company_name}}, {{first_name}}
- delayDays (number): Days to wait before sending (0 for first email, then increase)

Make each email progressively more specific and value-focused. Keep emails concise and professional.

Return ONLY the JSON array.`;

    const openaiResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are an expert sales copywriter. Return only valid JSON arrays, no markdown.",
            },
            {
              role: "user",
              content: sequencePrompt,
            },
          ],
          temperature: 0.7,
        }),
      }
    );

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error("OpenAI API error:", errorText);
      throw new Error(`OpenAI API error: ${openaiResponse.statusText}`);
    }

    const openaiData = await openaiResponse.json();
    const generatedText = openaiData.choices[0].message.content.trim();

    // Clean up markdown code blocks
    let cleanedText = generatedText;
    if (cleanedText.startsWith("```json")) {
      cleanedText = cleanedText.replace(/```json\n?/g, "").replace(/```\n?/g, "");
    } else if (cleanedText.startsWith("```")) {
      cleanedText = cleanedText.replace(/```\n?/g, "");
    }

    console.log("Generated sequence (cleaned):", cleanedText);

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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
      })
      .select()
      .single();

    if (sequenceError) {
      console.error("Error saving sequence:", sequenceError);
      throw sequenceError;
    }

    console.log("Saved sequence:", savedSequence.id);

    return new Response(
      JSON.stringify({
        sequence,
        sequenceId: savedSequence.id,
        name: sequenceName,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Sequence generation error:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
