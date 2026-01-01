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

/**
 * Autonomous Lead Discovery - Daily cron job or manual trigger
 * Discovers leads for users with enabled autonomous discovery settings
 * Now supports persona-based targeting
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[autonomous-lead-discovery] Starting autonomous lead discovery run');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Check if this is a manual trigger for a specific user
  let manualUserId: string | null = null;
  let forceRun = false;
  
  try {
    const body = await req.json().catch(() => ({}));
    manualUserId = body.userId || null;
    forceRun = body.forceRun || false;
    
    if (manualUserId) {
      console.log(`[autonomous-lead-discovery] Manual trigger for user: ${manualUserId}`);
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
      console.error('[autonomous-lead-discovery] Error fetching settings:', settingsError);
      throw settingsError;
    }

    if (!settings || settings.length === 0) {
      console.log('[autonomous-lead-discovery] No users with enabled autonomous discovery');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No users with enabled autonomous discovery',
        processed: 0 
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[autonomous-lead-discovery] Found ${settings.length} users with enabled discovery`);

    let processedCount = 0;
    let leadsDiscovered = 0;

    for (const setting of settings) {
      try {
        // Check if it's time to run based on frequency (skip for manual triggers with forceRun)
        if (!forceRun && !manualUserId) {
          const shouldRun = shouldRunDiscovery(setting);
          if (!shouldRun) {
            console.log(`[autonomous-lead-discovery] Skipping user ${setting.user_id} - not scheduled to run yet`);
            continue;
          }
        }

        console.log(`[autonomous-lead-discovery] Processing user ${setting.user_id}`);

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
          console.error(`[autonomous-lead-discovery] Error fetching personas for user ${setting.user_id}:`, personasError);
        }

        const activePersonas = (personas || []) as Persona[];
        console.log(`[autonomous-lead-discovery] Found ${activePersonas.length} active personas for user ${setting.user_id}`);

        // Generate discovery run ID
        const discoveryRunId = crypto.randomUUID();

        // If user has personas, run discovery for each persona
        if (activePersonas.length > 0) {
          for (const persona of activePersonas) {
            console.log(`[autonomous-lead-discovery] Processing persona: ${persona.name} (${persona.id})`);
            
            const personaLeads = await discoverLeadsForPersona(
              supabase,
              setting,
              persona,
              businessProfile,
              discoveryRunId
            );
            
            leadsDiscovered += personaLeads;
            
            // Update persona metrics
            if (personaLeads > 0) {
              await supabase
                .from('discovery_personas')
                .update({
                  total_leads_found: (persona as any).total_leads_found + personaLeads,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', persona.id);
            }
          }
        } else {
          // Fall back to main settings-based discovery (legacy behavior)
          console.log(`[autonomous-lead-discovery] No active personas, using main settings for user ${setting.user_id}`);
          
          const searchQuery = buildSearchQuery(setting, businessProfile);
          const leads = await runLeadFinder(supabase, setting, searchQuery, null);
          
          if (leads && leads.length > 0) {
            const savedLeads = await saveDiscoveredLeads(
              supabase,
              leads,
              setting,
              null, // No persona
              discoveryRunId
            );
            leadsDiscovered += savedLeads;
          }
        }

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
        console.log(`[autonomous-lead-discovery] Completed processing for user ${setting.user_id}`);

      } catch (userError) {
        console.error(`[autonomous-lead-discovery] Error processing user ${setting.user_id}:`, userError);
      }
    }

    console.log(`[autonomous-lead-discovery] Discovery run complete. Processed: ${processedCount}, Leads discovered: ${leadsDiscovered}`);

    return new Response(JSON.stringify({ 
      success: true,
      processed: processedCount,
      leadsDiscovered,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[autonomous-lead-discovery] Fatal error:', error);
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
 * Discover leads for a specific persona
 */
