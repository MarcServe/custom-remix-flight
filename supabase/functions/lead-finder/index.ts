import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createTrace, createSpan, endSpan } from '../_shared/langfuse.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Helper: Deduplication by URL and normalized company name
function deduplicateResults(results: any[]): any[] {
  const seen = new Map<string, any>();
  
  return results.filter(result => {
    if (!result.url && !result.title) return false;
    
    let key = '';
    if (result.url) {
      try {
        const url = new URL(result.url);
        key = url.hostname.replace('www.', '') + url.pathname.replace(/\/$/, '');
      } catch {
        key = result.url.toLowerCase();
      }
    } else if (result.title) {
      key = result.title
        .toLowerCase()
        .replace(/\b(inc|llc|ltd|corp|corporation|limited|company|co)\b\.?/g, '')
        .replace(/[^\w\s]/g, '')
        .trim();
    }
    
    if (seen.has(key)) {
      const existing = seen.get(key);
      const existingLength = (existing.text || '').length;
      const currentLength = (result.text || '').length;
      
      if (currentLength > existingLength) {
        seen.set(key, result);
        return false;
      }
      return false;
    }
    
    seen.set(key, result);
    return true;
  });
}

// Helper: Calculate data completeness score
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

// Helper: Calculate final quality score
const calculateFinalQualityScore = (lead: any) => {
  let score = 0;
  
  // Core data (max 40)
  if (lead.website) score += 15;
  if (lead.linkedinUrl) score += 15;
  if (lead.description && lead.description.length > 50) score += 10;
  
  // Contact info (max 40)
  if (lead.contacts && lead.contacts.length > 0) {
    score += 20;
    if (lead.contacts.some((c: any) => c.emailVerified)) score += 5;
    if (lead.contacts.length > 1) score += 5;
  }
  if (lead.generalEmail) score += 5;
  if (lead.companyPhone) score += 5;
  
  // Enrichment (max 20)
  if (lead.keyExecutives && lead.keyExecutives.length > 0) score += 5;
  if (lead.recentNews) score += 3;
  if (lead.fundingInfo) score += 3;
  if (lead.socialProfiles && Object.keys(lead.socialProfiles).length > 0) score += 3;
  if (lead.products) score += 3;
  if (lead.technologies) score += 3;
  
  return Math.min(score, 100);
};

// Helper: Deduplicate leads by name/domain
const deduplicateLeads = (leads: any[]) => {
  const seen = new Map();
  
  return leads.filter(lead => {
    if (!lead.name) return false;
    
    const normalizedName = lead.name.toLowerCase()
      .replace(/\b(inc|llc|ltd|corp|corporation|limited|company|co)\b\.?/g, '')
      .replace(/[^\w\s]/g, '')
      .trim();
    
    let domain = null;
    if (lead.website) {
      try {
        const url = new URL(lead.website.startsWith('http') ? lead.website : `https://${lead.website}`);
        domain = url.hostname.replace('www.', '');
      } catch {}
    }
    
    const key = domain || normalizedName;
    
    if (seen.has(key)) {
      const existing = seen.get(key);
      const existingScore = calculateDataCompleteness(existing);
      const currentScore = calculateDataCompleteness(lead);
      
      if (currentScore > existingScore) {
        seen.set(key, lead);
        return false;
      }
      return false;
    }
    
    seen.set(key, lead);
    return true;
  });
};

