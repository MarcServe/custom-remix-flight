import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface Persona {
  id: string;
  name: string;
  target_industries: string[] | null;
  target_geographies: string[] | null;
  target_company_sizes: string[] | null;
  target_keywords: string[] | null;
  custom_search_query: string | null;
  exclude_industries: string[] | null;
  exclude_keywords: string[] | null;
  auto_enroll_sequence_id: string | null;
  is_active: boolean;
}

interface SourceResult {
  source: string;
  leads: any[];
  error?: string;
}

interface DiscoveryStats {
  totalLeads: number;
  bySource: Record<string, number>;
  autoApproved: number;
  pending: number;
  enriched: number;
  campaignsCreated: number;
}

/**
 * Super Discovery Engine - Multi-source parallel lead discovery
 * Combines Exa AI, SerpAPI, and Apify for maximum lead coverage
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[super-discovery] Starting multi-source discovery run');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Check if this is a manual trigger for a specific user
  let manualUserId: string | null = null;
  let forceRun = false;
  
  try {
    const body = await req.json().catch(() => ({}));
    manualUserId = body.userId || null;
    forceRun = body.forceRun || false;
    
    if (manualUserId) {
      console.log(`[super-discovery] Manual trigger for user: ${manualUserId}`);
    }
  } catch {
    // Not a manual trigger, continue with cron behavior
  }

  try {
    // Get all users with enabled autonomous discovery
    let settingsQuery = supabase
      .from('autonomous_discovery_settings')
      .select('*')
      .eq('enabled', true);
    
    // If manual trigger, filter to specific user
    if (manualUserId) {
      settingsQuery = supabase
        .from('autonomous_discovery_settings')
        .select('*')
        .eq('user_id', manualUserId);
    }

    const { data: settings, error: settingsError } = await settingsQuery;

    if (settingsError) {
      console.error('[super-discovery] Error fetching settings:', settingsError);
      throw settingsError;
    }

    if (!settings || settings.length === 0) {
      console.log('[super-discovery] No users with enabled autonomous discovery');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No users with enabled autonomous discovery',
        processed: 0 
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[super-discovery] Found ${settings.length} users with enabled discovery`);

    let processedCount = 0;
    let totalLeadsDiscovered = 0;
    const allStats: DiscoveryStats[] = [];

    for (const setting of settings) {
      try {
        // Check if it's time to run based on frequency (skip for manual triggers with forceRun)
        if (!forceRun && !manualUserId) {
          const shouldRun = shouldRunDiscovery(setting);
          if (!shouldRun) {
            console.log(`[super-discovery] Skipping user ${setting.user_id} - not scheduled to run yet`);
            continue;
          }
        }

        console.log(`[super-discovery] Processing user ${setting.user_id}`);

        // Get user's business profile for context
        const { data: businessProfile } = await supabase
          .from('business_profiles')
          .select('*')
          .eq('user_id', setting.user_id)
          .single();

        // Get active personas for this user
        const { data: personas, error: personasError } = await supabase
          .from('discovery_personas')
          .select('*')
          .eq('user_id', setting.user_id)
          .eq('is_active', true)
          .order('priority', { ascending: false });

        if (personasError) {
          console.error(`[super-discovery] Error fetching personas for user ${setting.user_id}:`, personasError);
        }

        const activePersonas = (personas || []) as Persona[];
        console.log(`[super-discovery] Found ${activePersonas.length} active personas for user ${setting.user_id}`);

        // Generate discovery run ID
        const discoveryRunId = crypto.randomUUID();

        // Initialize stats for this user
        const userStats: DiscoveryStats = {
          totalLeads: 0,
          bySource: {},
          autoApproved: 0,
          pending: 0,
          enriched: 0,
          campaignsCreated: 0,
        };

        // If user has personas, run discovery for each persona
        if (activePersonas.length > 0) {
          for (const persona of activePersonas) {
            console.log(`[super-discovery] Processing persona: ${persona.name} (${persona.id})`);
            
            const personaStats = await discoverLeadsForPersona(
              supabase,
              setting,
              persona,
              businessProfile,
              discoveryRunId
            );
            
            // Merge stats
            userStats.totalLeads += personaStats.totalLeads;
            userStats.autoApproved += personaStats.autoApproved;
            userStats.pending += personaStats.pending;
            userStats.enriched += personaStats.enriched;
            
            for (const [source, count] of Object.entries(personaStats.bySource)) {
              userStats.bySource[source] = (userStats.bySource[source] || 0) + count;
            }
            
            // Update persona metrics
            if (personaStats.totalLeads > 0) {
              await supabase
                .from('discovery_personas')
                .update({
                  total_leads_found: (persona as any).total_leads_found + personaStats.totalLeads,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', persona.id);
            }
          }
        } else {
          // Fall back to main settings-based discovery (legacy behavior)
          console.log(`[super-discovery] No active personas, using main settings for user ${setting.user_id}`);
          
          const searchQuery = buildSearchQuery(setting, businessProfile);
          const leadStats = await runMultiSourceDiscovery(supabase, setting, searchQuery, null, discoveryRunId);
          
          userStats.totalLeads = leadStats.totalLeads;
          userStats.bySource = leadStats.bySource;
          userStats.autoApproved = leadStats.autoApproved;
          userStats.pending = leadStats.pending;
          userStats.enriched = leadStats.enriched;
        }

        // Auto-create campaign if enabled
        if (setting.auto_create_campaign && userStats.autoApproved > 0) {
          const campaignsCreated = await createAutoCampaigns(supabase, setting, discoveryRunId);
          userStats.campaignsCreated = campaignsCreated;
        }

        totalLeadsDiscovered += userStats.totalLeads;
        allStats.push(userStats);

        // Update last_run_at and next_run_at
        const nextRunAt = calculateNextRun(setting.discovery_frequency);
        await supabase
          .from('autonomous_discovery_settings')
          .update({ 
            last_run_at: new Date().toISOString(),
            next_run_at: nextRunAt.toISOString(),
          })
          .eq('user_id', setting.user_id);

        processedCount++;
        console.log(`[super-discovery] Completed processing for user ${setting.user_id}. Stats:`, JSON.stringify(userStats));

        // Send summary webhook notification
        if (setting.webhook_enabled && setting.webhook_url && userStats.totalLeads > 0) {
          await sendSummaryWebhook(setting.webhook_url, userStats);
        }

        // Send discovery summary email
        if (userStats.totalLeads > 0) {
          try {
            await fetch(`${SUPABASE_URL}/functions/v1/send-discovery-summary`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                userId: setting.user_id,
                discoveryRunId,
                stats: userStats,
              }),
            });
            console.log(`[super-discovery] Summary email sent for user ${setting.user_id}`);
          } catch (emailError) {
            console.error(`[super-discovery] Failed to send summary email:`, emailError);
          }
        }

      } catch (userError) {
        console.error(`[super-discovery] Error processing user ${setting.user_id}:`, userError);
      }
    }

    console.log(`[super-discovery] Discovery run complete. Processed: ${processedCount}, Total leads: ${totalLeadsDiscovered}`);

    return new Response(JSON.stringify({ 
      success: true,
      processed: processedCount,
      leadsDiscovered: totalLeadsDiscovered,
      stats: allStats,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[super-discovery] Fatal error:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});

/**
 * Discover leads for a specific persona using all enabled sources
 */
