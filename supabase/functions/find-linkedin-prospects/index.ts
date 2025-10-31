import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { companyId, linkedinUrl, companyName } = await req.json();

    console.log("Find LinkedIn prospects request:", { companyId, linkedinUrl, companyName });

    if (!companyId || !linkedinUrl) {
      throw new Error("Missing companyId or linkedinUrl");
    }

    const EXA_API_KEY = Deno.env.get("EXA_API_KEY");
    const GETPROSPECT_API_KEY = Deno.env.get("GETPROSPECT_API_KEY");

    if (!EXA_API_KEY) {
      throw new Error("Missing EXA_API_KEY");
    }

    // Step 1: Use Exa to get the LinkedIn company page content
    console.log("Fetching LinkedIn company page with Exa...");
    const exaResponse = await fetch("https://api.exa.ai/contents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": String(EXA_API_KEY).trim(),
      },
      body: JSON.stringify({
        ids: [linkedinUrl],
        text: {
          maxCharacters: 5000,
          includeHtmlTags: false,
        },
      }),
    });

    if (!exaResponse.ok) {
      const errorText = await exaResponse.text();
      console.error("Exa API error:", errorText);
      throw new Error(`Exa API error: ${exaResponse.statusText}`);
    }

    const exaData = await exaResponse.json();
    console.log("Exa content retrieved");

    // Step 2: Extract employee information using AI
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const extractionPrompt = `Extract employee names and titles from this LinkedIn company page content. 
    
Focus on people in these roles: CEO, Founder, Sales Director, Head of Sales, VP Sales, Business Development, Marketing Director.

Return ONLY a JSON array of objects with this format:
[
  {"name": "Full Name", "title": "Job Title", "department": "Sales/Marketing/Executive"}
]

LinkedIn content:
${exaData.results[0]?.text || "No content available"}

Return ONLY the JSON array:`;

    const aiProviderResponse = await fetch(`${supabaseUrl}/functions/v1/ai-provider`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider: 'lovable',
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are a data extraction assistant. Return only valid JSON arrays.',
          },
          {
            role: 'user',
            content: extractionPrompt,
          },
        ],
        temperature: 0.2,
      }),
    });

    if (!aiProviderResponse.ok) {
      throw new Error(`AI Provider error: ${aiProviderResponse.statusText}`);
    }

    const aiResult = await aiProviderResponse.json();
    let extractedText = aiResult.content.trim();
    
    // Clean up markdown
    extractedText = extractedText
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    
    let employees;
    try {
      employees = JSON.parse(extractedText);
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      employees = [];
    }

    console.log(`Extracted ${employees.length} employees`);

    // Step 3: Enrich with GetProspect (find emails)
    const contacts = [];
    
    if (GETPROSPECT_API_KEY && employees.length > 0) {
      console.log("Starting GetProspect enrichment...");
      
      // Process up to 10 employees
      for (const employee of employees.slice(0, 10)) {
        try {
          const findResponse = await fetch(
            `https://api.getprospect.com/public/v1/email/find?name=${encodeURIComponent(employee.name)}&company=${encodeURIComponent(companyName)}&apiKey=${GETPROSPECT_API_KEY}`,
            { signal: AbortSignal.timeout(8000) }
          );
          
          if (findResponse.ok) {
            const findData = await findResponse.json();
            if (findData.email) {
              contacts.push({
                name: employee.name,
                title: employee.title,
                department: employee.department,
                email: findData.email,
                emailVerified: false,
              });
            }
          }
        } catch (err) {
          console.error(`Email search failed for ${employee.name}`);
        }
      }
    }

    console.log(`Found ${contacts.length} contacts with emails`);

    // Step 4: Insert contacts into database
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let insertedCount = 0;
    for (const contact of contacts) {
      try {
        const { error } = await supabase.from("contacts").insert({
          company_id: companyId,
          name: contact.name,
          email: contact.email,
          email_verified: contact.emailVerified,
          title: contact.title,
          department: contact.department,
          is_primary_contact: insertedCount === 0, // First contact is primary
        });

        if (!error) {
          insertedCount++;
        } else {
          console.error("Contact insert error:", error);
        }
      } catch (insertError) {
        console.error("Insert error for contact:", contact, insertError);
      }
    }

    console.log("Inserted contacts:", insertedCount);

    return new Response(
      JSON.stringify({
        contacts,
        inserted: insertedCount,
        employeesFound: employees.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Find LinkedIn prospects error:", error);
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