// Helper: Enrich batch with Perplexity (original synchronous version)
async function enrichBatch(leads: any[], supabaseUrl: string, supabaseAnonKey: string, traceId: string) {
  const needsBasic = leads.filter(l => !l.website || !l.description || l.description.length < 30);
  const needsDeep = leads.filter(l => l.qualityScore >= 50 && !needsBasic.includes(l));

  for (const lead of needsBasic) {
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/ai-provider`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${supabaseAnonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'perplexity',
          model: 'sonar-small',
          messages: [
            { role: 'system', content: 'Return only valid JSON, no markdown.' },
            { role: 'user', content: `Quick facts about ${lead.name}${lead.website ? ` (${lead.website})` : ''}: Return JSON with: website, description, employeeCount, generalEmail` },
          ],
          temperature: 0.2,
          traceId,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        try {
          const cleaned = result.content.trim().replace(/```json\n?/g, "").replace(/```\n?/g, "");
          const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const enrichedData = JSON.parse(jsonMatch[0]);
            lead.website = enrichedData.website || lead.website;
            lead.description = enrichedData.description || lead.description;
            lead.employeeCount = enrichedData.employeeCount || lead.employeeCount;
            lead.generalEmail = enrichedData.generalEmail || lead.generalEmail;
            lead.enrichmentTier = 'basic';
          }
        } catch {}
      }
    } catch (error) {
      console.error("Basic enrichment error:", lead.name);
    }
  }

  for (const lead of needsDeep.slice(0, 3)) { // Limit deep enrichment to 3 per batch
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/ai-provider`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${supabaseAnonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'perplexity',
          model: 'sonar',
          messages: [
            { role: 'system', content: 'Return only valid JSON, no markdown.' },
            { role: 'user', content: `Detailed research on ${lead.name}: Return JSON with: description, products, recentNews, fundingInfo, employeeCount, companyPhone, generalEmail, socialProfiles, keyExecutives, technologies` },
          ],
          temperature: 0.2,
          traceId,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        try {
          const cleaned = result.content.trim().replace(/```json\n?/g, "").replace(/```\n?/g, "");
          const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const enrichedData = JSON.parse(jsonMatch[0]);
            Object.assign(lead, {
              description: enrichedData.description || lead.description,
              products: enrichedData.products || lead.products,
              recentNews: enrichedData.recentNews || lead.recentNews,
              fundingInfo: enrichedData.fundingInfo || lead.fundingInfo,
              enrichmentTier: 'deep',
            });
          }
        } catch {}
      }
    } catch (error) {
      console.error("Deep enrichment error:", lead.name);
    }
  }
}