async function discoverLeadsForPersona(
  supabase: any,
  setting: any,
  persona: Persona,
  businessProfile: any,
  discoveryRunId: string
): Promise<DiscoveryStats> {
  // Build search query from persona
  const searchQuery = buildPersonaSearchQuery(persona, businessProfile);
  
  console.log(`[super-discovery] Persona "${persona.name}" search query: ${searchQuery}`);
  
  return await runMultiSourceDiscovery(supabase, setting, searchQuery, persona, discoveryRunId);
}

/**
 * Run parallel multi-source discovery
 */
async function runMultiSourceDiscovery(
  supabase: any,
  setting: any,
  searchQuery: string,
  persona: Persona | null,
  discoveryRunId: string
): Promise<DiscoveryStats> {
  const stats: DiscoveryStats = {
    totalLeads: 0,
    bySource: {},
    autoApproved: 0,
    pending: 0,
    enriched: 0,
    campaignsCreated: 0,
  };

  // Calculate leads per source based on target and enabled sources
  const dailyTarget = setting.daily_lead_target || 50;
  const enabledSources = [
    setting.use_serp_api !== false, // EXA + SerpAPI via lead-finder
    setting.use_apify === true,     // Apify Google Maps
  ].filter(Boolean).length + 1; // +1 for Exa (always on)

  const leadsPerSource = Math.ceil(dailyTarget / enabledSources);

  // Prepare parallel source calls
  const sourcePromises: Promise<SourceResult>[] = [];

  // Source 1: Lead Finder (Exa + SerpAPI combined)
  sourcePromises.push(
    runLeadFinder(supabase, setting, searchQuery, persona, leadsPerSource)
      .then(leads => ({ source: 'lead-finder', leads }))
      .catch(error => ({ source: 'lead-finder', leads: [], error: error.message }))
  );

  // Source 2: Apify Google Maps (if enabled and has location context)
  if (setting.use_apify) {
    const location = persona?.target_geographies?.[0] || 
                     setting.target_geographies?.[0] || 
                     'United States';
    const apifyQuery = persona?.target_keywords?.[0] || 
                       buildApifyQuery(persona, setting, searchQuery);
    
    sourcePromises.push(
      runApifyScraper(setting, apifyQuery, location, setting.apify_max_results || 100)
        .then(leads => ({ source: 'apify', leads }))
        .catch(error => ({ source: 'apify', leads: [], error: error.message }))
    );
  }

  // Run all sources in parallel
  console.log(`[super-discovery] Running ${sourcePromises.length} sources in parallel`);
  const sourceResults = await Promise.all(sourcePromises);

  // Collect all leads
  const allLeads: any[] = [];
  
  for (const result of sourceResults) {
    if (result.error) {
      console.error(`[super-discovery] Source ${result.source} failed:`, result.error);
      continue;
    }
    
    stats.bySource[result.source] = result.leads.length;
    console.log(`[super-discovery] Source ${result.source} returned ${result.leads.length} leads`);
    
    // Tag leads with their source
    for (const lead of result.leads) {
      lead.source = result.source;
      allLeads.push(lead);
    }
  }

  // Deduplicate leads by company name and website
  const uniqueLeads = deduplicateLeads(allLeads);
  console.log(`[super-discovery] After deduplication: ${uniqueLeads.length} unique leads (from ${allLeads.length})`);

  // Filter out excluded industries/keywords
  const filteredLeads = filterLeadsByPersona(uniqueLeads, persona);
  console.log(`[super-discovery] After filtering: ${filteredLeads.length} leads`);

  if (filteredLeads.length === 0) {
    return stats;
  }

  // Enrich leads with Perplexity if enabled (for top quality leads)
  let enrichedLeads = filteredLeads;
  if (setting.enrich_with_perplexity) {
    enrichedLeads = await enrichLeadsWithPerplexity(filteredLeads, setting);
    stats.enriched = enrichedLeads.filter((l: any) => l.enrichment_data).length;
  }

  // Save leads to database
  const savedStats = await saveDiscoveredLeads(
    supabase,
    enrichedLeads,
    setting,
    persona,
    discoveryRunId
  );

  stats.totalLeads = savedStats.total;
  stats.autoApproved = savedStats.autoApproved;
  stats.pending = savedStats.pending;

  return stats;
}

