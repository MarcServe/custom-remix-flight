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
  emailsExtracted: number;
  contactsCreated: number;
  sequencesEnrolled: number;
  errors: string[];
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

    // Get current UTC time
    const now = new Date();
    const currentUtcHour = now.getUTCHours();
    console.log(`[super-discovery] Current UTC hour: ${currentUtcHour}, timestamp: ${now.toISOString()}`);

    // Helper function to check if it's the user's preferred local hour (or overnight preparation time)
    const isUserPreferredHour = (setting: any): boolean => {
      const preferredLocalHour = setting.preferred_discovery_hour ?? 9;
      const preBakeHours = setting.pre_discovery_hours || 0;
      let timezone = setting.timezone || 'Europe/London';
      if (timezone === 'London') timezone = 'Europe/London';
      
      // Calculate the hour when discovery should START (before delivery time for overnight mode)
      const discoveryStartHour = (preferredLocalHour - preBakeHours + 24) % 24;
      
      try {
        // Get the current hour in the user's timezone
        const userLocalHour = parseInt(
          new Intl.DateTimeFormat('en-US', {
            hour: 'numeric',
            hour12: false,
            timeZone: timezone,
          }).format(now)
        );
        
        const isOvernightMode = preBakeHours > 0;
        console.log(`[super-discovery] User ${setting.user_id}: local hour ${userLocalHour} in ${timezone}, ` +
          `preferred ${preferredLocalHour}${isOvernightMode ? ` (overnight mode: start at ${discoveryStartHour})` : ''}`);
        return userLocalHour === discoveryStartHour;
      } catch (error) {
        console.error(`[super-discovery] Invalid timezone ${timezone}, falling back to UTC`);
        return currentUtcHour === discoveryStartHour;
      }
    };

    // Helper function to check if a missed run should be caught up
    const shouldCatchUpMissedRun = (setting: any): boolean => {
      const lastRun = setting.last_run_at ? new Date(setting.last_run_at) : null;
      const nextRun = setting.next_run_at ? new Date(setting.next_run_at) : null;
      
      // If next_run_at is in the past by more than 1 hour, we missed a run
      if (nextRun && nextRun < now) {
        const missedByHours = (now.getTime() - nextRun.getTime()) / (1000 * 60 * 60);
        
        // Catch up if we missed by less than 24 hours (don't catch up very old missed runs)
        if (missedByHours > 1 && missedByHours < 24) {
          console.log(`[super-discovery] User ${setting.user_id}: Missed run detected! next_run_at was ${nextRun.toISOString()}, catching up...`);
          return true;
        }
        
        // If missed by more than 24 hours, log and reset next_run_at
        if (missedByHours >= 24) {
          console.log(`[super-discovery] User ${setting.user_id}: next_run_at is very old (${missedByHours.toFixed(1)}h ago), will run now to reset schedule`);
          return true;
        }
      }
      
      // If no last run, should run
      if (!lastRun) {
        console.log(`[super-discovery] User ${setting.user_id}: No previous run, should run now`);
        return true;
      }
      
      return false;
    };

    // Filter settings to only users whose preferred local hour matches current time
    // OR who have a missed run that needs catching up
    // (skip filtering for manual triggers)
    const settingsToProcess = manualUserId || forceRun
      ? settings
      : settings.filter((s: any) => isUserPreferredHour(s) || shouldCatchUpMissedRun(s));

    console.log(`[super-discovery] Users to process: ${settingsToProcess.length} of ${settings.length} (scheduled + catch-up)`);

    if (settingsToProcess.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: `No users scheduled for hour ${currentUtcHour} UTC (checked ${settings.length} users)`,
        processed: 0 
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let processedCount = 0;
    let totalLeadsDiscovered = 0;
    const allStats: DiscoveryStats[] = [];

    for (const setting of settingsToProcess) {
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
          emailsExtracted: 0,
          contactsCreated: 0,
          sequencesEnrolled: 0,
          errors: [],
        };

        // Determine trigger type for run tracking
        const triggerType = manualUserId ? 'manual' : (forceRun ? 'catch_up' : 'scheduled');

        // Create discovery run record
        const { error: runError } = await supabase
          .from('discovery_runs')
          .insert({
            user_id: setting.user_id,
            discovery_run_id: discoveryRunId,
            status: 'running',
            trigger_type: triggerType,
            settings_snapshot: {
              full_auto_mode: setting.full_auto_mode,
              auto_extract_emails: setting.auto_extract_emails,
              auto_extract_all_emails: setting.auto_extract_all_emails,
              deep_enrichment_mode: setting.deep_enrichment_mode,
              auto_create_campaign: setting.auto_create_campaign,
              enrich_with_perplexity: setting.enrich_with_perplexity,
            },
          });

        if (runError) {
          console.error(`[super-discovery] Failed to create run record:`, runError);
        }

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
        // In full_auto_mode, create campaigns even if leads are processed differently
        const shouldCreateCampaign = setting.auto_create_campaign && 
          (userStats.autoApproved > 0 || (setting.full_auto_mode && userStats.totalLeads > 0));
        
        if (shouldCreateCampaign) {
          const campaignsCreated = await createAutoCampaigns(supabase, setting, discoveryRunId);
          userStats.campaignsCreated = campaignsCreated;
        }

        totalLeadsDiscovered += userStats.totalLeads;
        allStats.push(userStats);

        // Update last_run_at and next_run_at (use user's timezone so 9 AM London is 9 AM London, not 9 UTC)
        const nextRunAt = calculateNextRun(
          setting.discovery_frequency,
          setting.preferred_discovery_hour ?? 9,
          setting.timezone || 'Europe/London'
        );
        await supabase
          .from('autonomous_discovery_settings')
          .update({ 
            last_run_at: new Date().toISOString(),
            next_run_at: nextRunAt.toISOString(),
          })
          .eq('user_id', setting.user_id);

        // Update discovery run record with completion stats
        await supabase
          .from('discovery_runs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            total_leads_found: userStats.totalLeads,
            leads_enriched: userStats.enriched,
            leads_auto_approved: userStats.autoApproved,
            leads_pending: userStats.pending,
            emails_extracted: userStats.emailsExtracted,
            contacts_created: userStats.contactsCreated,
            campaigns_created: userStats.campaignsCreated,
            sequences_enrolled: userStats.sequencesEnrolled,
            source_breakdown: userStats.bySource,
            errors: userStats.errors,
          })
          .eq('discovery_run_id', discoveryRunId);

        processedCount++;
        console.log(`[super-discovery] Completed processing for user ${setting.user_id}. Stats:`, JSON.stringify(userStats));

        // Send summary webhook notification - use slack/discord webhooks or legacy webhook_url
        const summaryWebhookUrl = setting.slack_webhook_url || setting.discord_webhook_url || setting.webhook_url;
        if (setting.webhook_enabled && summaryWebhookUrl && userStats.totalLeads > 0) {
          if (setting.notify_on_discovery_complete) {
            await sendSummaryWebhook(summaryWebhookUrl, userStats);
          }
        }

        // Send hot lead alerts for high-quality leads
        if (setting.notify_on_hot_leads && summaryWebhookUrl && userStats.autoApproved > 0) {
          await sendHotLeadAlerts(supabase, setting, discoveryRunId, summaryWebhookUrl);
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
        
        // Update discovery run record with error status
        await supabase
          .from('discovery_runs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_message: userError instanceof Error ? userError.message : 'Unknown error',
          })
          .eq('user_id', setting.user_id)
          .eq('status', 'running');
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
    emailsExtracted: 0,
    contactsCreated: 0,
    sequencesEnrolled: 0,
    errors: [],
  };

  // Calculate leads per source. Request at least daily_lead_target from lead-finder (up to max_leads_per_run)
  const dailyTarget = setting.daily_lead_target || 50;
  const maxPerRun = setting.max_leads_per_run ?? 100;
  const enabledSources = [
    setting.use_serp_api !== false, // EXA + SerpAPI via lead-finder
    setting.use_apify === true,     // Apify Google Maps
  ].filter(Boolean).length + 1; // +1 for Exa (always on)

  const leadsPerSource = Math.ceil(dailyTarget / enabledSources);
  // Lead-finder: request as many as we can use (at least daily target, cap at max per run) so we get 50–100+ results
  const leadFinderMax = Math.min(maxPerRun, Math.max(leadsPerSource, dailyTarget));

  // Prepare parallel source calls
  const sourcePromises: Promise<SourceResult>[] = [];

  // Source 1: Lead Finder (Exa + SerpAPI combined)
  sourcePromises.push(
    runLeadFinder(supabase, setting, searchQuery, persona, leadFinderMax)
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

  // Enrich leads with Perplexity
  // In deep_enrichment_mode or full_auto_mode, enrich ALL leads for better AI campaign generation
  let enrichedLeads = filteredLeads;
  const shouldEnrichAll = setting.deep_enrichment_mode || setting.full_auto_mode;
  
  if (setting.enrich_with_perplexity || shouldEnrichAll) {
    enrichedLeads = await enrichLeadsWithPerplexity(filteredLeads, setting, shouldEnrichAll);
    stats.enriched = enrichedLeads.filter((l: any) => l.wasEnriched).length;
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
  stats.emailsExtracted = savedStats.emailsExtracted || 0;
  stats.contactsCreated = savedStats.contactsCreated || 0;
  stats.sequencesEnrolled = savedStats.sequencesEnrolled || 0;

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
      maxResults: maxResults,
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
 * Enrich leads with Perplexity (batch, prioritizing Apify leads which have minimal data)
 * When enrichAll is true (deep_enrichment_mode or full_auto_mode), enriches ALL leads
 */
async function enrichLeadsWithPerplexity(leads: any[], setting: any, enrichAll: boolean = false): Promise<any[]> {
  const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
  if (!PERPLEXITY_API_KEY) {
    console.log('[super-discovery] No Perplexity API key, skipping enrichment');
    return leads;
  }

  const isOvernightMode = (setting.pre_discovery_hours || 0) > 0;
  const baseLimit = setting.max_perplexity_enriched || 20;
  
  // In enrichAll mode (full_auto_mode or deep_enrichment_mode), enrich ALL leads
  // This ensures AI has enough context to create personalized campaigns
  if (enrichAll) {
    console.log(`[super-discovery] Deep enrichment mode: enriching ALL ${leads.length} leads with Perplexity`);
    const maxToEnrich = Math.min(leads.length, setting.max_leads_per_run || 100);
    const leadsToEnrich = leads.slice(0, maxToEnrich);
    const remainingLeads = leads.slice(maxToEnrich);
    
    const enrichedLeads = await enrichBatch(leadsToEnrich, setting);
    return [...enrichedLeads, ...remainingLeads];
  }
  
  // Standard mode: prioritize Apify leads + top quality others
  const maxToEnrich = isOvernightMode ? (setting.max_leads_per_run || 50) : baseLimit;
  
  // Always enrich ALL Apify leads - they have minimal data and need deep enrichment
  const apifyLeads = leads.filter(l => l.source === 'apify' || l.source === 'google_maps');
  const otherLeads = leads.filter(l => l.source !== 'apify' && l.source !== 'google_maps');
  
  // For non-Apify leads, only enrich top N by quality score
  const topOtherLeads = otherLeads
    .sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0))
    .slice(0, Math.max(0, maxToEnrich - apifyLeads.length));
  
  const remainingOtherLeads = otherLeads.filter(l => !topOtherLeads.includes(l));
  
  // Combine: ALL Apify leads + top other leads
  const leadsToEnrich = [...apifyLeads, ...topOtherLeads];
  
  console.log(`[super-discovery] Enriching ${leadsToEnrich.length} leads with Perplexity (${apifyLeads.length} Apify + ${topOtherLeads.length} other)${isOvernightMode ? ' (overnight mode)' : ''}`);
  
  const enrichedLeads = await enrichBatch(leadsToEnrich, setting);
  return [...enrichedLeads, ...remainingOtherLeads];
}