async function discoverLeadsForPersona(
  supabase: any,
  setting: any,
  persona: Persona,
  businessProfile: any,
  discoveryRunId: string
): Promise<number> {
  // Build search query from persona
  const searchQuery = buildPersonaSearchQuery(persona, businessProfile);
  
  console.log(`[autonomous-lead-discovery] Persona "${persona.name}" search query: ${searchQuery}`);
  
  // Run lead finder with persona-specific criteria
  const leads = await runLeadFinder(supabase, setting, searchQuery, persona);
  
  if (!leads || leads.length === 0) {
    console.log(`[autonomous-lead-discovery] No leads found for persona: ${persona.name}`);
    return 0;
  }
  
  // Filter out excluded industries/keywords
  const filteredLeads = leads.filter((lead: any) => {
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
  
  console.log(`[autonomous-lead-discovery] Filtered to ${filteredLeads.length} leads after exclusions`);
  
  // Save leads with persona reference
  const savedCount = await saveDiscoveredLeads(
    supabase,
    filteredLeads,
    setting,
    persona,
    discoveryRunId
  );
  
  return savedCount;
}

/**
 * Build search query from persona targeting criteria
 */
function buildPersonaSearchQuery(persona: Persona, businessProfile: any): string {
  // If persona has custom search query, use it
  if (persona.custom_search_query) {
    return persona.custom_search_query;
  }

  const parts: string[] = [];

  // Add persona keywords
  if (persona.target_keywords?.length) {
    parts.push(persona.target_keywords.join(' OR '));
  }

  // Add target industries
  if (persona.target_industries?.length) {
    parts.push(`in industries: ${persona.target_industries.join(', ')}`);
  }

  // Add target geographies
  if (persona.target_geographies?.length) {
    parts.push(`located in: ${persona.target_geographies.join(', ')}`);
  }

  // Add company sizes
  if (persona.target_company_sizes?.length) {
    parts.push(`company sizes: ${persona.target_company_sizes.join(', ')}`);
  }

  // Add business context if available
  if (businessProfile?.target_audience) {
    parts.push(`companies that match: ${businessProfile.target_audience}`);
  }

  return parts.length > 0 ? parts.join(' | ') : 'B2B companies with growth potential';
}

/**
 * Run lead finder with given search criteria
 */
async function runLeadFinder(
  supabase: any,
  setting: any,
  searchQuery: string,
  persona: Persona | null
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
      enrichWithPerplexity: setting.enrich_with_perplexity,
      useSerpApi: setting.use_serp_api,
      maxResults: setting.max_leads_per_run || 10,
      autonomousMode: true,
    }),
  });

  if (!leadFinderResponse.ok) {
    const errorText = await leadFinderResponse.text();
    console.error(`[autonomous-lead-discovery] Lead finder error:`, errorText);
    return [];
  }

  return await parseStreamingResponse(leadFinderResponse);
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
): Promise<number> {
  const userId = setting.user_id;
  
  // Get existing companies to avoid duplicates
  const { data: existingCompanies } = await supabase
    .from('companies')
    .select('name, website')
    .eq('user_id', userId);

  const existingNames = new Set((existingCompanies || []).map((c: any) => c.name?.toLowerCase()));
  const existingWebsites = new Set((existingCompanies || []).map((c: any) => c.website?.toLowerCase()).filter(Boolean));

  // Also check existing autonomous leads
  const { data: existingAutonomousLeads } = await supabase
    .from('autonomous_leads')
    .select('company_name, company_website')
    .eq('user_id', userId)
    .in('status', ['pending', 'approved', 'auto_approved']);

  const existingAutoNames = new Set((existingAutonomousLeads || []).map((l: any) => l.company_name?.toLowerCase()));
  const existingAutoWebsites = new Set((existingAutonomousLeads || []).map((l: any) => l.company_website?.toLowerCase()).filter(Boolean));

  // Filter out duplicates
  const newLeads = leads.filter((lead: any) => {
    const nameLower = lead.name?.toLowerCase();
    const websiteLower = lead.website?.toLowerCase();
    
    if (existingNames.has(nameLower) || existingAutoNames.has(nameLower)) return false;
    if (websiteLower && (existingWebsites.has(websiteLower) || existingAutoWebsites.has(websiteLower))) return false;
    
    return true;
  });

  if (newLeads.length === 0) {
    console.log(`[autonomous-lead-discovery] All leads already exist for user ${userId}`);
    return 0;
  }

  // Insert autonomous leads
  const autonomousLeadsToInsert = newLeads.map((lead: any) => {
    const status = setting.auto_approve_threshold && lead.qualityScore >= setting.auto_approve_threshold 
      ? 'auto_approved' 
      : 'pending';

    return {
      user_id: userId,
      discovery_run_id: discoveryRunId,
      persona_id: persona?.id || null, // Link to persona
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
      source: lead.source || 'exa',
    };
  });

  const { error: insertError } = await supabase
    .from('autonomous_leads')
    .insert(autonomousLeadsToInsert);

  if (insertError) {
    console.error(`[autonomous-lead-discovery] Error inserting leads:`, insertError);
    return 0;
  }

  console.log(`[autonomous-lead-discovery] Inserted ${newLeads.length} leads for user ${userId}`);

  // Auto-approve leads that meet threshold and save to companies
  const autoApprovedLeads = autonomousLeadsToInsert.filter(l => l.status === 'auto_approved');
  if (autoApprovedLeads.length > 0) {
    console.log(`[autonomous-lead-discovery] Auto-approving ${autoApprovedLeads.length} leads`);
    
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
        })),
      });
    }
  }

  return newLeads.length;
}

