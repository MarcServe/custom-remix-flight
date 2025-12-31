import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/**
 * Autonomous Lead Discovery - Daily cron job
 * Discovers leads for users with enabled autonomous discovery settings
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[autonomous-lead-discovery] Starting autonomous lead discovery run');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Get all users with enabled autonomous discovery
    const { data: settings, error: settingsError } = await supabase
      .from('autonomous_discovery_settings')
      .select('*')
      .eq('enabled', true);

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
        // Check if it's time to run based on frequency
        const shouldRun = shouldRunDiscovery(setting);
        if (!shouldRun) {
          console.log(`[autonomous-lead-discovery] Skipping user ${setting.user_id} - not scheduled to run yet`);
          continue;
        }

        console.log(`[autonomous-lead-discovery] Processing user ${setting.user_id}`);

        // Get user's business profile for context
        const { data: businessProfile } = await supabase
          .from('business_profiles')
          .select('*')
          .eq('user_id', setting.user_id)
          .single();

        // Build search query from settings
        const searchQuery = buildSearchQuery(setting, businessProfile);
        
        // Generate discovery run ID
        const discoveryRunId = crypto.randomUUID();

        // Call lead-finder function to discover leads
        const leadFinderResponse = await fetch(`${SUPABASE_URL}/functions/v1/lead-finder`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            size: setting.target_company_sizes?.[0] || 'any',
            geography: setting.target_geographies?.[0] || 'any',
            industry: setting.target_industries?.[0] || 'any',
            customSearchText: searchQuery,
            dryRun: true, // We'll handle saving ourselves
            provider: 'openai',
            model: 'gpt-4o-mini',
            enrichWithPerplexity: setting.enrich_with_perplexity,
            useSerpApi: setting.use_serp_api,
            maxResults: setting.max_leads_per_run || 10,
            autonomousMode: true, // Flag for internal use
          }),
        });

        if (!leadFinderResponse.ok) {
          const errorText = await leadFinderResponse.text();
          console.error(`[autonomous-lead-discovery] Lead finder error for user ${setting.user_id}:`, errorText);
          continue;
        }

        // Parse the streaming response
        const leads = await parseStreamingResponse(leadFinderResponse);

        if (!leads || leads.length === 0) {
          console.log(`[autonomous-lead-discovery] No leads found for user ${setting.user_id}`);
          continue;
        }

        console.log(`[autonomous-lead-discovery] Found ${leads.length} leads for user ${setting.user_id}`);

        // Get existing companies to avoid duplicates
        const { data: existingCompanies } = await supabase
          .from('companies')
          .select('name, website')
          .eq('user_id', setting.user_id);

        const existingNames = new Set((existingCompanies || []).map(c => c.name?.toLowerCase()));
        const existingWebsites = new Set((existingCompanies || []).map(c => c.website?.toLowerCase()).filter(Boolean));

        // Also check existing autonomous leads
        const { data: existingAutonomousLeads } = await supabase
          .from('autonomous_leads')
          .select('company_name, company_website')
          .eq('user_id', setting.user_id)
          .in('status', ['pending', 'approved', 'auto_approved']);

        const existingAutoNames = new Set((existingAutonomousLeads || []).map(l => l.company_name?.toLowerCase()));
        const existingAutoWebsites = new Set((existingAutonomousLeads || []).map(l => l.company_website?.toLowerCase()).filter(Boolean));

        // Filter out duplicates and insert new leads
        const newLeads = leads.filter((lead: any) => {
          const nameLower = lead.name?.toLowerCase();
          const websiteLower = lead.website?.toLowerCase();
          
          if (existingNames.has(nameLower) || existingAutoNames.has(nameLower)) return false;
          if (websiteLower && (existingWebsites.has(websiteLower) || existingAutoWebsites.has(websiteLower))) return false;
          
          return true;
        });

        if (newLeads.length === 0) {
          console.log(`[autonomous-lead-discovery] All leads already exist for user ${setting.user_id}`);
          continue;
        }

        // Insert autonomous leads
        const autonomousLeadsToInsert = newLeads.map((lead: any) => {
          const status = setting.auto_approve_threshold && lead.qualityScore >= setting.auto_approve_threshold 
            ? 'auto_approved' 
            : 'pending';

          return {
            user_id: setting.user_id,
            discovery_run_id: discoveryRunId,
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
          console.error(`[autonomous-lead-discovery] Error inserting leads for user ${setting.user_id}:`, insertError);
          continue;
        }

        leadsDiscovered += newLeads.length;

        // Auto-approve leads that meet threshold and save to companies
        const autoApprovedLeads = autonomousLeadsToInsert.filter(l => l.status === 'auto_approved');
        if (autoApprovedLeads.length > 0) {
          console.log(`[autonomous-lead-discovery] Auto-approving ${autoApprovedLeads.length} leads for user ${setting.user_id}`);
          
          for (const lead of autoApprovedLeads) {
            const companyId = await saveLeadToCompanies(supabase, lead, setting.user_id);
            
            // Auto-enroll in sequence if enabled
            if (setting.auto_enroll_enabled && setting.auto_enroll_sequence_id && companyId) {
              await enrollInSequence(supabase, companyId, setting.auto_enroll_sequence_id);
            }

            // Track feedback for AI learning
            await trackAutoApprovalFeedback(supabase, setting.user_id, lead);
          }

          // Send webhook notification for high-quality auto-approved leads
          if (setting.webhook_enabled && setting.webhook_url) {
            const highQualityLeads = autoApprovedLeads.filter(
              l => l.quality_score >= (setting.notify_min_quality_score || 70)
            );
            
            if (highQualityLeads.length > 0 && setting.notify_on_auto_approve) {
              await sendWebhookNotification(setting.webhook_url, {
                type: 'auto_approved_leads',
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

        // Send webhook for all new pending leads if webhook enabled
        const pendingLeads = autonomousLeadsToInsert.filter(l => l.status === 'pending');
        if (setting.webhook_enabled && setting.webhook_url && pendingLeads.length > 0) {
          const notifiableLeads = pendingLeads.filter(
            l => l.quality_score >= (setting.notify_min_quality_score || 70)
          );
          
          if (notifiableLeads.length > 0) {
            await sendWebhookNotification(setting.webhook_url, {
              type: 'new_leads_pending_review',
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

async function trackAutoApprovalFeedback(supabase: any, userId: string, lead: any): Promise<void> {
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

    // Update learned preferences
    await supabase.rpc('update_discovery_learning', {
      p_user_id: userId,
      p_action: 'auto_approved',
      p_industry: lead.industry,
      p_geography: lead.geography,
      p_company_size: lead.company_size,
    });
  } catch (error) {
    console.error('[autonomous-lead-discovery] Error tracking feedback:', error);
  }
}

async function sendWebhookNotification(webhookUrl: string, payload: any): Promise<void> {
  try {
    // Detect webhook type and format accordingly
    const isSlack = webhookUrl.includes('hooks.slack.com');
    const isDiscord = webhookUrl.includes('discord.com/api/webhooks');

    let body: any;

    if (isSlack) {
      // Slack format
      const leadsText = payload.leads.map((l: any) => 
        `• *${l.name}* (${l.industry || 'Unknown'}) - Quality: ${l.qualityScore}%`
      ).join('\n');

      body = {
        text: `🎯 LeadGenie: ${payload.count} new ${payload.type === 'auto_approved_leads' ? 'auto-approved' : 'pending'} leads`,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: `🎯 ${payload.count} New Leads Discovered`,
              emoji: true,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: leadsText,
            },
          },
        ],
      };
    } else if (isDiscord) {
      // Discord format
      const leadsText = payload.leads.map((l: any) => 
        `• **${l.name}** (${l.industry || 'Unknown'}) - Quality: ${l.qualityScore}%`
      ).join('\n');

      body = {
        content: `🎯 **LeadGenie: ${payload.count} new ${payload.type === 'auto_approved_leads' ? 'auto-approved' : 'pending'} leads**`,
        embeds: [
          {
            title: 'New Leads Discovered',
            description: leadsText,
            color: payload.type === 'auto_approved_leads' ? 0x22c55e : 0x3b82f6,
          },
        ],
      };
    } else {
      // Generic webhook
      body = {
        event: payload.type,
        count: payload.count,
        leads: payload.leads,
        timestamp: new Date().toISOString(),
      };
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error('[autonomous-lead-discovery] Webhook failed:', response.status, await response.text());
    } else {
      console.log('[autonomous-lead-discovery] Webhook notification sent successfully');
    }
  } catch (error) {
    console.error('[autonomous-lead-discovery] Error sending webhook:', error);
  }
}