/**
 * Enrich a batch of leads with rate limiting
 */
async function enrichBatch(leadsToEnrich: any[], _setting: any): Promise<any[]> {
  // Enrich in parallel batches (limit concurrency to avoid rate limits)
  const BATCH_SIZE = 5;
  const enrichedLeads: any[] = [];
  
  for (let i = 0; i < leadsToEnrich.length; i += BATCH_SIZE) {
    const batch = leadsToEnrich.slice(i, i + BATCH_SIZE);
    const enrichPromises = batch.map(async (lead: any) => {
      try {
        const enriched = await enrichSingleLeadStructured(lead);
        return { ...lead, ...enriched, wasEnriched: true, enrichmentTier: 'deep' };
      } catch (error) {
        console.error(`[super-discovery] Failed to enrich ${lead.name}:`, error);
        return lead;
      }
    });
    
    const batchResults = await Promise.all(enrichPromises);
    enrichedLeads.push(...batchResults);
    
    // Small delay between batches to avoid rate limits
    if (i + BATCH_SIZE < leadsToEnrich.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  return enrichedLeads;
}

/**
 * Enrich a single lead with Perplexity - extracts STRUCTURED data including:
 * - Company description, products, technologies
 * - Social profiles (LinkedIn, Twitter, Facebook, Instagram, YouTube, TikTok)
 * - Key executives/team contacts
 * - Contact info (phone, email)
 * - Suggested tags for categorization
 */
async function enrichSingleLeadStructured(lead: any): Promise<any> {
  const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
  if (!PERPLEXITY_API_KEY) return {};
  
  try {
    const companyIdentifier = lead.website 
      ? `${lead.name} (${lead.website})`
      : lead.name;
    
    const structuredPrompt = `Research the company "${companyIdentifier}" and return ONLY a valid JSON object with the following structure. Do not include any text before or after the JSON.

{
  "description": "Detailed company description (200+ characters). What they do, their mission, main business.",
  "products": "Main products or services offered, separated by commas",
  "recentNews": "Any recent news, funding, or announcements from 2024-2025. Say 'No recent news found' if none.",
  "fundingInfo": "Funding stage, amount raised, or investors if known. Say 'Not available' if unknown.",
  "employeeCount": 0,
  "companyPhone": "Main phone number or null",
  "generalEmail": "General contact email or null",
  "suggestedTags": ["industry tag", "category tag", "specialty tag"],
  "socialProfiles": {
    "linkedin": "LinkedIn company URL or null",
    "twitter": "Twitter/X URL or null",
    "facebook": "Facebook URL or null",
    "instagram": "Instagram URL or null",
    "youtube": "YouTube channel URL or null",
    "tiktok": "TikTok URL or null"
  },
  "keyExecutives": [
    {"name": "Full Name", "title": "Job Title", "email": null, "linkedin": null}
  ],
  "technologies": "Key technologies used, separated by commas"
}

Important: 
- Return ONLY valid JSON, no markdown code blocks
- Use null for unknown fields, not empty strings
- Include 3-5 relevant industry/category tags in suggestedTags
- Find at least 2-3 key executives if possible (CEO, Founder, etc.)
- Search thoroughly for social media profiles`;

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: 'You are a business research assistant. Return only valid JSON, no explanations or markdown. Search thoroughly for company information.'
          },
          {
            role: 'user',
            content: structuredPrompt
          }
        ],
      }),
    });
    
    if (!response.ok) {
      console.error(`[super-discovery] Perplexity API error for ${lead.name}: ${response.status}`);
      return {};
    }
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // Parse the JSON response
    let parsed: any = {};
    try {
      // Clean up potential markdown code blocks
      let jsonStr = content.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.slice(7);
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.slice(3);
      }
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.slice(0, -3);
      }
      jsonStr = jsonStr.trim();
      
      parsed = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error(`[super-discovery] Failed to parse Perplexity JSON for ${lead.name}:`, parseError);
      // Fall back to storing raw content
      return {
        enrichment_data: {
          perplexity_summary: content,
          enriched_at: new Date().toISOString(),
          citations: data.citations,
          parseError: true,
        },
      };
    }
    
    // Return structured enrichment data
    return {
      // Merge into lead root for compatibility
      description: parsed.description || lead.description,
      products: parsed.products || lead.products,
      recentNews: parsed.recentNews || lead.recentNews,
      fundingInfo: parsed.fundingInfo || lead.fundingInfo,
      employeeCount: parsed.employeeCount || lead.employeeCount,
      companyPhone: parsed.companyPhone || lead.companyPhone,
      generalEmail: parsed.generalEmail || lead.generalEmail,
      technologies: parsed.technologies,
      suggestedTags: parsed.suggestedTags || [],
      
      // Social profiles - merge with existing
      socialProfiles: {
        ...(lead.socialProfiles || {}),
        ...cleanSocialProfiles(parsed.socialProfiles || {}),
      },
      
      // Key executives as contacts
      keyExecutives: parsed.keyExecutives || [],
      contacts: mergeContacts(lead.contacts, parsed.keyExecutives),
      
      // Store full enrichment data
      enrichment_data: {
        ...parsed,
        perplexity_summary: parsed.description,
        enriched_at: new Date().toISOString(),
        citations: data.citations,
        model: 'sonar',
      },
    };
  } catch (error) {
    console.error(`[super-discovery] Error enriching ${lead.name}:`, error);
    return {};
  }
}

