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

    // PHASE 2: Batch processing for better extraction
    console.log("PHASE 2: Starting batch extraction with enhanced prompts");
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const batchSize = 20; // Process 20 companies at a time
    const batches: any[][] = [];
    
    for (let i = 0; i < exaData.results.length; i += batchSize) {
      batches.push(exaData.results.slice(i, i + batchSize));
    }
    
    console.log(`Split ${exaData.results.length} results into ${batches.length} batches`);

    // Enhanced extraction prompt with industry context
    const industryGuidance = mainCategory 
      ? `Focus on companies specifically in the ${industryContext} sector within the broader ${mainCategory} industry.`
      : `Focus on companies in the ${industryContext} industry.`;

    const createExtractionPrompt = (batchResults: any[]) => `Extract company information from the following search results.

${industryGuidance}

CRITICAL RULES:
1. Extract ALL companies mentioned, even if data is incomplete
2. Deduplicate by company name (case-insensitive)
3. Prioritize companies with LinkedIn URLs or official websites
4. For missing fields, use null (don't skip the company)
5. Extract multiple contacts if mentioned (executives, founders)

Required fields (always include):
- name (string, company legal name)
- website (string or null, official domain only - no LinkedIn URLs here)
- description (2-3 sentences, what they do and their specific niche)
- industry (specific: "${industryContext}")
- size (use: "${size}")
- geography (use: "${geography}")
- linkedinUrl (LinkedIn company page URL or null)
- foundingYear (number or null)
- revenue (estimated revenue range or null)

Optional enrichment (extract if available in the text):
- companyPhone (international format with country code)
- generalEmail (info@, contact@, sales@, etc.)
- keyExecutives (array of {name, title}, e.g., [{name: "John Doe", title: "CEO"}])
- fundingStage (seed, series A, B, etc.)
- technologies (tools/platforms they use)
- employeeCount (number or null)

Return ONLY a JSON array of company objects. NO markdown, NO explanations, NO code blocks.

Search results:
${JSON.stringify(batchResults, null, 2)}

Return ONLY the JSON array now:`;

    // Process all batches in parallel
    const aiExtractionSpan = createSpan(trace, 'ai-batch-extraction', { batchCount: batches.length });
    
    const batchPromises = batches.map(async (batch, batchIndex) => {
      try {
        console.log(`Processing batch ${batchIndex + 1}/${batches.length} with ${batch.length} results`);
        
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
                content: createExtractionPrompt(batch),
              },
            ],
            temperature: 0.3,
            traceId: trace.id,
          }),
        });

        if (!aiProviderResponse.ok) {
          const errorText = await aiProviderResponse.text();
          console.error(`Batch ${batchIndex + 1} AI Provider error:`, errorText);
          return { leads: [], usage: null };
        }

        const aiResult = await aiProviderResponse.json();
        const extractedText = aiResult.content.trim();
        
        // Clean up the response
        let cleanedText = extractedText;
        if (cleanedText.startsWith("```json")) {
          cleanedText = cleanedText.replace(/```json\n?/g, "").replace(/```\n?/g, "");
        } else if (cleanedText.startsWith("```")) {
          cleanedText = cleanedText.replace(/```\n?/g, "");
        }
        
        try {
          const batchLeads = JSON.parse(cleanedText);
          console.log(`Batch ${batchIndex + 1} extracted ${batchLeads.length} leads`);
          return { 
            leads: Array.isArray(batchLeads) ? batchLeads : [], 
            usage: aiResult.usage,
            provider: aiResult.provider,
            model: aiResult.model
          };
        } catch (parseError) {
          console.error(`Batch ${batchIndex + 1} JSON parse error:`, parseError);
          return { leads: [], usage: null };
        }
      } catch (error) {
        console.error(`Batch ${batchIndex + 1} processing error:`, error);
        return { leads: [], usage: null };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    await endSpan(aiExtractionSpan, { batchesProcessed: batches.length });

    // Combine all leads from batches
    let allLeads: any[] = [];
    let totalUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCost: 0
    };
    let extractionProvider = '';
    let extractionModel = '';

    batchResults.forEach((result, index) => {
      if (result.leads.length > 0) {
        allLeads.push(...result.leads);
      }
      if (result.usage) {
        totalUsage.promptTokens += result.usage.promptTokens || 0;
        totalUsage.completionTokens += result.usage.completionTokens || 0;
        totalUsage.totalTokens += result.usage.totalTokens || 0;
        totalUsage.estimatedCost += result.usage.estimatedCost || 0;
      }
      if (index === 0) {
        extractionProvider = result.provider || provider || 'lovable';
        extractionModel = result.model || model || 'unknown';
      }
    });

    console.log(`Combined ${allLeads.length} leads from all batches`);
    console.log("AI Provider used:", extractionProvider, "Model:", extractionModel);
    console.log("Total Usage:", totalUsage);

    // PHASE 2: Deduplicate leads by normalized name
    const deduplicateLeads = (leads: any[]) => {
      const seen = new Map();
      
      return leads.filter(lead => {
        if (!lead.name) return false;
        
        // Normalize company name
        const normalizedName = lead.name.toLowerCase()
          .replace(/\b(inc|llc|ltd|corp|corporation|limited|company|co)\b\.?/g, '')
          .replace(/[^\w\s]/g, '')
          .trim();
        
        // Check website domain if available
        let domain = null;
        if (lead.website) {
          try {
            const url = new URL(lead.website.startsWith('http') ? lead.website : `https://${lead.website}`);
            domain = url.hostname.replace('www.', '');
          } catch {
            // Invalid URL, use normalized name only
          }
        }
        
        const key = domain || normalizedName;
        
        if (seen.has(key)) {
          // Keep the lead with more complete data
          const existing = seen.get(key);
          const existingScore = calculateDataCompleteness(existing);
          const currentScore = calculateDataCompleteness(lead);
          
          if (currentScore > existingScore) {
            seen.set(key, lead);
            return false; // Remove existing (will be replaced)
          }
          return false; // Skip duplicate
        }
        
        seen.set(key, lead);
        return true;
      });
    };

    // Helper function to score data completeness
    const calculateDataCompleteness = (lead: any) => {
      let score = 0;
      if (lead.website) score += 3;
      if (lead.linkedinUrl) score += 2;
      if (lead.description && lead.description.length > 50) score += 2;
      if (lead.companyPhone) score += 1;
      if (lead.generalEmail) score += 1;
      if (lead.keyExecutives && lead.keyExecutives.length > 0) score += 2;
      return score;
    };

    let leads = deduplicateLeads(allLeads);
    console.log(`After deduplication: ${leads.length} unique leads`);
    
    // Log sample leads for debugging
    leads.slice(0, 3).forEach((lead, idx) => {
      console.log(`Lead ${idx + 1}:`, {
        name: lead.name,
        hasWebsite: !!lead.website,
        hasLinkedIn: !!lead.linkedinUrl,
        hasDescription: !!lead.description,
        completeness: calculateDataCompleteness(lead)
      });
    });

    // PHASE 3: Intelligent two-tier Perplexity enrichment
    let enrichmentUsage = null;
    if (enrichWithPerplexity && leads.length > 0) {
      const enrichmentSpan = createSpan(trace, 'perplexity-two-tier-enrichment', { leadCount: leads.length });
      console.log("PHASE 3: Starting two-tier Perplexity enrichment for", leads.length, "leads");

      let totalEnrichmentTokens = 0;
      let totalEnrichmentCost = 0;

      // Helper: Check if lead needs basic enrichment (missing critical fields)
      const needsBasicEnrichment = (lead: any) => {
        return !lead.website || !lead.description || lead.description.length < 30;
      };

      // Helper: Calculate quality score for deep enrichment selection
      const calculateQualityScore = (lead: any) => {
        let score = 0;
        if (lead.website) score += 20;
        if (lead.linkedinUrl) score += 20;
        if (lead.description && lead.description.length > 50) score += 15;
        if (lead.keyExecutives && lead.keyExecutives.length > 0) score += 15;
        if (lead.generalEmail) score += 10;
        if (lead.companyPhone) score += 10;
        if (lead.fundingStage) score += 10;
        return score;
      };

      // Categorize leads for two-tier enrichment
      const leadsNeedingBasic: any[] = [];
      const leadsForDeep: any[] = [];

      leads.forEach(lead => {
        lead.qualityScore = calculateQualityScore(lead);
        
        if (needsBasicEnrichment(lead)) {
          leadsNeedingBasic.push(lead);
        } else if (lead.qualityScore >= 50) {
          // Only deep enrich high-quality leads (top tier)
          leadsForDeep.push(lead);
        }
      });

      console.log(`Tier 1 (Basic): ${leadsNeedingBasic.length} leads | Tier 2 (Deep): ${leadsForDeep.length} leads`);

      // TIER 1: Basic enrichment for leads with missing critical data
      if (leadsNeedingBasic.length > 0) {
        console.log("Starting Tier 1: Basic enrichment with sonar-small");
        
        // Process in batches of 5 to respect rate limits
        for (let i = 0; i < leadsNeedingBasic.length; i += 5) {
          const batch = leadsNeedingBasic.slice(i, i + 5);
          
          const basicPromises = batch.map(async (lead) => {
            try {
              const basicPrompt = `Quick facts about ${lead.name}${lead.website ? ` (${lead.website})` : ''}:

Return ONLY a JSON object with:
- website: official website URL (if missing)
- description: one clear sentence about what they do
- employeeCount: estimated number of employees (number)
- generalEmail: general contact email if publicly available

Return ONLY valid JSON, no markdown.`;

              const response = await fetch(`${supabaseUrl}/functions/v1/ai-provider`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${supabaseAnonKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  provider: 'perplexity',
                  model: 'sonar-small',
                  messages: [
                    { role: 'system', content: 'Return only valid JSON, no markdown.' },
                    { role: 'user', content: basicPrompt },
                  ],
                  temperature: 0.2,
                  traceId: trace.id,
                }),
              });

              if (response.ok) {
                const result = await response.json();
                let enrichedData: any = {};
                
                try {
                  let cleaned = result.content.trim()
                    .replace(/```json\n?/g, "").replace(/```\n?/g, "");
                  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
                  if (jsonMatch) enrichedData = JSON.parse(jsonMatch[0]);
                } catch (e) {
                  console.error("Basic enrichment parse error:", lead.name);
                }

                lead.website = enrichedData.website || lead.website;
                lead.description = enrichedData.description || lead.description;
                lead.employeeCount = enrichedData.employeeCount || lead.employeeCount;
                lead.generalEmail = enrichedData.generalEmail || lead.generalEmail;
                lead.enrichmentTier = 'basic';
                
                if (result.usage) {
                  totalEnrichmentTokens += result.usage.totalTokens || 0;
                  totalEnrichmentCost += result.usage.estimatedCost || 0;
                }
              }
            } catch (error) {
              console.error("Basic enrichment error:", lead.name, error);
            }
          });

          await Promise.all(basicPromises);
          
          // Rate limiting: 1 second delay between batches
          if (i + 5 < leadsNeedingBasic.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      // TIER 2: Deep enrichment for high-quality leads
      if (leadsForDeep.length > 0) {
        console.log("Starting Tier 2: Deep enrichment with sonar");
        
        // Process in batches of 5
        for (let i = 0; i < leadsForDeep.length; i += 5) {
          const batch = leadsForDeep.slice(i, i + 5);
          
          const deepPromises = batch.map(async (lead) => {
            try {
              const deepPrompt = `Comprehensive research on ${lead.name}${lead.website ? ` (${lead.website})` : ''}:

Return a JSON object with:
- description: detailed company overview (3-4 sentences)
- products: key products/services offered
- recentNews: latest significant news or developments (last 6 months)
- fundingInfo: recent funding details if available
- employeeCount: current employee count (number)
- companyPhone: main phone number (international format)
- generalEmail: general contact email
- socialProfiles: object with linkedin, twitter, facebook URLs
- keyExecutives: top 3 executives with name and title [{name, title}]
- technologies: main technologies or platforms they use

Return ONLY valid JSON, no markdown.`;

              const response = await fetch(`${supabaseUrl}/functions/v1/ai-provider`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${supabaseAnonKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  provider: 'perplexity',
                  model: 'sonar',
                  messages: [
                    { role: 'system', content: 'You are a company research assistant. Return only valid JSON, no markdown.' },
                    { role: 'user', content: deepPrompt },
                  ],
                  temperature: 0.2,
                  traceId: trace.id,
                }),
              });

              if (response.ok) {
                const result = await response.json();
                let enrichedData: any = {};
                
                try {
                  let cleaned = result.content.trim()
                    .replace(/```json\n?/g, "").replace(/```\n?/g, "");
                  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
                  if (jsonMatch) enrichedData = JSON.parse(jsonMatch[0]);
                } catch (e) {
                  console.error("Deep enrichment parse error:", lead.name);
                }

                // Merge enriched data (preserve existing if enrichment is empty)
                lead.description = enrichedData.description || lead.description;
                lead.products = enrichedData.products || lead.products;
                lead.recentNews = enrichedData.recentNews || lead.recentNews;
                lead.fundingInfo = enrichedData.fundingInfo || lead.fundingInfo;
                lead.employeeCount = enrichedData.employeeCount || lead.employeeCount;
                lead.companyPhone = enrichedData.companyPhone || lead.companyPhone;
                lead.generalEmail = enrichedData.generalEmail || lead.generalEmail;
                lead.socialProfiles = enrichedData.socialProfiles || lead.socialProfiles;
                lead.keyExecutives = enrichedData.keyExecutives || lead.keyExecutives;
                lead.technologies = enrichedData.technologies || lead.technologies;
                lead.enrichmentTier = 'deep';
                
                if (result.usage) {
                  totalEnrichmentTokens += result.usage.totalTokens || 0;
                  totalEnrichmentCost += result.usage.estimatedCost || 0;
                }
              }
            } catch (error) {
              console.error("Deep enrichment error:", lead.name, error);
            }
          });

          await Promise.all(deepPromises);
          
          // Rate limiting: 1 second delay between batches
          if (i + 5 < leadsForDeep.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      enrichmentUsage = {
        promptTokens: 0,
        completionTokens: totalEnrichmentTokens,
        totalTokens: totalEnrichmentTokens,
        estimatedCost: totalEnrichmentCost,
      };

      const enrichedCount = leadsNeedingBasic.length + leadsForDeep.length;
      console.log(`Enrichment complete. Enriched ${enrichedCount} leads. Total cost: $${totalEnrichmentCost.toFixed(4)}`);
      await endSpan(enrichmentSpan, { 
        basicEnriched: leadsNeedingBasic.length,
        deepEnriched: leadsForDeep.length,
        totalCost: totalEnrichmentCost
      });
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
              enrichment_provider: extractionProvider,
              enrichment_model: extractionModel,
              langfuse_trace_id: trace.id,
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
        provider: extractionProvider,
        model: extractionModel,
        usage: totalUsage,
        enrichmentUsage,
        wasEnriched: enrichWithPerplexity,
        traceUrl: `https://cloud.langfuse.com/trace/${trace.id}`,
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
