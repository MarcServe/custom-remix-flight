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
    const { size, geography, industry, dryRun } = await req.json();

    console.log("Lead Finder request:", { size, geography, industry, dryRun });

    const EXA_API_KEY = Deno.env.get("EXA_API_KEY");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!EXA_API_KEY || !OPENAI_API_KEY) {
      throw new Error("Missing API keys");
    }

    // Search for companies using Exa API
    const exaQuery = `${industry} companies in ${geography} with ${size} employees`;
    console.log("Exa search query:", exaQuery);

    const exaResponse = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": EXA_API_KEY,
      },
      body: JSON.stringify({
        query: exaQuery,
        numResults: 5,
        useAutoprompt: true,
        type: "keyword",
      }),
    });

    if (!exaResponse.ok) {
      const errorText = await exaResponse.text();
      console.error("Exa API error:", errorText);
      throw new Error(`Exa API error: ${exaResponse.statusText}`);
    }

    const exaData = await exaResponse.json();
    console.log("Exa results:", exaData.results?.length || 0);

    // Extract and normalize company data using OpenAI
    const extractionPrompt = `Extract company information from the following search results and return ONLY a valid JSON array of objects (no markdown, no code blocks, just the JSON array).

Each object must have these exact fields:
- name (string, required)
- website (string, optional)
- description (string, optional)
- industry (string, use "${industry}")
- size (string, use "${size}")
- geography (string, use "${geography}")
- linkedinUrl (string, optional)

Search results:
${JSON.stringify(exaData.results, null, 2)}

Return ONLY the JSON array, nothing else.`;

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
              content:
                "You are a data extraction assistant. Return only valid JSON arrays, no markdown or explanations.",
            },
            {
              role: "user",
              content: extractionPrompt,
            },
          ],
          temperature: 0.3,
        }),
      }
    );

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error("OpenAI API error:", errorText);
      throw new Error(`OpenAI API error: ${openaiResponse.statusText}`);
    }

    const openaiData = await openaiResponse.json();
    const extractedText = openaiData.choices[0].message.content.trim();
    
    // Clean up the response - remove markdown code blocks if present
    let cleanedText = extractedText;
    if (cleanedText.startsWith("```json")) {
      cleanedText = cleanedText.replace(/```json\n?/g, "").replace(/```\n?/g, "");
    } else if (cleanedText.startsWith("```")) {
      cleanedText = cleanedText.replace(/```\n?/g, "");
    }
    
    console.log("Extracted text (cleaned):", cleanedText);

    let leads;
    try {
      leads = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      console.error("Raw text:", extractedText);
      throw new Error("Failed to parse AI response as JSON");
    }

    if (!Array.isArray(leads)) {
      throw new Error("AI response is not an array");
    }

    console.log("Normalized leads:", leads.length);

    // If not dry run, insert into database
    let insertedCount = 0;
    if (!dryRun) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      for (const lead of leads) {
        try {
          const { error } = await supabase.from("companies").upsert(
            {
              name: lead.name,
              website: lead.website || null,
              description: lead.description || null,
              industry: lead.industry || null,
              size: lead.size || null,
              geography: lead.geography || null,
              linkedin_url: lead.linkedinUrl || null,
              status: "NEW",
              enriched_at: new Date().toISOString(),
            },
            {
              onConflict: "website",
              ignoreDuplicates: true,
            }
          );

          if (!error) {
            insertedCount++;
          } else {
            console.error("Insert error:", error);
          }
        } catch (insertError) {
          console.error("Insert error for lead:", lead, insertError);
        }
      }

      console.log("Inserted companies:", insertedCount);
    }

    return new Response(
      JSON.stringify({
        leads,
        inserted: insertedCount,
        dryRun,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Lead finder error:", error);
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