function shouldRunDiscovery(setting: any): boolean {
  const now = new Date();
  const lastRun = setting.last_run_at ? new Date(setting.last_run_at) : null;
  const nextRun = setting.next_run_at ? new Date(setting.next_run_at) : null;

  // If next_run_at is set and in the future, don't run
  if (nextRun && nextRun > now) {
    return false;
  }

  // If never run before, run now
  if (!lastRun) {
    return true;
  }

  // Check based on frequency
  const hoursSinceLastRun = (now.getTime() - lastRun.getTime()) / (1000 * 60 * 60);

  switch (setting.discovery_frequency) {
    case 'daily':
      return hoursSinceLastRun >= 24;
    case 'twice_weekly':
      return hoursSinceLastRun >= 84; // ~3.5 days
    case 'weekly':
      return hoursSinceLastRun >= 168; // 7 days
    default:
      return hoursSinceLastRun >= 24;
  }
}

function calculateNextRun(frequency: string): Date {
  const now = new Date();
  
  switch (frequency) {
    case 'daily':
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case 'twice_weekly':
      return new Date(now.getTime() + 84 * 60 * 60 * 1000);
    case 'weekly':
      return new Date(now.getTime() + 168 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }
}

function buildSearchQuery(setting: any, businessProfile: any): string {
  if (setting.custom_search_query) {
    return setting.custom_search_query;
  }

  const parts: string[] = [];

  if (businessProfile?.target_audience) {
    parts.push(`companies that match: ${businessProfile.target_audience}`);
  }

  if (businessProfile?.services_description) {
    parts.push(`potential customers for: ${businessProfile.services_description}`);
  }

  if (setting.target_industries?.length > 0) {
    parts.push(`in industries: ${setting.target_industries.join(', ')}`);
  }

  if (setting.target_geographies?.length > 0) {
    parts.push(`located in: ${setting.target_geographies.join(', ')}`);
  }

  if (setting.target_company_sizes?.length > 0) {
    parts.push(`company sizes: ${setting.target_company_sizes.join(', ')}`);
  }

  return parts.length > 0 ? parts.join(' | ') : 'B2B companies with growth potential';
}

async function parseStreamingResponse(response: Response): Promise<any[]> {
  const leads: any[] = [];
  const reader = response.body?.getReader();
  
  if (!reader) {
    return leads;
  }

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
            if (data.type === 'lead' && data.lead) {
              leads.push(data.lead);
            }
          } catch {
            // Skip invalid JSON lines
          }
        }
      }
    }
  } catch (error) {
    console.error('[autonomous-lead-discovery] Error parsing stream:', error);
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
      console.error('[autonomous-lead-discovery] Error saving company:', error);
      return null;
    }

    // Update the autonomous lead with the company_id
    await supabase
      .from('autonomous_leads')
      .update({ 
        company_id: company.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('company_name', lead.company_name)
      .eq('status', 'auto_approved');

    // Save contacts if any
    const contacts = lead.contacts || [];
    if (contacts.length > 0 && company.id) {
      const contactsToInsert = contacts.map((contact: any) => ({
        company_id: company.id,
        name: contact.name,
        email: contact.email,
        email_verified: contact.emailVerified,
        linkedin_url: contact.linkedinUrl,
        title: contact.title,
        department: contact.department,
        phone: contact.phone,
      }));

      await supabase.from('contacts').insert(contactsToInsert);
    }

    return company.id;

  } catch (error) {
    console.error('[autonomous-lead-discovery] Error in saveLeadToCompanies:', error);
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

    if (error) {
      console.error('[autonomous-lead-discovery] Error enrolling in sequence:', error);
    } else {
      console.log(`[autonomous-lead-discovery] Enrolled company ${companyId} in sequence ${sequenceId}`);
    }
  } catch (error) {
    console.error('[autonomous-lead-discovery] Error in enrollInSequence:', error);
  }
}