/**
 * Run lead finder (Exa + SerpAPI)
 */
async function runLeadFinder(
  supabase: any,
  setting: any,
  searchQuery: string,
  persona: Persona | null,
  maxResults: number
): Promise<any[]> {
  const leadFinderResponse = await fetch(`${SUPABASE_URL}/functions/v1/lead-finder`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      size: persona?.target_company_sizes?.[0] || setting.target_company_sizes?.[0] || 'any',
      geography: persona?.target_geographies?.[0] || setting.target_geographies?.[0] || 'any',
      industry: persona?.target_industries?.[0] || setting.target_industries?.[0] || 'any',
      customSearchText: searchQuery,
      dryRun: true,
      provider: 'openai',
      model: 'gpt-4o-mini',
      enrichWithPerplexity: false, // We'll do batch enrichment later
      useSerpApi: setting.use_serp_api !== false,
      maxResults: Math.min(maxResults, setting.max_leads_per_run || 20),
      autonomousMode: true,
    }),
  });

  if (!leadFinderResponse.ok) {
    const errorText = await leadFinderResponse.text();
    console.error(`[super-discovery] Lead finder error:`, errorText);
    return [];
  }

  return await parseStreamingResponse(leadFinderResponse);
}

/**
 * Run Apify Google Maps scraper
 */
async function runApifyScraper(
  setting: any,
  query: string,
  location: string,
  maxResults: number
): Promise<any[]> {
  const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN");
  if (!APIFY_API_TOKEN) {
    console.log('[super-discovery] APIFY_API_TOKEN not configured, skipping Apify source');
    return [];
  }

  console.log(`[super-discovery] Running Apify scraper: "${query}" in "${location}"`);

  const actorId = "nwua9Gu5YrADL7ZDj"; // Google Maps Scraper
  const actorRunUrl = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items`;

  const searchString = `${query} in ${location}`;
  
  const apifyResponse = await fetch(`${actorRunUrl}?token=${APIFY_API_TOKEN}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      searchStringsArray: [searchString],
      maxCrawledPlacesPerSearch: Math.min(maxResults, 300),
      language: "en",
      maxImages: 0,
      maxReviews: 0,
    }),
  });

  if (!apifyResponse.ok) {
    const errorText = await apifyResponse.text();
    console.error("[super-discovery] Apify API error:", errorText);
    return [];
  }

  const places = await apifyResponse.json();
  console.log(`[super-discovery] Apify returned ${places.length} results`);

  // Transform to lead format
  return places.map((place: any) => ({
    name: place.title || place.name || "",
    website: place.website || place.url,
    companyPhone: place.phone,
    generalEmail: null, // Will try to extract from website during enrichment
    address: place.address,
    geography: place.city || location,
    industry: place.categoryName || (place.categories?.[0]),
    rating: place.totalScore,
    reviews: place.reviewsCount,
    qualityScore: calculateApifyQualityScore(place, setting),
    source: 'apify',
  })).filter((lead: any) => lead.name);
}

/**
 * Build Apify-specific query from persona/settings
 */
