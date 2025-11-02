import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabaseClient.auth.getUser(token);
      
      if (!user) {
        throw new Error('Unauthorized');
      }
    }

    console.log('Starting email_threads backfill process...');

    // Get all email_activities that don't have corresponding email_threads
    const { data: missingActivities, error: fetchError } = await supabaseClient
      .from('email_activities')
      .select('id, subject, body, thread_id, external_message_id, sent_at, metadata, company_sequence_id, contact_id')
      .eq('status', 'sent')
      .not('thread_id', 'is', null);

    if (fetchError) {
      throw new Error(`Failed to fetch email activities: ${fetchError.message}`);
    }

    console.log(`Found ${missingActivities?.length || 0} email activities to check`);

    // Check which ones are actually missing from email_threads
    const threadsToCreate = [];
    
    for (const activity of missingActivities || []) {
      const { data: existingThread } = await supabaseClient
        .from('email_threads')
        .select('id')
        .eq('thread_id', activity.thread_id)
        .maybeSingle();

      if (!existingThread) {
        threadsToCreate.push(activity);
      }
    }

    console.log(`Need to backfill ${threadsToCreate.length} email threads`);

    // Get active crm_connections to determine from_email
    const { data: connections } = await supabaseClient
      .from('crm_connections')
      .select('from_email, provider')
      .eq('status', 'active');

    const connectionMap = new Map(
      (connections || []).map(c => [c.provider, c.from_email])
    );

    // Insert missing email_threads
    const insertData = threadsToCreate.map(activity => {
      const provider = activity.metadata?.provider || 'smtp';
      const fromEmail = connectionMap.get(provider) || activity.metadata?.from_email || 'michael.o@bizboosters.co.uk';
      const toEmail = activity.metadata?.to_email || 'unknown@example.com';

      return {
        company_sequence_id: activity.company_sequence_id,
        from_email: fromEmail,
        to_email: toEmail,
        subject: activity.subject,
        body_text: activity.body,
        body_html: activity.body,
        direction: 'outbound',
        thread_id: activity.thread_id,
        message_id: activity.external_message_id,
        received_at: activity.sent_at,
        ai_analysis: null,
        sentiment: null,
      };
    });

    if (insertData.length > 0) {
      const { data: createdThreads, error: insertError } = await supabaseClient
        .from('email_threads')
        .insert(insertData)
        .select('id, thread_id, subject');

      if (insertError) {
        console.error('Error inserting threads:', insertError);
        throw new Error(`Failed to insert threads: ${insertError.message}`);
      }

      console.log(`✅ Successfully backfilled ${createdThreads?.length || 0} email threads`);

      return new Response(
        JSON.stringify({
          success: true,
          message: `Backfilled ${createdThreads?.length || 0} email threads`,
          threads: createdThreads,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    } else {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No threads need backfilling',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }
  } catch (error: any) {
    console.error('Error in backfill-email-threads:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
