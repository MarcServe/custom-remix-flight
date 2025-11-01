import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createTrace, createSpan, endSpan } from '../_shared/langfuse.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// PHASE 1: Deduplication helper function
function deduplicateResults(results: any[]): any[] {
  const seen = new Map<string, any>();
  
  return results.filter(result => {
    if (!result.url && !result.title) return false;
    
    // Create deduplication key from URL or title
    let key = '';
    
    if (result.url) {
      // Normalize URL: remove protocol, www, trailing slashes
      try {
        const url = new URL(result.url);
        key = url.hostname.replace('www.', '') + url.pathname.replace(/\/$/, '');
      } catch {
        key = result.url.toLowerCase();
      }
    } else if (result.title) {
      // Normalize title: lowercase, remove common company suffixes
      key = result.title
        .toLowerCase()
        .replace(/\b(inc|llc|ltd|corp|corporation|limited|company|co)\b\.?/g, '')
        .replace(/[^\w\s]/g, '')
        .trim();
    }
    
    if (seen.has(key)) {
      // Keep the result with more content
      const existing = seen.get(key);
      const existingLength = (existing.text || '').length;
      const currentLength = (result.text || '').length;
      
      if (currentLength > existingLength) {
        seen.set(key, result);
        return false; // Remove existing, will add current
      }
      return false; // Skip duplicate
    }
    
    seen.set(key, result);
    return true;
  });
}

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

    // Exa search span - PHASE 1: Multiple parallel searches
    const exaSpan = createSpan(trace, 'exa-api-search', { query: `${industry} companies in ${geography} with ${size} employees` });

    // Build the Exa search query with enhanced industry context
    // Extract subcategory from format "Subcategory (Category)" if present
    let industryContext = industry;
    let mainCategory = '';
    
    if (industry.includes('(') && industry.includes(')')) {
      const match = industry.match(/^(.+?)\s*\((.+?)\)$/);
      if (match) {
        industryContext = match[1].trim(); // Subcategory
        mainCategory = match[2].trim(); // Main category
      }
    }
    
    console.log("Industry context:", { industryContext, mainCategory });

    // PHASE 1: Create 4 parallel search strategies for comprehensive coverage
    const exaQueries = [
      // Strategy 1: Direct industry + location search
      `${industryContext} companies in ${geography} with approximately ${size} employees`,
      
      // Strategy 2: LinkedIn company pages (higher quality)
      `site:linkedin.com/company ${industryContext} ${geography} ${size}`,
      
      // Strategy 3: Company directories and listings
      `${industryContext} company directory ${geography} industry list`,
      
      // Strategy 4: News and press releases (active companies)
      `${industryContext} company news ${geography} 2024 2025 ${size} employees`
    ];

    console.log("Running 4 parallel Exa searches for comprehensive coverage");

    // Enhanced Exa parameters for better quality
    const exaSearchParams = {
      numResults: 20, // Increased from 10 to 20 per query
      useAutoprompt: true,
      type: "keyword",
      includeDomains: [
        "linkedin.com",
        "crunchbase.com",
        "bloomberg.com",
        "reuters.com"
      ], // Prioritize high-quality sources
      contents: {
        text: {
          maxCharacters: 2000, // Increased from 1000 for more context
          includeHtmlTags: false,
        },
      },
    };

    // Execute all 4 queries in parallel
    const exaPromises = exaQueries.map(async (query, index) => {
      try {
        console.log(`Exa query ${index + 1}:`, query);
        const response = await fetch("https://api.exa.ai/search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": exaKey,
          },
          body: JSON.stringify({
            query,
            ...exaSearchParams,
          }),
        });

        if (!response.ok) {
          console.error(`Exa query ${index + 1} failed:`, await response.text());
          return { results: [] };
        }

        const data = await response.json();
        console.log(`Exa query ${index + 1} returned ${data.results?.length || 0} results`);
        return data;
      } catch (error) {
        console.error(`Exa query ${index + 1} error:`, error);
        return { results: [] };
      }
    });

    const exaResponses = await Promise.all(exaPromises);
    
    // Combine all results
    let allResults: any[] = [];
    exaResponses.forEach((response, index) => {
      if (response.results && Array.isArray(response.results)) {
        allResults.push(...response.results);
      }
    });

    console.log(`Total raw results from all queries: ${allResults.length}`);

    // PHASE 1: Deduplication by URL and normalized company name
    const deduplicatedResults = deduplicateResults(allResults);
    console.log(`After deduplication: ${deduplicatedResults.length} unique companies`);

    // Create combined exaData object for downstream processing
    const exaData = { results: deduplicatedResults };
    
    await endSpan(exaSpan, { 
      totalResults: allResults.length,
      uniqueResults: deduplicatedResults.length,
      queriesRun: 4
    });

    // Enhanced extraction prompt with industry context
    const industryGuidance = mainCategory 
      ? `Focus on companies specifically in the ${industryContext} sector within the broader ${mainCategory} industry.`
      : `Focus on companies in the ${industryContext} industry.`;

    const extractionPrompt = `Extract company information from the following search results and return ONLY a valid JSON array of objects.

${industryGuidance}

CRITICAL RULES:
1. Extract ALL companies mentioned in the results, even if data is incomplete
2. If a field is missing, use null (don't skip the company)
3. Return ONLY the JSON array - NO markdown, NO explanations, NO code blocks
4. For the industry field, be as specific as possible using "${industryContext}"${mainCategory ? ` (${mainCategory})` : ''}

Each object must have these exact fields:
- name (string, required)
- website (string or null)
- description (string or null, 1-2 sentences highlighting their specific niche)
- industry (string, use "${industryContext}"${mainCategory ? ` or more specific within ${mainCategory}` : ''})
- size (string, use "${size}")
- geography (string, use "${geography}")
- linkedinUrl (string or null)

Prioritize companies that are a strong match for "${industryContext}" within the search results.

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

    // Enrich with Perplexity if requested - Process in parallel for speed
    let enrichmentUsage = null;
    if (enrichWithPerplexity && leads.length > 0) {
      const enrichmentSpan = createSpan(trace, 'perplexity-enrichment', { leadCount: leads.length });
      console.log("Starting Perplexity enrichment for", leads.length, "leads (parallel processing)");

      let totalEnrichmentTokens = 0;
      let totalEnrichmentCost = 0;

      // Process all leads in parallel with 10 second timeout per lead
      const enrichmentPromises = leads.map(async (lead) => {
        try {
          const enrichmentPrompt = `Find detailed current information about ${lead.name}${lead.website ? ` (website: ${lead.website})` : ''}:
          