function buildApifyQuery(persona: Persona | null, setting: any, fallbackQuery: string): string {
  // Prefer specific industry terms for local business search
  if (persona?.target_industries?.length) {
    return persona.target_industries[0];
  }
  if (setting.target_industries?.length) {
    return setting.target_industries[0];
  }
  
  // Extract key terms from the query
  const keywords = fallbackQuery.split(' ').slice(0, 3).join(' ');
  return keywords || 'local businesses';
}

/**
 * Calculate quality score for Apify leads
 */
function calculateApifyQualityScore(place: any, setting: any): number {
  let score = 40; // Base score for Apify leads
  
  // Rating boost (0-5 scale -> 0-20 points)
  if (place.totalScore) {
    score += Math.min(place.totalScore * 4, 20);
  }
  
  // Reviews boost (more reviews = more established)
  if (place.reviewsCount) {
    if (place.reviewsCount >= 100) score += 15;
    else if (place.reviewsCount >= 50) score += 10;
    else if (place.reviewsCount >= 10) score += 5;
  }
  
  // Contact info boost
  if (place.phone) score += 10;
  if (place.website) score += 10;
  
  // Apply source quality weight
  const weight = (setting.apify_quality_weight || 85) / 100;
  
  return Math.round(Math.min(score * weight, 100));
}

/**
 * Deduplicate leads by company name and website domain
 */
function deduplicateLeads(leads: any[]): any[] {
  const seen = new Map<string, any>();
  
  for (const lead of leads) {
    const nameLower = lead.name?.toLowerCase()?.trim();
    const websiteDomain = extractDomain(lead.website);
    
    // Create composite key
    const key = websiteDomain || nameLower;
    if (!key) continue;
    
    // Keep the lead with higher quality score
    if (!seen.has(key) || (lead.qualityScore || 0) > (seen.get(key)?.qualityScore || 0)) {
      // Merge sources if duplicate
      if (seen.has(key)) {
        lead.sources_used = [...new Set([seen.get(key).source, lead.source])];
      } else {
        lead.sources_used = [lead.source];
      }
      seen.set(key, lead);
    }
  }
  
  return Array.from(seen.values());
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    return urlObj.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Filter leads by persona exclusions
 */
function filterLeadsByPersona(leads: any[], persona: Persona | null): any[] {
  if (!persona) return leads;
  
  return leads.filter((lead: any) => {
    // Check excluded industries
    if (persona.exclude_industries?.length) {
      const leadIndustry = lead.industry?.toLowerCase() || '';
      for (const excluded of persona.exclude_industries) {
        if (leadIndustry.includes(excluded.toLowerCase())) {
          return false;
        }
      }
    }
    
    // Check excluded keywords
    if (persona.exclude_keywords?.length) {
      const leadText = `${lead.name} ${lead.description || ''} ${lead.industry || ''}`.toLowerCase();
      for (const excluded of persona.exclude_keywords) {
        if (leadText.includes(excluded.toLowerCase())) {
          return false;
        }
      }
    }
    
    return true;
  });
}

/**
 * Enrich leads with Perplexity (batch, top quality only)
 */
async function enrichLeadsWithPerplexity(leads: any[], setting: any): Promise<any[]> {
  // Only enrich top leads to save API calls
  const topLeads = leads
    .sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0))
    .slice(0, 10);
  
  const otherLeads = leads.filter(l => !topLeads.includes(l));
  
  console.log(`[super-discovery] Enriching top ${topLeads.length} leads with Perplexity`);
  
  // Enrich in parallel batches
  const enrichPromises = topLeads.map(async (lead) => {
    try {
      const enriched = await enrichSingleLead(lead);
      return { ...lead, ...enriched };
    } catch (error) {
      console.error(`[super-discovery] Failed to enrich ${lead.name}:`, error);
      return lead;
    }
  });
  
  const enrichedTopLeads = await Promise.all(enrichPromises);
  
  return [...enrichedTopLeads, ...otherLeads];
}

/**
 * Enrich a single lead with Perplexity
 */
async function enrichSingleLead(lead: any): Promise<any> {
  const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
  if (!PERPLEXITY_API_KEY) return {};
  
  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [{
          role: 'user',
          content: `Provide brief company information for "${lead.name}"${lead.website ? ` (${lead.website})` : ''}. Include: 1) What they do, 2) Company size estimate, 3) Key decision makers if available. Be concise.`
        }],
      }),
    });
    
    if (!response.ok) return {};
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    return {
      enrichment_data: {
        perplexity_summary: content,
        enriched_at: new Date().toISOString(),
        citations: data.citations,
      },
    };
  } catch {
    return {};
  }
}

/**
 * Save discovered leads to database
 */