/**
 * Clean and validate social profile URLs
 */
function cleanSocialProfiles(profiles: any): any {
  const cleaned: any = {};
  const platforms = ['linkedin', 'twitter', 'facebook', 'instagram', 'youtube', 'tiktok'];
  
  for (const platform of platforms) {
    const url = profiles[platform];
    if (url && typeof url === 'string' && url.startsWith('http')) {
      cleaned[platform] = url;
    }
  }
  
  return cleaned;
}

/**
 * Merge existing contacts with new key executives
 */
function mergeContacts(existingContacts: any[], keyExecutives: any[]): any[] {
  const contacts = [...(existingContacts || [])];
  
  if (!keyExecutives || !Array.isArray(keyExecutives)) {
    return contacts;
  }
  
  for (const exec of keyExecutives) {
    if (!exec.name) continue;
    
    // Check if contact already exists
    const exists = contacts.some(c => 
      c.name?.toLowerCase() === exec.name?.toLowerCase()
    );
    
    if (!exists) {
      contacts.push({
        name: exec.name,
        title: exec.title,
        email: exec.email || null,
        linkedinUrl: exec.linkedin || null,
        department: 'Executive',
      });
    }
  }
  
  return contacts;
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
): Promise<{ total: number; autoApproved: number; pending: number; emailsExtracted: number; contactsCreated: number; sequencesEnrolled: number }> {
  const userId = setting.user_id;
  const result = { total: 0, autoApproved: 0, pending: 0, emailsExtracted: 0, contactsCreated: 0, sequencesEnrolled: 0 };
  
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
  // In full_auto_mode, approve ALL leads regardless of threshold
  const autonomousLeadsToInsert = newLeads.map((lead: any) => {
    let status = 'pending';
    
    if (setting.full_auto_mode) {
      // Full Auto Mode: Approve all leads for outreach
      status = 'auto_approved';
    } else if (setting.auto_approve_threshold && lead.qualityScore >= setting.auto_approve_threshold) {
      // Standard mode: Use threshold-based approval
      status = 'auto_approved';
    }

    if (status === 'auto_approved') result.autoApproved++;
    else result.pending++;

    // Build comprehensive company_data with all enrichment fields
    const companyData = {
      ...lead,
      // Ensure social profiles are included
      socialProfiles: lead.socialProfiles || {},
      // Ensure key executives are included
      keyExecutives: lead.keyExecutives || [],
      // Ensure contacts are merged
      contacts: lead.contacts || [],
      // Include suggested tags for auto-tagging
      suggestedTags: lead.suggestedTags || [],
      // Include products and technologies
      products: lead.products,
      technologies: lead.technologies,
      // Include funding and news
      recentNews: lead.recentNews,
      fundingInfo: lead.fundingInfo,
      // Contact info
      companyPhone: lead.companyPhone,
      generalEmail: lead.generalEmail,
      // Enrichment metadata
      wasEnriched: lead.wasEnriched || false,
      enrichmentTier: lead.enrichmentTier || 'basic',
    };

    return {
      user_id: userId,
      discovery_run_id: discoveryRunId,
      persona_id: persona?.id || null,
      status,
      quality_score: lead.qualityScore || 0,
      company_data: companyData,
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

  const shouldExtractAll = setting.full_auto_mode || setting.auto_extract_all_emails;
  const extractLimit = Math.min(setting.max_leads_per_run ?? 100, shouldExtractAll ? 100 : 50);

  // Fetch inserted autonomous_leads (with ids) for this run
  const { data: insertedRows, error: fetchInsertedError } = await supabase
    .from('autonomous_leads')
    .select('id, company_name, company_website, company_data, status, quality_score, industry, sources_used, persona_id')
    .eq('discovery_run_id', discoveryRunId)
    .eq('user_id', userId);

  if (!fetchInsertedError && insertedRows?.length) {
    // Step 1: Run find-email BEFORE saving to companies (extract one-by-one; only sendable leads get added)
    const leadIdsNeedingEmail: string[] = [];
    for (const row of insertedRows) {
      const companyData = (row.company_data || {}) as Record<string, any>;
      const hasEmail = companyData.generalEmail || companyData.general_email || companyData.email;
      const hasWebsite = row.company_website && !String(row.company_website).includes('no-website') && String(row.company_website).trim() !== '';
      if (!hasEmail && hasWebsite) leadIdsNeedingEmail.push(row.id);
    }
    const toExtract = leadIdsNeedingEmail.slice(0, extractLimit);
    if ((setting.auto_extract_emails || shouldExtractAll) && toExtract.length > 0) {
      console.log(`[super-discovery] Auto-extracting emails for ${toExtract.length} leads (before saving to companies)`);
      try {
        const extractResponse = await fetch(`${SUPABASE_URL}/functions/v1/bulk-extract-emails`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            leadIds: toExtract,
            createContact: false,
            stream: false,
          }),
        });
        if (extractResponse.ok) {
          const extractResult = await extractResponse.json();
          result.emailsExtracted = extractResult.emailsFound || 0;
          console.log(`[super-discovery] Email extraction complete: ${result.emailsExtracted} emails found`);
        } else {
          console.error(`[super-discovery] Email extraction failed: ${extractResponse.status}`);
        }
      } catch (extractError) {
        console.error('[super-discovery] Email extraction error:', extractError);
      }
    }

    // Step 2: Re-fetch so company_data includes any extracted generalEmail
    const { data: rowsAfterExtract } = await supabase
      .from('autonomous_leads')
      .select('id, company_name, company_website, company_data, status, quality_score, industry, sources_used, persona_id')
      .eq('discovery_run_id', discoveryRunId)
      .eq('user_id', userId);

    const allRows = rowsAfterExtract || insertedRows;
    const hasEmail = (row: any) => {
      const d = (row.company_data || {}) as Record<string, any>;
      return !!(d.generalEmail || d.general_email || d.email);
    };
    // Step 3: Save to companies ONLY leads that have an email (auto-send only gets sendable leads)
    const leadsToSaveRows = allRows.filter((row: any) => row.status === 'auto_approved' && hasEmail(row));

    console.log(`[super-discovery] Saving ${leadsToSaveRows.length} leads with emails to companies (of ${allRows.length} total)`);

    for (const row of leadsToSaveRows) {
      const leadForSave = {
        company_name: row.company_name,
        company_website: row.company_website,
        company_data: row.company_data,
        industry: row.industry,
        contacts: (row.company_data as any)?.contacts || [],
        status: row.status,
        quality_score: row.quality_score,
        sources_used: row.sources_used,
      };
      const companyId = await saveLeadToCompanies(supabase, leadForSave, userId);
      if (companyId) {
        result.contactsCreated += 1;
        const sequenceId = persona?.auto_enroll_sequence_id ?? (setting.auto_enroll_enabled ? setting.auto_enroll_sequence_id : null);
        if (sequenceId) {
          await enrollInSequence(supabase, companyId, sequenceId);
          result.sequencesEnrolled++;
        }
        await trackAutoApprovalFeedback(supabase, userId, leadForSave, persona);
      }
    }

    const webhookUrl = setting.slack_webhook_url || setting.discord_webhook_url || setting.webhook_url;
    if (setting.webhook_enabled && webhookUrl && leadsToSaveRows.length > 0 && setting.notify_on_auto_approve) {
      const highQualityLeads = leadsToSaveRows.filter(
        (r: any) => (r.quality_score || 0) >= (setting.notify_min_quality_score || 70)
      );
      if (highQualityLeads.length > 0) {
        await sendWebhookNotification(webhookUrl, {
          type: 'auto_approved_leads',
          persona: persona?.name || 'Default',
          count: highQualityLeads.length,
          leads: highQualityLeads.map((r: any) => ({
            name: r.company_name,
            website: r.company_website,
            industry: r.industry,
            qualityScore: r.quality_score,
            sources: r.sources_used,
          })),
        });
      }
    }
  }

  // Send webhook for pending leads if webhook enabled
  const pendingLeads = autonomousLeadsToInsert.filter(l => l.status === 'pending');
  const pendingWebhookUrl = setting.slack_webhook_url || setting.discord_webhook_url || setting.webhook_url;
  if (setting.webhook_enabled && pendingWebhookUrl && pendingLeads.length > 0) {
    const notifiableLeads = pendingLeads.filter(
      l => l.quality_score >= (setting.notify_min_quality_score || 70)
    );
    
    if (notifiableLeads.length > 0) {
      await sendWebhookNotification(pendingWebhookUrl, {
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
 * Generate AI-powered email content using enriched company data
 */
async function generateAIEmailContent(
  lead: any,
  persona: any,
  contact: any,
  senderProfile: any,
  businessProfile: any
): Promise<{ subject: string; body: string } | null> {
  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      console.warn('[ai-email] OpenAI API key not configured');
      return null;
    }

    // Extract enrichment data
    const enrichmentData = lead.enrichment_data || lead.company_data || {};
    const companyDescription = enrichmentData.description || enrichmentData.perplexity_summary || '';
    const recentNews = enrichmentData.recent_news || '';
    const products = Array.isArray(enrichmentData.products) ? enrichmentData.products.join(', ') : (enrichmentData.products || '');
    const technologies = Array.isArray(enrichmentData.technologies) ? enrichmentData.technologies.join(', ') : '';
    const employees = enrichmentData.employee_count || lead.company_size || '';
    const funding = enrichmentData.funding || '';

    // Build sender info
    const senderName = senderProfile?.full_name || 'Your Name';
    const senderTitle = senderProfile?.job_title || '';
    const senderCompany = businessProfile?.company_name || '';
    const senderEmail = senderProfile?.email || '';
    const senderPhone = senderProfile?.phone || businessProfile?.phone || '';
    const senderWebsite = senderProfile?.website || businessProfile?.website || '';

    const emailSignature = `Best regards,
${senderName}
${senderTitle}
${senderCompany}${senderEmail ? '\n' + senderEmail : ''}${senderPhone ? '\n' + senderPhone : ''}${senderWebsite ? '\n' + senderWebsite : ''}`;

    // Build persona context
    let personaContext = '';
    if (persona) {
      personaContext = `
MARKETING PERSONA CONTEXT:
${persona.product_focus ? `- Your Product/Service: ${persona.product_focus}` : ''}
${persona.value_proposition ? `- Your Value Proposition: ${persona.value_proposition}` : ''}
${persona.talking_points?.length ? `- Key Talking Points: ${persona.talking_points.join(', ')}` : ''}
${persona.call_to_action ? `- Call to Action: ${persona.call_to_action}` : ''}
${persona.email_tone ? `- Tone: ${persona.email_tone}` : ''}
`;
    }

    // Build comprehensive company research context
    const companyResearch = `
RESEARCHED COMPANY INTELLIGENCE:
- Company: ${lead.company_name}
- Industry: ${lead.industry || 'Unknown'}
- Size: ${employees || 'Unknown'}
- Location: ${lead.geography || 'Unknown'}
${companyDescription ? `- About: ${companyDescription.slice(0, 500)}` : ''}
${products ? `- Products/Services: ${products}` : ''}
${recentNews ? `- Recent News: ${recentNews.slice(0, 300)}` : ''}
${technologies ? `- Tech Stack: ${technologies}` : ''}
${funding ? `- Funding: ${funding}` : ''}
`;

    const systemPrompt = `You are an expert B2B sales email writer. Write highly personalized, research-driven outreach emails that demonstrate genuine understanding of the prospect's business. Use the researched company intelligence to create relevant, compelling emails that feel hand-crafted, not templated.

CRITICAL RULES:
- Reference specific details from the company research (their products, news, industry challenges)
- NEVER use brackets [like this] or placeholders
- Keep emails concise (150-200 words max)
- Sound human and conversational, not salesy
- Make a clear connection between their business needs and how you can help`;

    const userPrompt = `Write a personalized cold outreach email to ${contact.name || 'the decision maker'}${contact.title ? ` (${contact.title})` : ''} at ${lead.company_name}.

${companyResearch}

${personaContext}

You are: ${senderName}${senderTitle ? `, ${senderTitle}` : ''}${senderCompany ? ` from ${senderCompany}` : ''}

REQUIREMENTS:
1. Open with something specific about THEIR company (from the research above)
2. Bridge naturally to how you can help based on their situation
3. ${persona?.call_to_action || 'End with a soft ask for a 15-minute call'}
4. Use this EXACT signature:

${persona?.email_signature_override || emailSignature}

Return ONLY valid JSON: {"subject": "...", "body": "..."}`;

    console.log(`[ai-email] Generating email for ${lead.company_name} / ${contact.name}`);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'format_email',
              description: 'Format the email with subject and body',
              parameters: {
                type: 'object',
                properties: {
                  subject: { type: 'string', description: 'The email subject line' },
                  body: { type: 'string', description: 'The complete email body text' }
                },
                required: ['subject', 'body'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'format_email' } }
      }),
    });

    if (!response.ok) {
      console.error(`[ai-email] OpenAI error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      const result = JSON.parse(toolCall.function.arguments);
      console.log(`[ai-email] Generated email for ${lead.company_name}: "${result.subject}"`);
      return result;
    }

    // Fallback parsing
    const content = data.choices?.[0]?.message?.content;
    if (content) {
      let jsonStr = content;
      if (jsonStr.includes('```json')) {
        jsonStr = jsonStr.split('```json')[1].split('```')[0].trim();
      } else if (jsonStr.includes('```')) {
        jsonStr = jsonStr.split('```')[1].split('```')[0].trim();
      }
      return JSON.parse(jsonStr);
    }

    return null;
  } catch (error) {
    console.error(`[ai-email] Error generating email for ${lead.company_name}:`, error);
    return null;
  }
}

