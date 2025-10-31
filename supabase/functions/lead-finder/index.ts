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
    const { size, geography, industry, dryRun, provider, model } = await req.json();

    console.log("Lead Finder request:", { size, geography, industry, dryRun, provider, model });

    // Create trace for observability
    const trace = createTrace('lead-finder', undefined, { size, geography, industry });

    const EXA_API_KEY = Deno.env.get("EXA_API_KEY");

    if (!EXA_API_KEY) {
      console.error("Missing EXA_API_KEY");
      throw new Error("Missing Exa API key");
    }

    const exaKey = String(EXA_API_KEY).trim();

    // Exa search span
    const exaSpan = createSpan(trace, 'exa-api-search', { query: `${industry} companies in ${geography} with ${size} employees` });

    const exaQuery = `${industry} companies in ${geography} with ${size} employees`;
    console.log("Exa search query:", exaQuery);

    const exaResponse = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": exaKey,
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
      await endSpan(exaSpan, undefined, new Error(`Exa API error: ${exaResponse.statusText}`));
      throw new Error(`Exa API error: ${exaResponse.statusText}`);
    }

    const exaData = await exaResponse.json();
    console.log("Exa results:", exaData.results?.length || 0);
    
    await endSpan(exaSpan, { resultCount: exaData.results?.length || 0 });

    // Call AI provider for data extraction
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
        provider: provider || 'lovable',
        model: model,
        messages: [
          {
            role: 'system',
            content: 'You are a data extraction assistant. Return only valid JSON arrays, no markdown or explanations.',
          },
          {
            role: 'user',
            content: extractionPrompt,
          },
        ],
        temperature: 0.3,
        traceId: trace.id,
      }),
    });

    if (!aiProviderResponse.ok) {
      const errorText = await aiProviderResponse.text();
      console.error("AI Provider error:", errorText);
      throw new Error(`AI Provider error: ${aiProviderResponse.statusText}`);
    }

    const aiResult = await aiProviderResponse.json();
    const extractedText = aiResult.content.trim();
    
    // Clean up the response - remove markdown code blocks if present
    let cleanedText = extractedText;
    if (cleanedText.startsWith("```json")) {
      cleanedText = cleanedText.replace(/```json\n?/g, "").replace(/```\n?/g, "");
    } else if (cleanedText.startsWith("```")) {
      cleanedText = cleanedText.replace(/```\n?/g, "");
    }
    
    console.log("Extracted text (cleaned):", cleanedText);
    console.log("AI Provider used:", aiResult.provider, "Model:", aiResult.model);
    console.log("Usage:", aiResult.usage);

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
      const dbSpan = createSpan(trace, 'database-upsert');
      
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
              enrichment_provider: aiResult.provider,
              enrichment_model: aiResult.model,
              langfuse_trace_id: aiResult.traceId,
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
      await endSpan(dbSpan, { insertedCount });
    }

    return new Response(
      JSON.stringify({
        leads,
        inserted: insertedCount,
        dryRun,
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
    console.error("Lead finder error:", error);
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