async function saveDiscoveredLeads(
  supabase: any,
  leads: any[],
  setting: any,
  persona: Persona | null,
  discoveryRunId: string
): Promise<{ total: number; autoApproved: number; pending: number }> {
  const userId = setting.user_id;
  const result = { total: 0, autoApproved: 0, pending: 0 };
  
  // Get existing companies to avoid duplicates
  const { data: existingCompanies } = await supabase
    .from('companies')
    .select('name, website')
    .eq('user_id', userId);

  const existingNames = new Set((existingCompanies || []).map((c: any) => c.name?.toLowerCase()));
  const existingWebsites = new Set((existingCompanies || []).map((c: any) => extractDomain(c.website)).filter(Boolean));

  // Also check existing autonomous leads
  const { data: existingAutonomousLeads } = await supabase
    .from('autonomous_leads')
    .select('company_name, company_website')
    .eq('user_id', userId)
    .in('status', ['pending', 'approved', 'auto_approved']);

  const existingAutoNames = new Set((existingAutonomousLeads || []).map((l: any) => l.company_name?.toLowerCase()));
  const existingAutoWebsites = new Set((existingAutonomousLeads || []).map((l: any) => extractDomain(l.company_website)).filter(Boolean));

  // Filter out duplicates
  const newLeads = leads.filter((lead: any) => {
    const nameLower = lead.name?.toLowerCase();
    const websiteDomain = extractDomain(lead.website);
    
    if (existingNames.has(nameLower) || existingAutoNames.has(nameLower)) return false;
    if (websiteDomain && (existingWebsites.has(websiteDomain) || existingAutoWebsites.has(websiteDomain))) return false;
    
    return true;
  });

  if (newLeads.length === 0) {
    console.log(`[super-discovery] All leads already exist for user ${userId}`);
    return result;
  }

  // Insert autonomous leads
  const autonomousLeadsToInsert = newLeads.map((lead: any) => {
    const status = setting.auto_approve_threshold && lead.qualityScore >= setting.auto_approve_threshold 
      ? 'auto_approved' 
      : 'pending';

    if (status === 'auto_approved') result.autoApproved++;
    else result.pending++;

    return {
      user_id: userId,
      discovery_run_id: discoveryRunId,
      persona_id: persona?.id || null,
      status,
      quality_score: lead.qualityScore || 0,
      company_data: lead,
      company_name: lead.name,
      company_website: lead.website,
      industry: lead.industry,
      geography: lead.geography,
      company_size: lead.size,
      contacts: lead.contacts || [],
      enrichment_data: lead.enrichment_data || null,
      source: lead.source || 'lead-finder',
      sources_used: lead.sources_used || [lead.source || 'lead-finder'],
      source_breakdown: {
        primary: lead.source,
        all: lead.sources_used || [lead.source],
      },
    };
  });

  const { error: insertError } = await supabase
    .from('autonomous_leads')
    .insert(autonomousLeadsToInsert);

  if (insertError) {
    console.error(`[super-discovery] Error inserting leads:`, insertError);
    return result;
  }

  result.total = newLeads.length;
  console.log(`[super-discovery] Inserted ${newLeads.length} leads for user ${userId}`);

  // Auto-approve leads that meet threshold and save to companies
  const autoApprovedLeads = autonomousLeadsToInsert.filter(l => l.status === 'auto_approved');
  if (autoApprovedLeads.length > 0) {
    console.log(`[super-discovery] Auto-approving ${autoApprovedLeads.length} leads`);
    
    for (const lead of autoApprovedLeads) {
      const companyId = await saveLeadToCompanies(supabase, lead, userId);
      
      // Determine which sequence to use (persona-specific or global)
      const sequenceId = persona?.auto_enroll_sequence_id || 
                         (setting.auto_enroll_enabled ? setting.auto_enroll_sequence_id : null);
      
      if (sequenceId && companyId) {
        await enrollInSequence(supabase, companyId, sequenceId);
      }

      // Track feedback for AI learning
      await trackAutoApprovalFeedback(supabase, userId, lead, persona);
    }

    // Send webhook notification for high-quality auto-approved leads
    if (setting.webhook_enabled && setting.webhook_url) {
      const highQualityLeads = autoApprovedLeads.filter(
        l => l.quality_score >= (setting.notify_min_quality_score || 70)
      );
      
      if (highQualityLeads.length > 0 && setting.notify_on_auto_approve) {
        await sendWebhookNotification(setting.webhook_url, {
          type: 'auto_approved_leads',
          persona: persona?.name || 'Default',
          count: highQualityLeads.length,
          leads: highQualityLeads.map(l => ({
            name: l.company_name,
            website: l.company_website,
            industry: l.industry,
            qualityScore: l.quality_score,
            sources: l.sources_used,
          })),
        });
      }
    }
  }

  // Send webhook for pending leads if webhook enabled
  const pendingLeads = autonomousLeadsToInsert.filter(l => l.status === 'pending');
  if (setting.webhook_enabled && setting.webhook_url && pendingLeads.length > 0) {
    const notifiableLeads = pendingLeads.filter(
      l => l.quality_score >= (setting.notify_min_quality_score || 70)
    );
    
    if (notifiableLeads.length > 0) {
      await sendWebhookNotification(setting.webhook_url, {
        type: 'new_leads_pending_review',
        persona: persona?.name || 'Default',
        count: notifiableLeads.length,
        leads: notifiableLeads.map(l => ({
          name: l.company_name,
          website: l.company_website,
          industry: l.industry,
          qualityScore: l.quality_score,
          sources: l.sources_used,
        })),
      });
    }
  }

  return result;
}