/**
 * Create auto campaigns for auto-approved leads with AI-generated content
 */
async function createAutoCampaigns(
  supabase: any,
  setting: any,
  discoveryRunId: string
): Promise<number> {
  if (!setting.auto_create_campaign) return 0;

  console.log(`[super-discovery] Creating auto campaigns for discovery run ${discoveryRunId}`);

  // In full_auto_mode, get ALL leads with company_id (not just auto_approved)
  // This ensures campaigns are created for all discovered leads in hands-free mode
  let leadsQuery = supabase
    .from('autonomous_leads')
    .select('*, company_id, enrichment_data, company_data')
    .eq('discovery_run_id', discoveryRunId)
    .not('company_id', 'is', null);
  
  // Only filter by status if NOT in full_auto_mode
  if (!setting.full_auto_mode) {
    leadsQuery = leadsQuery.eq('status', 'auto_approved');
  }
  
  const { data: leadsForCampaign } = await leadsQuery;

  if (!leadsForCampaign || leadsForCampaign.length === 0) {
    console.log('[super-discovery] No leads with company_id to create campaigns for');
    return 0;
  }
  
  console.log(`[super-discovery] Found ${leadsForCampaign.length} leads for campaign creation (full_auto: ${setting.full_auto_mode})`);

  // Fetch sender profile and business profile for email generation
  const { data: senderProfile } = await supabase
    .from('profiles')
    .select('full_name, email, job_title, phone, website')
    .eq('id', setting.user_id)
    .single();

  const { data: businessProfile } = await supabase
    .from('business_profiles')
    .select('company_name, website, phone, email_signature')
    .eq('user_id', setting.user_id)
    .single();

  // Group by persona
  const byPersona = new Map<string | null, any[]>();
  for (const lead of leadsForCampaign) {
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
      // Get full persona details
      let persona: any = null;
      let personaName = 'General Discovery';
      
      if (personaId) {
        const { data: personaData } = await supabase
          .from('discovery_personas')
          .select('name, value_proposition, email_tone, talking_points, product_focus, call_to_action, email_signature_override')
          .eq('id', personaId)
          .single();
        
        if (personaData) {
          persona = personaData;
          personaName = personaData.name;
        }
      }

      // Get contacts for the companies with their lead data
      const companyIds = leads.map((l: any) => l.company_id);
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id, name, email, title, company_id')
        .in('company_id', companyIds)
        .not('email', 'is', null);

      if (!contacts || contacts.length === 0) {
        console.log(`[super-discovery] No contacts with emails for persona ${personaName}`);
        continue;
      }

      // Create lead lookup map
      const leadsByCompanyId = new Map();
      for (const lead of leads) {
        leadsByCompanyId.set(lead.company_id, lead);
      }

      // Generate AI content for the first lead as template (or personalize per recipient)
      const firstLead = leads[0];
      const firstContact = contacts.find((c: any) => c.company_id === firstLead.company_id) || contacts[0];
      
      // Generate AI-powered email template using enriched data
      let aiEmail = await generateAIEmailContent(
        firstLead,
        persona,
        firstContact,
        senderProfile,
        businessProfile
      );

      // Fallback to static template if AI generation fails
      const subjectTemplate = aiEmail?.subject || `Quick question for {{name}}`;
      const bodyTemplate = aiEmail?.body || `Hi {{name}},\n\nI noticed {{company}} and wanted to reach out about how we can help.\n\n${persona?.value_proposition || 'We help businesses streamline their operations.'}\n\nBest regards`;

      // Convert to HTML
      const bodyHtmlTemplate = `<p>${bodyTemplate.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br/>')}</p>`;

      // Create draft campaign
      const campaignName = `Auto Discovery - ${personaName} - ${new Date().toLocaleDateString()}`;
      
      const { data: campaign, error: campaignError } = await supabase
        .from('email_campaigns')
        .insert({
          user_id: setting.user_id,
          name: campaignName,
          status: setting.full_auto_mode ? 'scheduled' : 'draft',
          scheduled_at: setting.full_auto_mode ? calculateCampaignSendTime(setting) : null,
          subject_template: subjectTemplate,
          body_text_template: bodyTemplate,
          body_html_template: bodyHtmlTemplate,
          total_recipients: contacts.length,
          metadata: {
            ai_generated: true,
            persona_id: personaId,
            discovery_run_id: discoveryRunId,
            leads_count: leads.length,
          }
        })
        .select('id')
        .single();

      if (campaignError) {
        console.error(`[super-discovery] Failed to create campaign:`, campaignError);
        continue;
      }

      // Generate personalized content for each recipient if in full auto mode
      if (setting.full_auto_mode && contacts.length <= 20) {
        console.log(`[super-discovery] Generating personalized emails for ${contacts.length} recipients`);
        
        for (const contact of contacts) {
          const lead = leadsByCompanyId.get(contact.company_id);
          if (!lead) continue;

          const personalizedEmail = await generateAIEmailContent(
            lead,
            persona,
            contact,
            senderProfile,
            businessProfile
          );

          if (personalizedEmail) {
            // Store personalized content for this recipient
            await supabase
              .from('email_campaign_recipients')
              .insert({
                campaign_id: campaign.id,
                contact_id: contact.id,
                personalized_subject: personalizedEmail.subject,
                personalized_body: personalizedEmail.body,
                status: 'pending',
              });
          } else {
            // Use campaign template
            await supabase
              .from('email_campaign_recipients')
              .insert({
                campaign_id: campaign.id,
                contact_id: contact.id,
                status: 'pending',
              });
          }
        }
      } else {
        // Just add recipients without personalized content
        const recipientInserts = contacts.map((c: any) => ({
          campaign_id: campaign.id,
          contact_id: c.id,
          status: 'pending',
        }));

        await supabase
          .from('email_campaign_recipients')
          .insert(recipientInserts);
      }

      // Link leads to campaign
      await supabase
        .from('autonomous_leads')
        .update({ campaign_id: campaign.id })
        .in('id', leads.map((l: any) => l.id));

      campaignsCreated++;
      console.log(`[super-discovery] Created AI-powered campaign "${campaignName}" with ${contacts.length} recipients`);

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
 * Send hot lead alerts for leads exceeding the threshold
 */
async function sendHotLeadAlerts(
  supabase: any,
  setting: any,
  discoveryRunId: string,
  webhookUrl: string
): Promise<void> {
  try {
    const hotLeadThreshold = setting.hot_lead_threshold || 85;
    
    // Get hot leads from this run
    const { data: hotLeads } = await supabase
      .from('autonomous_leads')
      .select('company_name, company_website, industry, quality_score, sources_used')
      .eq('discovery_run_id', discoveryRunId)
      .gte('quality_score', hotLeadThreshold)
      .order('quality_score', { ascending: false })
      .limit(10);

    if (!hotLeads || hotLeads.length === 0) return;

    const isSlack = webhookUrl.includes('hooks.slack.com');
    const isDiscord = webhookUrl.includes('discord.com/api/webhooks');

    let payload: any;

    if (isSlack) {
      payload = {
        text: `🔥 Hot Leads Alert!`,
        blocks: [
          { type: 'header', text: { type: 'plain_text', text: `🔥 ${hotLeads.length} Hot Leads Discovered!` } },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Quality Score ≥ ${hotLeadThreshold}%*\n\n` +
                hotLeads.map((l: any) => 
                  `• *${l.company_name}* (${l.industry || 'Unknown'}) - *${l.quality_score}%*`
                ).join('\n'),
            },
          },
        ],
      };
    } else if (isDiscord) {
      payload = {
        embeds: [{
          title: `🔥 ${hotLeads.length} Hot Leads Discovered!`,
          description: `**Quality Score ≥ ${hotLeadThreshold}%**\n\n` +
            hotLeads.map((l: any) => 
              `• **${l.company_name}** (${l.industry || 'Unknown'}) - **${l.quality_score}%**`
            ).join('\n'),
          color: 0xf97316, // Orange for hot leads
        }],
      };
    } else {
      payload = { event: 'hot_leads', threshold: hotLeadThreshold, leads: hotLeads };
    }

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    console.log(`[super-discovery] Hot lead alert sent for ${hotLeads.length} leads`);
  } catch (error) {
    console.error('[super-discovery] Error sending hot lead alert:', error);
  }
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

/**
 * Compute next run time as the next occurrence of preferredHour (0-23) in the user's timezone.
 * Returns a Date (UTC) so discovery runs at e.g. 9:00 AM London, not 9:00 UTC.
 */
function calculateNextRun(frequency: string, preferredHour: number = 9, timezone: string = 'Europe/London'): Date {
  const now = new Date();
  const tz = timezone && timezone.trim() ? timezone : 'Europe/London';

  // Find next moment when it's preferredHour:00 in the user's timezone (search next 8 days for weekly)
  const daysToSearch = frequency === 'weekly' ? 8 : frequency === 'twice_weekly' ? 4 : 2;
  for (let d = 0; d < daysToSearch; d++) {
    const day = new Date(now);
    day.setUTCDate(day.getUTCDate() + d);
    day.setUTCHours(0, 0, 0, 0);
    for (let utcHour = 0; utcHour < 24; utcHour++) {
      const candidate = new Date(day);
      candidate.setUTCHours(utcHour, 0, 0, 0);
      if (candidate <= now) continue;
      try {
        const hourInTz = parseInt(
          new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: tz }).format(candidate),
          10
        );
        const minInTz = parseInt(
          new Intl.DateTimeFormat('en-US', { minute: '2-digit', hour12: false, timeZone: tz }).format(candidate),
          10
        );
        if (hourInTz === preferredHour && minInTz === 0) return candidate;
      } catch {
        // Invalid TZ: fall back to UTC
        if (utcHour === preferredHour) return candidate;
      }
    }
  }

  // Fallback: tomorrow at preferredHour UTC (legacy)
  const next = new Date(now);
  next.setUTCDate(next.getUTCDate() + 1);
  next.setUTCHours(preferredHour, 0, 0, 0);
  return next;
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
    
    // Build enrichment data with all structured fields
    const enrichmentData = {
      ...(lead.enrichment_data || {}),
      products: companyData.products,
      technologies: companyData.technologies,
      recentNews: companyData.recentNews,
      fundingInfo: companyData.fundingInfo,
      suggestedTags: companyData.suggestedTags,
      wasEnriched: companyData.wasEnriched,
      enrichmentTier: companyData.enrichmentTier,
    };
    
    // Extract LinkedIn URL from social profiles if not set directly
    const linkedinUrl = companyData.linkedinUrl || 
      companyData.socialProfiles?.linkedin || 
      null;
    
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
        linkedin_url: linkedinUrl,
        company_phone: companyData.companyPhone,
        general_email: companyData.generalEmail,
        social_profiles: companyData.socialProfiles || {},
        key_executives: companyData.keyExecutives || [],
        employee_count: companyData.employeeCount,
        recent_news: companyData.recentNews,
        enrichment_data: enrichmentData,
        enrichment_status: companyData.wasEnriched ? 'completed' : 'pending',
        enrichment_provider: companyData.wasEnriched ? 'perplexity' : null,
        enriched_at: companyData.wasEnriched ? new Date().toISOString() : null,
        // Extract tech stack from technologies string
        tech_stack: companyData.technologies 
          ? companyData.technologies.split(',').map((t: string) => t.trim()).filter(Boolean)
          : [],
      })
      .select('id')
      .single();

    if (error) {
      console.error('[super-discovery] Error saving company:', error);
      return null;
    }

    // Update autonomous lead with company_id
    await supabase
      .from('autonomous_leads')
      .update({ company_id: company.id, reviewed_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('company_name', lead.company_name)
      .eq('status', 'auto_approved');

    // Save contacts including key executives merged in
    const contacts = lead.contacts || companyData.contacts || [];
    if (contacts.length > 0 && company.id) {
      const contactsToInsert = contacts.map((c: any, idx: number) => ({
        company_id: company.id,
        name: c.name,
        email: c.email || null,
        email_verified: c.emailVerified || false,
        linkedin_url: c.linkedinUrl || c.linkedin || null,
        title: c.title,
        department: c.department || 'Executive',
        phone: c.phone || null,
        is_primary_contact: idx === 0, // First contact is primary
      }));
      
      await supabase.from('contacts').insert(contactsToInsert);
      console.log(`[super-discovery] Added ${contactsToInsert.length} contacts for company ${lead.company_name}`);
    } else if (company.id) {
      // No contacts array: create one contact from general email so campaigns can be created
      const generalEmail =
        companyData.generalEmail ??
        companyData.general_email ??
        lead.general_email ??
        lead.generalEmail;
      const email = typeof generalEmail === 'string' ? generalEmail.trim() : '';
      if (email) {
        await supabase.from('contacts').insert({
          company_id: company.id,
          name: 'Primary',
          email,
          email_verified: false,
          linkedin_url: null,
          title: null,
          department: 'General',
          phone: null,
          is_primary_contact: true,
        });
        console.log(`[super-discovery] Created primary contact from general_email for company ${lead.company_name}`);
      }
    }

    // Auto-apply suggested tags + industry tag + source tag for grouping on Companies page
    const tagsToApply: string[] = ['Autopilot'];
    
    // Add suggested tags from enrichment
    const suggestedTags = companyData.suggestedTags || [];
    tagsToApply.push(...suggestedTags);
    
    // Automatically add industry as a tag if available
    if (lead.industry) {
      tagsToApply.push(lead.industry);
    }
    
    // Remove duplicates and apply
    const uniqueTags = Array.from(new Set(tagsToApply.filter(Boolean)));
    if (uniqueTags.length > 0 && company.id) {
      await applySuggestedTags(supabase, userId, company.id, uniqueTags);
    }

    return company.id;
  } catch (error) {
    console.error('[super-discovery] Error in saveLeadToCompanies:', error);
    return null;
  }
}

/**
 * Apply suggested tags to a company, creating new tags if they don't exist
 */
async function applySuggestedTags(
  supabase: any, 
  userId: string, 
  companyId: string, 
  tags: string[]
): Promise<void> {
  try {
    for (const tagName of tags) {
      if (!tagName || typeof tagName !== 'string') continue;
      
      const normalizedTag = tagName.trim().toLowerCase();
      if (!normalizedTag) continue;
      
      // Check if tag preset exists
      const { data: existingTag } = await supabase
        .from('company_tag_presets')
        .select('id')
        .eq('user_id', userId)
        .ilike('name', normalizedTag)
        .maybeSingle();
      
      let tagId: string;
      
      if (existingTag) {
        tagId = existingTag.id;
      } else {
        // Create new tag preset
        const { data: newTag, error: createError } = await supabase
          .from('company_tag_presets')
          .insert({
            user_id: userId,
            name: tagName.trim(),
            category: 'ai-suggested',
            color: getTagColor(tagName),
          })
          .select('id')
          .single();
        
        if (createError || !newTag) {
          console.error(`[super-discovery] Failed to create tag "${tagName}":`, createError);
          continue;
        }
        tagId = newTag.id;
      }
      
      // Add tag to company's tags array
      const { data: company } = await supabase
        .from('companies')
        .select('tags')
        .eq('id', companyId)
        .single();
      
      const currentTags = company?.tags || [];
      if (!currentTags.includes(tagName.trim())) {
        await supabase
          .from('companies')
          .update({ tags: [...currentTags, tagName.trim()] })
          .eq('id', companyId);
      }
    }
    
    console.log(`[super-discovery] Applied ${tags.length} suggested tags to company`);
  } catch (error) {
    console.error('[super-discovery] Error applying suggested tags:', error);
  }
}

/**
 * Generate a color for a tag based on its name
 */
function getTagColor(tagName: string): string {
  const colors = [
    '#3b82f6', // blue
    '#22c55e', // green
    '#f97316', // orange
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#14b8a6', // teal
    '#f59e0b', // amber
    '#6366f1', // indigo
  ];
  
  // Simple hash to pick a consistent color
  let hash = 0;
  for (let i = 0; i < tagName.length; i++) {
    hash = ((hash << 5) - hash) + tagName.charCodeAt(i);
    hash = hash & hash;
  }
  
  return colors[Math.abs(hash) % colors.length];
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