Return a JSON object with these fields:
- description: detailed company overview (2-3 sentences)
- products: key products or services (brief)
- recentNews: latest significant news or developments (brief)
- fundingInfo: recent funding information if available
- employeeCount: current employee count estimate (number)
- headquarters: headquarters location
- companyPhone: main public phone number if available (format: international with country code)
- generalEmail: general inquiry email (e.g., info@, contact@, hello@, sales@)
- socialProfiles: object with linkedin, twitter, facebook, instagram, youtube URLs if available
- keyExecutives: array of top 2-3 executives with name and title (e.g., [{name: "John Doe", title: "CEO"}])

Return ONLY valid JSON, no markdown blocks.`;

          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Enrichment timeout')), 10000)
          );

          const enrichPromise = fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-provider`, {
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

          const enrichResponse = await Promise.race([enrichPromise, timeoutPromise]) as Response;

          if (enrichResponse.ok) {
            const enrichResult = await enrichResponse.json();
            let enrichedData: any = {};
            
            // Clean and parse enrichment response with robust error handling
            try {
              let cleanedEnrichText = enrichResult.content.trim();
              
              // Remove markdown code blocks
              cleanedEnrichText = cleanedEnrichText
                .replace(/```json\n?/g, "")
                .replace(/```\n?/g, "")
                .trim();
              
              // Try to extract JSON if wrapped in text
              const jsonMatch = cleanedEnrichText.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                cleanedEnrichText = jsonMatch[0];
              }
              
              enrichedData = JSON.parse(cleanedEnrichText);
            } catch (e) {
              console.error("Failed to parse enrichment for", lead.name);
              enrichedData = {};
            }

            return {
              ...lead,
              description: enrichedData.description || lead.description,
              products: enrichedData.products,
              recentNews: enrichedData.recentNews,
              fundingInfo: enrichedData.fundingInfo,
              employeeCount: enrichedData.employeeCount,
              geography: enrichedData.headquarters || lead.geography,
              companyPhone: enrichedData.companyPhone,
              generalEmail: enrichedData.generalEmail,
              socialProfiles: enrichedData.socialProfiles,
              keyExecutives: enrichedData.keyExecutives,
              wasEnriched: true,
              usage: enrichResult.usage,
            };
          } else {
            console.error("Enrichment failed for", lead.name);
            return { ...lead, wasEnriched: false };
          }
        } catch (enrichError) {
          console.error("Enrichment error for", lead.name, ":", enrichError);
          return { ...lead, wasEnriched: false };
        }
      });

      const enrichedLeads = await Promise.all(enrichmentPromises);
      
      // Calculate total usage
      enrichedLeads.forEach(lead => {
        if (lead.usage) {
          totalEnrichmentTokens += lead.usage.totalTokens || 0;
          totalEnrichmentCost += lead.usage.estimatedCost || 0;
          delete lead.usage; // Remove usage from lead object
        }
      });

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

    // Contact enrichment with GetProspect - Optimized with parallel processing
    const GETPROSPECT_API_KEY = Deno.env.get("GETPROSPECT_API_KEY");
    
    if (GETPROSPECT_API_KEY && leads.length > 0) {
      const contactSpan = createSpan(trace, 'getprospect-contact-enrichment', { leadCount: leads.length });
      console.log("Starting GetProspect contact enrichment for", leads.length, "leads (parallel)");

      // Process all leads in parallel with 15 second timeout per lead
      const contactPromises = leads.map(async (lead) => {
        try {
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Contact enrichment timeout')), 15000)
          );

          const enrichPromise = (async () => {
            const contacts: any[] = [];
            
            // Strategy: Search by LinkedIn URL OR search for one key role only
            if (lead.linkedinUrl) {
              try {
                const response = await fetch(
                  `https://api.getprospect.com/public/v1/insights/contact?linkedinUrl=${encodeURIComponent(lead.linkedinUrl)}&apiKey=${GETPROSPECT_API_KEY}`,
                  { signal: AbortSignal.timeout(5000) }
                );
                
                if (response.ok) {
                  const data = await response.json();
                  if (data.contacts && Array.isArray(data.contacts)) {
                    contacts.push(...data.contacts.slice(0, 3).map((c: any) => ({
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
                console.error(`LinkedIn contact search failed for ${lead.name}`);
              }
            }
            
            // If no contacts found, try ONE primary role
            if (contacts.length === 0 && lead.name) {
              const role = 'Sales Director'; // Focus on one high-value role
              
              try {
                const findResponse = await fetch(
                  `https://api.getprospect.com/public/v1/email/find?name=${encodeURIComponent(role)}&company=${encodeURIComponent(lead.name)}&apiKey=${GETPROSPECT_API_KEY}`,
                  { signal: AbortSignal.timeout(5000) }
                );
                
                if (findResponse.ok) {
                  const findData = await findResponse.json();
                  if (findData.email) {
                    contacts.push({
                      name: findData.name || role,
                      email: findData.email,
                      emailVerified: false, // Skip verification to save time
                      title: role,
                      companyName: lead.name
                    });
                  }
                }
              } catch (err) {
                console.error(`Email search failed for ${lead.name}`);
              }
            }
            
            // Set primary contact (first one)
            const primaryContact = contacts.length > 0 ? contacts[0] : null;
            
            return { contacts, primaryContact };
          })();

          const result = await Promise.race([enrichPromise, timeoutPromise]) as { contacts: any[], primaryContact: any };
          lead.contacts = result.contacts;
          lead.primaryContact = result.primaryContact;
          
        } catch (error) {
          console.error(`Contact enrichment timeout for ${lead.name}`);
          lead.contacts = [];
          lead.primaryContact = null;
        }
        
        return lead;
      });

      await Promise.all(contactPromises);
      
      console.log("Contact enrichment complete");
      await endSpan(contactSpan);
    }

    // Filter out leads without contact information
    const originalLeadCount = leads.length;
    const leadsWithContacts = leads.filter(lead => {
      const hasContacts = lead.contacts && lead.contacts.length > 0;
      const hasGeneralEmail = lead.generalEmail;
      const hasPrimaryContact = lead.primaryContact;
      return hasContacts || hasGeneralEmail || hasPrimaryContact;
    });
    
    const filteredCount = originalLeadCount - leadsWithContacts.length;
    console.log(`Filtered ${filteredCount} leads without contact info. ${leadsWithContacts.length} leads remaining.`);
    
    // Use filtered leads for the rest of the process
    leads = leadsWithContacts;

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
              company_phone: lead.companyPhone || null,
              general_email: lead.generalEmail || null,
              social_profiles: lead.socialProfiles || null,
              key_executives: lead.keyExecutives || null,
              employee_count: lead.employeeCount || null,
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
        filteredCount,
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
