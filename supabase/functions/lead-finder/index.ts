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
    const { size, geography, industry, dryRun, provider, model, enrichWithPerplexity } = await req.json();

    console.log("Lead Finder request:", { size, geography, industry, dryRun, provider, model, enrichWithPerplexity });

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
        numResults: 10, // Increased from 5 to get more results
        useAutoprompt: true,
        type: "keyword",
        contents: {
          text: {
            maxCharacters: 1000,
            includeHtmlTags: false,
          },
        },
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
    const extractionPrompt = `Extract company information from the following search results and return ONLY a valid JSON array of objects.

CRITICAL RULES:
1. Extract ALL companies mentioned in the results, even if data is incomplete
2. If a field is missing, use null (don't skip the company)
3. Return ONLY the JSON array - NO markdown, NO explanations, NO code blocks

Each object must have these exact fields:
- name (string, required)
- website (string or null)
- description (string or null)
- industry (string, use "${industry}")
- size (string, use "${size}")
- geography (string, use "${geography}")
- linkedinUrl (string or null)

Search results:
${JSON.stringify(exaData.results, null, 2)}

Return ONLY the JSON array now:`;

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
      console.log(`Successfully parsed ${leads.length} leads`);
      
      // Log each lead for debugging
      leads.forEach((lead: any, idx: number) => {
        console.log(`Lead ${idx + 1}:`, {
          name: lead.name,
          hasWebsite: !!lead.website,
          hasLinkedIn: !!lead.linkedinUrl
        });
      });
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      console.error("Raw AI response:", extractedText);
      console.error("Cleaned text:", cleanedText);
      const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown parse error';
      throw new Error(`Failed to parse AI response: ${errorMessage}`);
    }

    if (!Array.isArray(leads)) {
      throw new Error("AI response is not an array");
    }

    console.log("Normalized leads:", leads.length);

    // Enrich with Perplexity if requested
    let enrichmentUsage = null;
    if (enrichWithPerplexity && leads.length > 0) {
      const enrichmentSpan = createSpan(trace, 'perplexity-enrichment', { leadCount: leads.length });
      console.log("Starting Perplexity enrichment for", leads.length, "leads");

      let enrichedLeads = [];
      let totalEnrichmentTokens = 0;
      let totalEnrichmentCost = 0;

      for (const lead of leads) {
        try {
          const enrichmentPrompt = `Find detailed current information about ${lead.name}${lead.website ? ` (website: ${lead.website})` : ''}:
          
Return a JSON object with these fields:
- description: detailed company overview (2-3 sentences)
- products: key products or services (brief)
- recentNews: latest significant news or developments (brief)
- fundingInfo: recent funding information if available
- employeeCount: current employee count estimate (number)
- headquarters: headquarters location

Return ONLY valid JSON, no markdown blocks.`;

          const enrichResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-provider`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              provider: 'perplexity',
              model: 'sonar',
              messages: [
                {
                  role: 'system',
                  content: 'You are a company research assistant. Return only valid JSON objects, no markdown.',
                },
                {
                  role: 'user',
                  content: enrichmentPrompt,
                },
              ],
              temperature: 0.2,
              traceId: trace.id,
            }),
          });

          if (enrichResponse.ok) {
            const enrichResult = await enrichResponse.json();
            let enrichedData;
            
            // Clean and parse enrichment response
            let cleanedEnrichText = enrichResult.content.trim();
            if (cleanedEnrichText.startsWith("```json")) {
              cleanedEnrichText = cleanedEnrichText.replace(/```json\n?/g, "").replace(/```\n?/g, "");
            } else if (cleanedEnrichText.startsWith("```")) {
              cleanedEnrichText = cleanedEnrichText.replace(/```\n?/g, "");
            }
            
            try {
              enrichedData = JSON.parse(cleanedEnrichText);
            } catch (e) {
              console.error("Failed to parse enrichment for", lead.name, ":", e);
              enrichedData = {};
            }

            totalEnrichmentTokens += enrichResult.usage.totalTokens;
            totalEnrichmentCost += enrichResult.usage.estimatedCost;

            enrichedLeads.push({
              ...lead,
              description: enrichedData.description || lead.description,
              products: enrichedData.products,
              recentNews: enrichedData.recentNews,
              fundingInfo: enrichedData.fundingInfo,
              employeeCount: enrichedData.employeeCount,
              geography: enrichedData.headquarters || lead.geography,
              wasEnriched: true,
            });
          } else {
            console.error("Enrichment failed for", lead.name);
            enrichedLeads.push({ ...lead, wasEnriched: false });
          }
        } catch (enrichError) {
          console.error("Enrichment error for", lead.name, ":", enrichError);
          enrichedLeads.push({ ...lead, wasEnriched: false });
        }
      }

      leads = enrichedLeads;
      enrichmentUsage = {
        promptTokens: 0,
        completionTokens: totalEnrichmentTokens,
        totalTokens: totalEnrichmentTokens,
        estimatedCost: totalEnrichmentCost,
      };

      console.log("Enrichment complete. Total cost:", totalEnrichmentCost);
      await endSpan(enrichmentSpan, { enrichedCount: enrichedLeads.filter(l => l.wasEnriched).length });
    }

    // Contact enrichment with GetProspect
    const GETPROSPECT_API_KEY = Deno.env.get("GETPROSPECT_API_KEY");
    
    if (GETPROSPECT_API_KEY && leads.length > 0) {
      const contactSpan = createSpan(trace, 'getprospect-contact-enrichment', { leadCount: leads.length });
      console.log("Starting GetProspect contact enrichment for", leads.length, "leads");

      for (const lead of leads) {
        try {
          const contacts: any[] = [];
          
          // Strategy 1: Search by company LinkedIn URL if available
          if (lead.linkedinUrl) {
            try {
              const response = await fetch(
                `https://api.getprospect.com/public/v1/insights/contact?linkedinUrl=${encodeURIComponent(lead.linkedinUrl)}&apiKey=${GETPROSPECT_API_KEY}`
              );
              
              if (response.ok) {
                const data = await response.json();
                if (data.contacts && Array.isArray(data.contacts)) {
                  contacts.push(...data.contacts.map((c: any) => ({
                    name: c.name || 'Unknown',
                    email: c.email,
                    emailVerified: c.emailStatus === 'valid',
                    linkedinUrl: c.linkedinUrl,
                    title: c.title,
                    department: c.department,
                    phone: c.phone,
                    companyName: lead.name
                  })));
                }
              }
            } catch (err) {
              console.error(`LinkedIn contact search failed for ${lead.name}:`, err);
            }
          }
          
          // Strategy 2: Search by email for common roles if we don't have enough contacts
          if (contacts.length < 3 && lead.name) {
            const commonRoles = ['Sales Director', 'Customer Success Manager', 'CEO', 'Business Development Manager'];
            
            for (const role of commonRoles.slice(0, 3 - contacts.length)) {
              try {
                // Find email
                const findResponse = await fetch(
                  `https://api.getprospect.com/public/v1/email/find?name=${encodeURIComponent(role)}&company=${encodeURIComponent(lead.name)}&apiKey=${GETPROSPECT_API_KEY}`
                );
                
                if (findResponse.ok) {
                  const findData = await findResponse.json();
                  if (findData.email) {
                    // Verify email
                    const verifyResponse = await fetch(
                      `https://api.getprospect.com/public/v1/email/verify?email=${encodeURIComponent(findData.email)}&apiKey=${GETPROSPECT_API_KEY}`
                    );
                    
                    let verified = false;
                    if (verifyResponse.ok) {
                      const verifyData = await verifyResponse.json();
                      verified = verifyData.status === 'valid';
                    }
                    
                    contacts.push({
                      name: findData.name || role,
                      email: findData.email,
                      emailVerified: verified,
                      title: role,
                      companyName: lead.name
                    });
                  }
                }
                
                // Rate limit protection
                await new Promise(resolve => setTimeout(resolve, 500));
              } catch (err) {
                console.error(`Email search failed for ${role} at ${lead.name}:`, err);
              }
            }
          }
          
          // Prioritize contacts - prefer sales, customer service, support
          let primaryContact = null;
          if (contacts.length > 0) {
            const priorities = ['sales', 'customer', 'support', 'business development', 'account'];
            for (const keyword of priorities) {
              const match = contacts.find(c => 
                c.title?.toLowerCase().includes(keyword) || 
                c.department?.toLowerCase().includes(keyword)
              );
              if (match) {
                primaryContact = match;
                break;
              }
            }
            if (!primaryContact) primaryContact = contacts[0];
          }
          
          lead.contacts = contacts;
          lead.primaryContact = primaryContact;
          
        } catch (error) {
          console.error(`Contact enrichment failed for ${lead.name}:`, error);
          lead.contacts = [];
        }
      }
      
      console.log("Contact enrichment complete");
      await endSpan(contactSpan);
    }

    // If not dry run, insert into database
    let insertedCount = 0;
    if (!dryRun) {
      const dbSpan = createSpan(trace, 'database-upsert');
      
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      for (const lead of leads) {
        try {
          const { data: companyData, error } = await supabase.from("companies").upsert(
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
              ignoreDuplicates: false,
            }
          ).select();

          if (!error && companyData && companyData.length > 0) {
            insertedCount++;
            const companyId = companyData[0].id;
            
            // Insert contacts if available
            if (lead.contacts && lead.contacts.length > 0) {
              for (const contact of lead.contacts) {
                try {
                  await supabase.from("contacts").insert({
                    company_id: companyId,
                    name: contact.name,
                    email: contact.email || null,
                    email_verified: contact.emailVerified || false,
                    linkedin_url: contact.linkedinUrl || null,
                    title: contact.title || null,
                    department: contact.department || null,
                    phone: contact.phone || null,
                    is_primary_contact: contact === lead.primaryContact
                  });
                } catch (contactError) {
                  console.error("Contact insert error:", contactError);
                }
              }
            }
          } else if (error) {
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
        enrichmentUsage,
        wasEnriched: enrichWithPerplexity,
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