// PHASE 2: Progressive enrichment with streaming updates
async function enrichBatchProgressively(
  leads: any[],
  supabaseUrl: string,
  supabaseAnonKey: string,
  traceId: string,
  batchNumber: number,
  sendEvent: (data: any) => Promise<void>
) {
  const needsBasic = leads.filter(l => !l.website || !l.description || l.description.length < 30);
  const needsDeep = leads.filter(l => l.qualityScore >= 50 && !needsBasic.includes(l));

  // Enrich leads that need basic enrichment
  for (let i = 0; i < needsBasic.length; i++) {
    const lead = needsBasic[i];
    
    try {
      lead.enrichmentStatus = 'enriching';
      await sendEvent({
        type: 'enrichment-status',
        leadName: lead.name,
        leadIndex: i,
        totalLeads: needsBasic.length,
        batchNumber,
        status: 'enriching',
        message: `Enriching ${lead.name} (${i + 1}/${needsBasic.length})...`
      });

      const response = await fetch(`${supabaseUrl}/functions/v1/ai-provider`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${supabaseAnonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'perplexity',
          model: 'sonar-small',
          messages: [
            { role: 'system', content: 'Return only valid JSON, no markdown.' },
            { role: 'user', content: `Quick facts about ${lead.name}${lead.website ? ` (${lead.website})` : ''}: Return JSON with: website, description, employeeCount, generalEmail` },
          ],
          temperature: 0.2,
          traceId,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        try {
          const cleaned = result.content.trim().replace(/```json\n?/g, "").replace(/```\n?/g, "");
          const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const enrichedData = JSON.parse(jsonMatch[0]);
            lead.website = enrichedData.website || lead.website;
            lead.description = enrichedData.description || lead.description;
            lead.employeeCount = enrichedData.employeeCount || lead.employeeCount;
            lead.generalEmail = enrichedData.generalEmail || lead.generalEmail;
            lead.enrichmentTier = 'basic';
            lead.wasEnriched = true;
          }
        } catch {}
      }

      // Recalculate scores after enrichment
      lead.qualityScore = calculateFinalQualityScore(lead);
      lead.dataCompleteness = calculateDataCompleteness(lead);
      lead.enrichmentStatus = 'completed';

      // Stream the enriched lead update
      await sendEvent({
        type: 'lead-update',
        lead: lead,
        updateType: 'enrichment',
        batchNumber
      });
    } catch (error) {
      console.error(`Basic enrichment error for ${lead.name}:`, error);
      lead.enrichmentStatus = 'completed';
    }
  }

  // Deep enrichment for high-quality leads
  const deepEnrichmentLeads = needsDeep.slice(0, 3); // Limit to 3 per batch
  for (let i = 0; i < deepEnrichmentLeads.length; i++) {
    const lead = deepEnrichmentLeads[i];
    
    try {
      lead.enrichmentStatus = 'enriching';
      await sendEvent({
        type: 'enrichment-status',
        leadName: lead.name,
        leadIndex: i,
        totalLeads: deepEnrichmentLeads.length,
        batchNumber,
        status: 'deep-enriching',
        message: `Deep enriching ${lead.name} (${i + 1}/${deepEnrichmentLeads.length})...`
      });

      const response = await fetch(`${supabaseUrl}/functions/v1/ai-provider`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${supabaseAnonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'perplexity',
          model: 'sonar',
          messages: [
            { role: 'system', content: 'Return only valid JSON, no markdown.' },
            { role: 'user', content: `Detailed research on ${lead.name}: Return JSON with: description, products, recentNews, fundingInfo, employeeCount, companyPhone, generalEmail, socialProfiles, keyExecutives, technologies` },
          ],
          temperature: 0.2,
          traceId,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        try {
          const cleaned = result.content.trim().replace(/```json\n?/g, "").replace(/```\n?/g, "");
          const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const enrichedData = JSON.parse(jsonMatch[0]);
            Object.assign(lead, {
              description: enrichedData.description || lead.description,
              products: enrichedData.products || lead.products,
              recentNews: enrichedData.recentNews || lead.recentNews,
              fundingInfo: enrichedData.fundingInfo || lead.fundingInfo,
              employeeCount: enrichedData.employeeCount || lead.employeeCount,
              companyPhone: enrichedData.companyPhone || lead.companyPhone,
              generalEmail: enrichedData.generalEmail || lead.generalEmail,
              socialProfiles: enrichedData.socialProfiles || lead.socialProfiles,
              keyExecutives: enrichedData.keyExecutives || lead.keyExecutives,
              enrichmentTier: 'deep',
              wasEnriched: true,
            });
          }
        } catch {}
      }

      // Recalculate scores after deep enrichment
      lead.qualityScore = calculateFinalQualityScore(lead);
      lead.dataCompleteness = calculateDataCompleteness(lead);
      lead.enrichmentStatus = 'completed';

      // Stream the deep-enriched lead update
      await sendEvent({
        type: 'lead-update',
        lead: lead,
        updateType: 'deep-enrichment',
        batchNumber
      });
    } catch (error) {
      console.error(`Deep enrichment error for ${lead.name}:`, error);
      lead.enrichmentStatus = 'completed';
    }
  }

  console.log(`Enrichment complete for batch ${batchNumber}`);
}

