import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/**
 * Background job to update deliverability metrics based on actual email data
 * Should be called periodically (e.g., daily via cron)
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log('Starting deliverability metrics update...');

    // Get all users with email connections
    const { data: connections, error: connError } = await supabase
      .from('crm_connections')
      .select('user_id, from_email')
      .eq('status', 'active')
      .not('from_email', 'is', null);

    if (connError) throw connError;

    if (!connections || connections.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No active email connections found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let updatedCount = 0;

    // Process each user's email metrics
    for (const connection of connections) {
      try {
        const domain = connection.from_email.split('@')[1];
        
        // Get email activity statistics for this user
        const { data: sequences } = await supabase
          .from('email_sequences')
          .select('id')
          .eq('created_by', connection.user_id);

        if (!sequences || sequences.length === 0) continue;

        const sequenceIds = sequences.map(s => s.id);

        // Get company sequences for these email sequences
        const { data: companySequences } = await supabase
          .from('company_sequences')
          .select('id')
          .in('sequence_id', sequenceIds);

        if (!companySequences || companySequences.length === 0) continue;

        const companySequenceIds = companySequences.map(cs => cs.id);

        // Get email activities
        const { data: activities, error: activitiesError } = await supabase
          .from('email_activities')
          .select('*')
          .in('company_sequence_id', companySequenceIds);

        if (activitiesError) {
          console.error(`Error fetching activities for user ${connection.user_id}:`, activitiesError);
          continue;
        }

        // Calculate metrics
        const totalSent = activities?.filter(a => a.status === 'sent' || a.status === 'delivered').length || 0;
        const hardBounces = activities?.filter(a => a.status === 'bounced' && a.metadata?.bounce_type === 'hard').length || 0;
        const softBounces = activities?.filter(a => a.status === 'bounced' && a.metadata?.bounce_type === 'soft').length || 0;
        const spamComplaints = activities?.filter(a => a.status === 'spam').length || 0;

        const bounceRate = totalSent > 0 ? ((hardBounces + softBounces) / totalSent) * 100 : 0;
        const spamComplaintRate = totalSent > 0 ? (spamComplaints / totalSent) * 100 : 0;

        // Calculate overall score based on metrics
        let overallScore = 100;
        
        // Penalize for high bounce rate
        if (bounceRate > 10) overallScore -= 40;
        else if (bounceRate > 5) overallScore -= 25;
        else if (bounceRate > 2) overallScore -= 10;
        
        // Penalize for spam complaints
        if (spamComplaintRate > 0.5) overallScore -= 30;
        else if (spamComplaintRate > 0.1) overallScore -= 15;
        else if (spamComplaintRate > 0.05) overallScore -= 5;

        // Get most recent deliverability metric for this domain
        const { data: latestMetric } = await supabase
          .from('email_deliverability_metrics')
          .select('*')
          .eq('user_id', connection.user_id)
          .eq('domain', domain)
          .order('checked_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        // Calculate sender reputation (weighted average of current and historical)
        const historicalReputation = latestMetric?.sender_reputation || 85;
        const currentPerformance = Math.max(0, 100 - bounceRate * 2 - spamComplaintRate * 10);
        const senderReputation = Math.round((historicalReputation * 0.7) + (currentPerformance * 0.3));

        // Insert or update metrics
        const { error: insertError } = await supabase
          .from('email_deliverability_metrics')
          .insert({
            user_id: connection.user_id,
            domain,
            overall_score: Math.max(0, Math.round(overallScore)),
            sender_reputation: Math.max(0, Math.min(100, senderReputation)),
            bounce_rate: Number(bounceRate.toFixed(2)),
            hard_bounce_count: hardBounces,
            soft_bounce_count: softBounces,
            total_sent: totalSent,
            spam_complaint_rate: Number(spamComplaintRate.toFixed(2)),
            spam_complaint_count: spamComplaints,
            spam_score: Number((spamComplaintRate * 10).toFixed(2)),
            spf_valid: latestMetric?.spf_valid || false,
            dkim_valid: latestMetric?.dkim_valid || false,
            dmarc_valid: latestMetric?.dmarc_valid || false,
            mx_records_valid: latestMetric?.mx_records_valid || false,
            blacklisted: latestMetric?.blacklisted || false,
            blacklist_providers: latestMetric?.blacklist_providers || [],
            metadata: {
              calculated_from_activities: true,
              total_activities: activities?.length || 0,
              last_updated: new Date().toISOString(),
            },
          });

        if (insertError) {
          console.error(`Error inserting metrics for user ${connection.user_id}:`, insertError);
        } else {
          updatedCount++;
          console.log(`Updated metrics for user ${connection.user_id}, domain ${domain}`);
        }
      } catch (error) {
        console.error(`Error processing user ${connection.user_id}:`, error);
      }
    }

    console.log(`Deliverability metrics update complete. Updated ${updatedCount} users.`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Updated deliverability metrics for ${updatedCount} users`,
        processed: connections.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in update-deliverability-metrics:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