/**
 * Create auto campaigns for auto-approved leads
 */
async function createAutoCampaigns(
  supabase: any,
  setting: any,
  discoveryRunId: string
): Promise<number> {
  if (!setting.auto_create_campaign) return 0;

  console.log(`[super-discovery] Creating auto campaigns for discovery run ${discoveryRunId}`);

  // Get auto-approved leads from this run
  const { data: autoApprovedLeads } = await supabase
    .from('autonomous_leads')
    .select('*, company_id')
    .eq('discovery_run_id', discoveryRunId)
    .eq('status', 'auto_approved')
    .not('company_id', 'is', null);

  if (!autoApprovedLeads || autoApprovedLeads.length === 0) {
    console.log('[super-discovery] No auto-approved leads with company_id to create campaigns for');
    return 0;
  }

  // Group by persona
  const byPersona = new Map<string | null, any[]>();
  for (const lead of autoApprovedLeads) {
    const personaId = lead.persona_id;
    if (!byPersona.has(personaId)) {
      byPersona.set(personaId, []);
    }
    byPersona.get(personaId)!.push(lead);
  }

  let campaignsCreated = 0;

  // Create a campaign for each persona group
  for (const [personaId, leads] of byPersona) {
    try {
      // Get persona details if applicable
      let personaName = 'General Discovery';
      let emailContext = '';
      
      if (personaId) {
        const { data: persona } = await supabase
          .from('discovery_personas')
          .select('name, value_proposition, email_tone, talking_points')
          .eq('id', personaId)
          .single();
        
        if (persona) {
          personaName = persona.name;
          emailContext = [
            persona.value_proposition,
            persona.talking_points?.join('. '),
          ].filter(Boolean).join(' ');
        }
      }

      // Get contacts for the companies
      const companyIds = leads.map((l: any) => l.company_id);
      const { data: contacts } = await supabase
        .from('contacts')
        .select('*')
        .in('company_id', companyIds)
        .not('email', 'is', null);

      if (!contacts || contacts.length === 0) {
        console.log(`[super-discovery] No contacts with emails for persona ${personaName}`);
        continue;
      }

      // Create draft campaign
      const campaignName = `Auto Discovery - ${personaName} - ${new Date().toLocaleDateString()}`;
      
      const { data: campaign, error: campaignError } = await supabase
        .from('email_campaigns')
        .insert({
          user_id: setting.user_id,
          name: campaignName,
          status: setting.full_auto_mode ? 'scheduled' : 'draft',
          scheduled_at: setting.full_auto_mode ? calculateCampaignSendTime(setting) : null,
          subject_template: `Quick question for {{name}}`,
          body_text_template: `Hi {{name}},\n\nI noticed {{company}} and wanted to reach out...\n\n${emailContext}\n\nBest,\n{{sender_name}}`,
          body_html_template: `<p>Hi {{name}},</p><p>I noticed {{company}} and wanted to reach out...</p><p>${emailContext}</p><p>Best,<br/>{{sender_name}}</p>`,
          total_recipients: contacts.length,
        })
        .select('id')
        .single();

      if (campaignError) {
        console.error(`[super-discovery] Failed to create campaign:`, campaignError);
        continue;
      }

      // Link leads to campaign
      await supabase
        .from('autonomous_leads')
        .update({ campaign_id: campaign.id })
        .in('id', leads.map((l: any) => l.id));

      campaignsCreated++;
      console.log(`[super-discovery] Created campaign "${campaignName}" with ${contacts.length} recipients`);

    } catch (error) {
      console.error(`[super-discovery] Error creating campaign for persona ${personaId}:`, error);
    }
  }

  return campaignsCreated;
}

/**
 * Calculate campaign send time based on settings
 */
function calculateCampaignSendTime(setting: any): string {
  const sendTime = setting.campaign_send_time || '10:00';
  const [hours, minutes] = sendTime.split(':').map(Number);
  
  const sendDate = new Date();
  sendDate.setUTCHours(hours, minutes, 0, 0);
  
  // If time has passed today, schedule for tomorrow
  if (sendDate < new Date()) {
    sendDate.setDate(sendDate.getDate() + 1);
  }
  
  return sendDate.toISOString();
}

/**
 * Send summary webhook with discovery stats
 */