// Helper: Find contacts for batch
async function findContactsForBatch(leads: any[], getProspectKey: string, supabaseUrl: string, supabaseAnonKey: string, traceId: string) {
  const targetRoles = ['CEO', 'CTO', 'CMO', 'Founder', 'Co-Founder'];

  for (const lead of leads) {
    const contacts: any[] = [];
    
    try {
      // Try GetProspect LinkedIn
      if (lead.linkedinUrl && contacts.length < 2) {
        try {
          const response = await fetch(
            `https://api.getprospect.com/public/v1/insights/contact?linkedinUrl=${encodeURIComponent(lead.linkedinUrl)}&apiKey=${getProspectKey}`,
            { signal: AbortSignal.timeout(4000) }
          );
          
          if (response.ok) {
            const data = await response.json();
            if (data.contacts) {
              contacts.push(...data.contacts.slice(0, 2).map((c: any) => ({
                name: c.name,
                email: c.email,
                emailVerified: c.emailStatus === 'valid',
                title: c.title,
                companyName: lead.name,
                source: 'getprospect'
              })));
            }
          }
        } catch {}
      }

      // Try GetProspect by role
      if (contacts.length < 2) {
        for (const role of targetRoles.slice(0, 3)) {
          if (contacts.length >= 2) break;
          try {
            const response = await fetch(
              `https://api.getprospect.com/public/v1/email/find?name=${encodeURIComponent(role)}&company=${encodeURIComponent(lead.name)}&apiKey=${getProspectKey}`,
              { signal: AbortSignal.timeout(3000) }
            );
            if (response.ok) {
              const data = await response.json();
              if (data.email) {
                contacts.push({
                  name: data.name || role,
                  email: data.email,
                  emailVerified: false,
                  title: role,
                  companyName: lead.name,
                  source: 'getprospect'
                });
              }
            }
          } catch {}
        }
      }

      // Pattern-based fallback
      if (contacts.length === 0 && lead.website && lead.keyExecutives?.length > 0) {
        const exec = lead.keyExecutives[0];
        const nameParts = exec.name.split(' ');
        if (nameParts.length >= 2) {
          try {
            const url = new URL(lead.website.startsWith('http') ? lead.website : `https://${lead.website}`);
            const domain = url.hostname.replace('www.', '');
            const email = `${nameParts[0]}.${nameParts[nameParts.length - 1]}@${domain}`.toLowerCase();
            contacts.push({
              name: exec.name,
              email,
              emailVerified: false,
              title: exec.title,
              companyName: lead.name,
              source: 'pattern-guess',
              note: 'Email pattern generated - not verified'
            });
          } catch {}
        }
      }
    } catch (error) {
      console.error(`Contact error for ${lead.name}:`, error);
    }

    lead.contacts = contacts;
    lead.primaryContact = contacts.find(c => c.emailVerified) || contacts[0] || null;
    lead.contactCount = contacts.length;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const { size, geography, industry, dryRun, provider, model, enrichWithPerplexity } = await req.json();
  console.log("Lead Finder STREAMING:", { size, geography, industry, dryRun, provider, model, enrichWithPerplexity });

  // Create SSE stream
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();

  const sendEvent = async (data: any) => {
    try {
      await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
    } catch (error) {
      console.error("SSE send error:", error);
    }
  };

  // Process in background and stream results
  (async () => {
    try {
      await sendEvent({ type: 'status', message: 'Initializing search...', progress: 5 });

      const trace = createTrace('lead-finder', undefined, { size, geography, industry });
      const EXA_API_KEY = Deno.env.get("EXA_API_KEY");
      if (!EXA_API_KEY) throw new Error("Missing EXA_API_KEY");

      // PHASE 1: Exa Search
      await sendEvent({ type: 'status', message: 'Searching with Exa AI...', progress: 10 });
      const exaSpan = createSpan(trace, 'exa-search');

      let industryContext = industry;
      let mainCategory = '';
      if (industry.includes('(') && industry.includes(')')) {
        const match = industry.match(/^(.+?)\s*\((.+?)\)$/);
        if (match) {
          industryContext = match[1].trim();
          mainCategory = match[2].trim();
        }
      }

      const exaQueries = [
        `${industryContext} companies in ${geography} with approximately ${size} employees`,
        `site:linkedin.com/company ${industryContext} ${geography} ${size}`,
        `${industryContext} company directory ${geography} industry list`,
        `${industryContext} company news ${geography} 2024 2025`
      ];

      const exaPromises = exaQueries.map(query =>
        fetch("https://api.exa.ai/search", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": String(EXA_API_KEY).trim() },
          body: JSON.stringify({
            query,
            numResults: 20,
            useAutoprompt: true,
            type: "keyword",
            includeDomains: ["linkedin.com", "crunchbase.com"],
            contents: { text: { maxCharacters: 2000, includeHtmlTags: false } }
          }),
        }).then(r => r.ok ? r.json() : { results: [] }).catch(() => ({ results: [] }))
      );

      const exaResponses = await Promise.all(exaPromises);
      let allResults: any[] = [];
      exaResponses.forEach(r => { if (r.results) allResults.push(...r.results); });

      const deduplicatedResults = deduplicateResults(allResults);
      console.log(`Found ${deduplicatedResults.length} unique companies`);
      await endSpan(exaSpan, { totalResults: allResults.length, uniqueResults: deduplicatedResults.length });

      await sendEvent({ type: 'status', message: `Found ${deduplicatedResults.length} companies. Processing...`, progress: 20 });

      // PHASE 2: Batch Processing (10 at a time)
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const GETPROSPECT_API_KEY = Deno.env.get("GETPROSPECT_API_KEY");
      
      const batchSize = 10;
      const batches: any[][] = [];
      for (let i = 0; i < deduplicatedResults.length; i += batchSize) {
        batches.push(deduplicatedResults.slice(i, i + batchSize));
      }

      const industryGuidance = mainCategory 
        ? `Focus on companies in the ${industryContext} sector within ${mainCategory}.`
        : `Focus on companies in ${industryContext}.`;

      const createPrompt = (batch: any[]) => `Extract company info from these results. ${industryGuidance}

CRITICAL: Extract ALL companies, even with incomplete data. Deduplicate by name. Required: name, website, description, industry ("${industryContext}"), size ("${size}"), geography ("${geography}"), linkedinUrl, foundingYear, revenue. Optional: companyPhone, generalEmail, keyExecutives, fundingStage, technologies, employeeCount.

Return ONLY a JSON array, no markdown:
${JSON.stringify(batch, null, 2)}`;

      let allLeads: any[] = [];
      let totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCost: 0 };
      let extractionProvider = provider || 'lovable';
      let extractionModel = model || 'unknown';
      const backgroundTasks: Promise<void>[] = []; // Track background enrichment tasks

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        try {
          const progressPercent = 20 + Math.floor((batchIndex / batches.length) * 60);
          await sendEvent({ type: 'status', message: `Processing batch ${batchIndex + 1}/${batches.length}...`, progress: progressPercent });

          // Extract
          const aiResponse = await fetch(`${supabaseUrl}/functions/v1/ai-provider`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${supabaseAnonKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              provider: provider || 'lovable',
              model,
              messages: [
                { role: 'system', content: 'Return only valid JSON arrays, no markdown.' },
                { role: 'user', content: createPrompt(batches[batchIndex]) }
              ],
              temperature: 0.3,
              traceId: trace.id,
            }),
          });

          if (!aiResponse.ok) continue;

          const aiResult = await aiResponse.json();
          let cleanedText = aiResult.content.trim().replace(/```json\n?/g, "").replace(/```\n?/g, "");
          
          let batchLeads: any[] = [];
          try {
            batchLeads = JSON.parse(cleanedText);
            if (!Array.isArray(batchLeads)) batchLeads = [];
          } catch {
            continue;
          }

          if (batchIndex === 0) {
            extractionProvider = aiResult.provider || provider || 'lovable';
            extractionModel = aiResult.model || model || 'unknown';
          }

          if (aiResult.usage) {
            totalUsage.promptTokens += aiResult.usage.promptTokens || 0;
            totalUsage.completionTokens += aiResult.usage.completionTokens || 0;
            totalUsage.totalTokens += aiResult.usage.totalTokens || 0;
            totalUsage.estimatedCost += aiResult.usage.estimatedCost || 0;
          }

          // PHASE 1: Calculate basic scores immediately (without enrichment)
          batchLeads.forEach(lead => {
            lead.qualityScore = calculateFinalQualityScore(lead);
            lead.dataCompleteness = calculateDataCompleteness(lead);
            lead.enrichmentStatus = enrichWithPerplexity ? 'pending' : 'skipped';
            lead.contactSearchStatus = GETPROSPECT_API_KEY ? 'pending' : 'skipped';
          });

          const qualifiedLeads = batchLeads.filter(l => l.qualityScore >= 25);
          allLeads.push(...qualifiedLeads);

          // PHASE 1: STREAM BATCH IMMEDIATELY
          if (qualifiedLeads.length > 0) {
            await sendEvent({
              type: 'batch',
              leads: qualifiedLeads,
              batchNumber: batchIndex + 1,
              totalBatches: batches.length
            });
          }

          // PHASE 2: Start enrichment in background (non-blocking)
          if (enrichWithPerplexity && qualifiedLeads.length > 0) {
            const enrichmentTask = enrichBatchProgressively(
              qualifiedLeads,
              supabaseUrl,
              supabaseAnonKey,
              trace.id,
              batchIndex + 1,
              sendEvent
            ).catch(err => {
              console.error(`Enrichment error for batch ${batchIndex + 1}:`, err);
            });
            backgroundTasks.push(enrichmentTask);
          }
        } catch (error) {
          console.error(`Batch ${batchIndex + 1} error:`, error);
        }
      }

      // Notify that extraction is complete
      await sendEvent({
        type: 'extraction-complete',
        message: 'All companies extracted. Enrichment continues in background...',
        progress: 80
      });

      // PHASE 2: Wait for all background enrichment tasks to complete
      if (backgroundTasks.length > 0) {
        console.log(`Waiting for ${backgroundTasks.length} enrichment tasks to complete...`);
        await Promise.allSettled(backgroundTasks);
        console.log('All enrichment tasks completed');
      }

      // Final deduplication
      const leads = deduplicateLeads(allLeads);
      console.log(`Final: ${leads.length} unique leads`);

      // Stats
      const stats = {
        totalFound: leads.length,
        returned: leads.length,
        filtered: allLeads.length - leads.length,
        withContacts: leads.filter(l => l.contacts?.length > 0).length,
        withLinkedIn: leads.filter(l => l.linkedinUrl).length,
        highQuality: leads.filter(l => l.qualityScore >= 70).length,
        averageScore: leads.reduce((sum, l) => sum + l.qualityScore, 0) / leads.length || 0
      };

      // Database insertion in background (non-blocking)
      // Note: We send insertedCount as 0 initially, DB insertion happens asynchronously
      // Helper functions to parse funding info
      const extractFundingStage = (fundingInfo: string): string | null => {
        const stageMatch = fundingInfo.match(/(Seed|Pre-Seed|Series [A-Z]|IPO|Private|Bootstrapped)/i);
        return stageMatch ? stageMatch[0] : null;
      };

      const extractFundingTotal = (fundingInfo: string): string | null => {
        const amountMatch = fundingInfo.match(/\$[\d.]+[KMB]/i);
        return amountMatch ? amountMatch[0] : null;
      };

      const insertPromise = !dryRun && leads.length > 0 ? (async () => {
        let count = 0;
        try {
          const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
          const supabase = createClient(supabaseUrl, supabaseServiceKey);

          for (const lead of leads) {
            try {
              const { data, error } = await supabase.from("companies").upsert({
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
                recent_news: lead.recentNews || null,
                tech_stack: lead.technologies || lead.techStack || null,
                funding_stage: lead.fundingInfo ? extractFundingStage(lead.fundingInfo) : null,
                funding_total: lead.fundingInfo ? extractFundingTotal(lead.fundingInfo) : null,
                enrichment_data: (lead.products || lead.fundingInfo || lead.technologies || lead.recentNews) ? {
                  products: lead.products || null,
                  fundingInfo: lead.fundingInfo || null,
                  recentNews: lead.recentNews || null,
                  technologies: lead.technologies || lead.techStack || null,
                  enrichmentTier: lead.enrichmentTier || null,
                } : null,
                status: "NEW",
                enriched_at: new Date().toISOString(),
                enrichment_status: (lead.wasEnriched || lead.enrichmentTier) ? 'completed' : 'pending',
                enrichment_provider: extractionProvider,
                enrichment_model: extractionModel,
                langfuse_trace_id: trace.id,
              }, { onConflict: "website", ignoreDuplicates: false }).select();

              if (!error && data && data.length > 0) {
                count++;
                const companyId = data[0].id;
                
                if (lead.contacts?.length > 0) {
                  for (const contact of lead.contacts) {
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
                  }
                }
              }
            } catch {}
          }
          console.log(`Inserted ${count} companies in background`);
        } catch (error) {
          console.error("Background DB insertion error:", error);
        }
      })() : null;
      
      // Don't await - let it run in background
      if (insertPromise) insertPromise.catch(console.error);

      // Send complete event
      await sendEvent({
        type: 'complete',
        stats,
        inserted: 0, // DB insertion happens asynchronously in background
        dryRun,
        provider: extractionProvider,
        model: extractionModel,
        usage: totalUsage,
        wasEnriched: enrichWithPerplexity,
        traceUrl: `https://cloud.langfuse.com/trace/${trace.id}`
      });

      await writer.close();
    } catch (error) {
      console.error("Stream processing error:", error);
      await sendEvent({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
      await writer.close();
    }
  })();

  // Return streaming response
  return new Response(stream.readable, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
});