async function trackAutoApprovalFeedback(
  supabase: any, 
  userId: string, 
  lead: any,
  persona: Persona | null
): Promise<void> {
  try {
    // Insert feedback analytics
    await supabase.from('lead_feedback_analytics').insert({
      user_id: userId,
      action: 'auto_approved',
      quality_score: lead.quality_score,
      industry: lead.industry,
      geography: lead.geography,
      company_size: lead.company_size,
      source: lead.source,
      time_to_decision_seconds: 0, // Auto-approved immediately
    });

    // Update learned preferences via RPC
    await supabase.rpc('update_discovery_learning', {
      p_user_id: userId,
      p_action: 'auto_approved',
      p_industry: lead.industry,
      p_geography: lead.geography,
      p_company_size: lead.company_size,
    });
    
    // Update persona metrics if applicable
    if (persona) {
      await supabase
        .from('discovery_personas')
        .update({
          total_approved: (persona as any).total_approved + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', persona.id);
    }

  } catch (error) {
    console.error('[autonomous-lead-discovery] Error tracking feedback:', error);
  }
}

async function sendWebhookNotification(webhookUrl: string, payload: any): Promise<void> {
  try {
    // Detect webhook type based on URL
    const isSlack = webhookUrl.includes('hooks.slack.com');
    const isDiscord = webhookUrl.includes('discord.com/api/webhooks');

    let formattedPayload: any;

    if (isSlack) {
      formattedPayload = {
        text: `🎯 Lead Genie: ${payload.type === 'auto_approved_leads' ? 'Auto-approved' : 'New'} leads discovered!`,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: `🎯 ${payload.count} ${payload.type === 'auto_approved_leads' ? 'Auto-approved' : 'Pending'} Leads`,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Persona:* ${payload.persona || 'Default'}\n` + 
                    payload.leads.map((l: any) => 
                      `• *${l.name}* (${l.industry || 'Unknown'}) - Score: ${l.qualityScore}`
                    ).join('\n'),
            },
          },
        ],
      };
    } else if (isDiscord) {
      formattedPayload = {
        embeds: [{
          title: `🎯 ${payload.count} ${payload.type === 'auto_approved_leads' ? 'Auto-approved' : 'Pending'} Leads`,
          description: `**Persona:** ${payload.persona || 'Default'}\n\n` +
                       payload.leads.map((l: any) => 
                         `• **${l.name}** (${l.industry || 'Unknown'}) - Score: ${l.qualityScore}`
                       ).join('\n'),
          color: payload.type === 'auto_approved_leads' ? 0x22c55e : 0x3b82f6,
        }],
      };
    } else {
      formattedPayload = payload;
    }

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formattedPayload),
    });

    console.log('[autonomous-lead-discovery] Webhook notification sent');
  } catch (error) {
    console.error('[autonomous-lead-discovery] Error sending webhook:', error);
  }
}