async function sendSummaryWebhook(webhookUrl: string, stats: DiscoveryStats): Promise<void> {
  try {
    const isSlack = webhookUrl.includes('hooks.slack.com');
    const isDiscord = webhookUrl.includes('discord.com/api/webhooks');

    const sourceBreakdown = Object.entries(stats.bySource)
      .map(([source, count]) => `${source}: ${count}`)
      .join(', ');

    let payload: any;

    if (isSlack) {
      payload = {
        text: `🚀 Super Discovery Complete!`,
        blocks: [
          {
            type: 'header',
            text: { type: 'plain_text', text: '🚀 Super Discovery Complete!' },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Total Leads:* ${stats.totalLeads}\n*Auto-Approved:* ${stats.autoApproved}\n*Pending Review:* ${stats.pending}\n*Enriched:* ${stats.enriched}\n*Campaigns Created:* ${stats.campaignsCreated}\n\n*Source Breakdown:* ${sourceBreakdown}`,
            },
          },
        ],
      };
    } else if (isDiscord) {
      payload = {
        embeds: [{
          title: '🚀 Super Discovery Complete!',
          color: 0x22c55e,
          fields: [
            { name: 'Total Leads', value: String(stats.totalLeads), inline: true },
            { name: 'Auto-Approved', value: String(stats.autoApproved), inline: true },
            { name: 'Pending', value: String(stats.pending), inline: true },
            { name: 'Enriched', value: String(stats.enriched), inline: true },
            { name: 'Campaigns', value: String(stats.campaignsCreated), inline: true },
            { name: 'Sources', value: sourceBreakdown, inline: false },
          ],
        }],
      };
    } else {
      payload = { event: 'discovery_complete', stats };
    }

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error('[super-discovery] Error sending summary webhook:', error);
  }
}

// =========== Helper Functions ===========

function shouldRunDiscovery(setting: any): boolean {
  const now = new Date();
  const lastRun = setting.last_run_at ? new Date(setting.last_run_at) : null;
  const nextRun = setting.next_run_at ? new Date(setting.next_run_at) : null;

  if (nextRun && nextRun > now) return false;
  if (!lastRun) return true;

  const hoursSinceLastRun = (now.getTime() - lastRun.getTime()) / (1000 * 60 * 60);

  switch (setting.discovery_frequency) {
    case 'daily': return hoursSinceLastRun >= 24;
    case 'twice_weekly': return hoursSinceLastRun >= 84;
    case 'weekly': return hoursSinceLastRun >= 168;
    default: return hoursSinceLastRun >= 24;
  }
}

function calculateNextRun(frequency: string): Date {
  const now = new Date();
  switch (frequency) {
    case 'daily': return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case 'twice_weekly': return new Date(now.getTime() + 84 * 60 * 60 * 1000);
    case 'weekly': return new Date(now.getTime() + 168 * 60 * 60 * 1000);
    default: return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }
}

function buildSearchQuery(setting: any, businessProfile: any): string {
  if (setting.custom_search_query) return setting.custom_search_query;

  const parts: string[] = [];
  if (businessProfile?.target_audience) parts.push(`companies that match: ${businessProfile.target_audience}`);
  if (businessProfile?.services_description) parts.push(`potential customers for: ${businessProfile.services_description}`);
  if (setting.target_industries?.length > 0) parts.push(`in industries: ${setting.target_industries.join(', ')}`);
  if (setting.target_geographies?.length > 0) parts.push(`located in: ${setting.target_geographies.join(', ')}`);
  if (setting.target_company_sizes?.length > 0) parts.push(`company sizes: ${setting.target_company_sizes.join(', ')}`);

  return parts.length > 0 ? parts.join(' | ') : 'B2B companies with growth potential';
}

function buildPersonaSearchQuery(persona: Persona, businessProfile: any): string {
  if (persona.custom_search_query) return persona.custom_search_query;

  const parts: string[] = [];
  if (persona.target_keywords?.length) parts.push(persona.target_keywords.join(' OR '));
  if (persona.target_industries?.length) parts.push(`in industries: ${persona.target_industries.join(', ')}`);
  if (persona.target_geographies?.length) parts.push(`located in: ${persona.target_geographies.join(', ')}`);
  if (persona.target_company_sizes?.length) parts.push(`company sizes: ${persona.target_company_sizes.join(', ')}`);
  if (businessProfile?.target_audience) parts.push(`companies that match: ${businessProfile.target_audience}`);

  return parts.length > 0 ? parts.join(' | ') : 'B2B companies with growth potential';
}

async function parseStreamingResponse(response: Response): Promise<any[]> {
  const leads: any[] = [];
  const reader = response.body?.getReader();
  if (!reader) return leads;

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'lead' && data.lead) leads.push(data.lead);
            if (data.type === 'batch' && data.leads) leads.push(...data.leads);
            if (data.type === 'lead-update' && data.lead) {
              const idx = leads.findIndex(l => l.name === data.lead.name);
              if (idx >= 0) leads[idx] = data.lead;
              else leads.push(data.lead);
            }
          } catch { /* skip invalid */ }
        }
      }
    }
  } catch (error) {
    console.error('[super-discovery] Error parsing stream:', error);
  }

  return leads;
}

async function saveLeadToCompanies(supabase: any, lead: any, userId: string): Promise<string | null> {
  try {
    const companyData = lead.company_data || {};
    
    const { data: company, error } = await supabase
      .from('companies')
      .insert({
        user_id: userId,
        name: lead.company_name,
        website: lead.company_website || `no-website-${crypto.randomUUID()}`,
        description: companyData.description,
        industry: lead.industry,
        size: lead.company_size,
        geography: lead.geography,
        linkedin_url: companyData.linkedinUrl,
        company_phone: companyData.companyPhone,
        general_email: companyData.generalEmail,
        social_profiles: companyData.socialProfiles,
        key_executives: companyData.keyExecutives,
        employee_count: companyData.employeeCount,
        enrichment_data: lead.enrichment_data,
        enrichment_status: lead.enrichment_data ? 'completed' : 'pending',
      })
      .select('id')
      .single();

    if (error) {
      console.error('[super-discovery] Error saving company:', error);
      return null;
    }

    await supabase
      .from('autonomous_leads')
      .update({ company_id: company.id, reviewed_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('company_name', lead.company_name)
      .eq('status', 'auto_approved');

    const contacts = lead.contacts || [];
    if (contacts.length > 0 && company.id) {
      const contactsToInsert = contacts.map((c: any) => ({
        company_id: company.id,
        name: c.name,
        email: c.email,
        email_verified: c.emailVerified,
        linkedin_url: c.linkedinUrl,
        title: c.title,
        department: c.department,
        phone: c.phone,
      }));
      await supabase.from('contacts').insert(contactsToInsert);
    }

    return company.id;
  } catch (error) {
    console.error('[super-discovery] Error in saveLeadToCompanies:', error);
    return null;
  }
}

async function enrollInSequence(supabase: any, companyId: string, sequenceId: string): Promise<void> {
  try {
    const { error } = await supabase.from('company_sequences').insert({
      company_id: companyId,
      sequence_id: sequenceId,
      status: 'active',
      current_step: 0,
      auto_respond_enabled: true,
    });
    if (error) console.error('[super-discovery] Error enrolling in sequence:', error);
    else console.log(`[super-discovery] Enrolled company ${companyId} in sequence ${sequenceId}`);
  } catch (error) {
    console.error('[super-discovery] Error in enrollInSequence:', error);
  }
}

async function trackAutoApprovalFeedback(supabase: any, userId: string, lead: any, persona: Persona | null): Promise<void> {
  try {
    await supabase.from('lead_feedback_analytics').insert({
      user_id: userId,
      action: 'auto_approved',
      quality_score: lead.quality_score,
      industry: lead.industry,
      geography: lead.geography,
      company_size: lead.company_size,
      source: lead.source,
      time_to_decision_seconds: 0,
    });

    await supabase.rpc('update_discovery_learning', {
      p_user_id: userId,
      p_action: 'auto_approved',
      p_industry: lead.industry,
      p_geography: lead.geography,
      p_company_size: lead.company_size,
    });
    
    if (persona) {
      await supabase
        .from('discovery_personas')
        .update({ total_approved: (persona as any).total_approved + 1, updated_at: new Date().toISOString() })
        .eq('id', persona.id);
    }
  } catch (error) {
    console.error('[super-discovery] Error tracking feedback:', error);
  }
}

async function sendWebhookNotification(webhookUrl: string, payload: any): Promise<void> {
  try {
    const isSlack = webhookUrl.includes('hooks.slack.com');
    const isDiscord = webhookUrl.includes('discord.com/api/webhooks');

    let formattedPayload: any;

    if (isSlack) {
      formattedPayload = {
        text: `🎯 Lead Genie: ${payload.type === 'auto_approved_leads' ? 'Auto-approved' : 'New'} leads discovered!`,
        blocks: [
          { type: 'header', text: { type: 'plain_text', text: `🎯 ${payload.count} ${payload.type === 'auto_approved_leads' ? 'Auto-approved' : 'Pending'} Leads` } },
          { type: 'section', text: { type: 'mrkdwn', text: `*Persona:* ${payload.persona || 'Default'}\n` + payload.leads.map((l: any) => `• *${l.name}* (${l.industry || 'Unknown'}) - Score: ${l.qualityScore} [${l.sources?.join(', ') || l.source}]`).join('\n') } },
        ],
      };
    } else if (isDiscord) {
      formattedPayload = {
        embeds: [{
          title: `🎯 ${payload.count} ${payload.type === 'auto_approved_leads' ? 'Auto-approved' : 'Pending'} Leads`,
          description: `**Persona:** ${payload.persona || 'Default'}\n\n` + payload.leads.map((l: any) => `• **${l.name}** (${l.industry || 'Unknown'}) - Score: ${l.qualityScore}`).join('\n'),
          color: payload.type === 'auto_approved_leads' ? 0x22c55e : 0x3b82f6,
        }],
      };
    } else {
      formattedPayload = payload;
    }

    await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formattedPayload) });
    console.log('[super-discovery] Webhook notification sent');
  } catch (error) {
    console.error('[super-discovery] Error sending webhook:', error);
  }
}
