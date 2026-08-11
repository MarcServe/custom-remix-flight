import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function syncRepliesForUser(supabase: ReturnType<typeof createClient>, userId: string): Promise<{ repliesFound: number }> {
  // Get the Gmail connection
  const { data: connection, error: connError } = await supabase
    .from('crm_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', 'gmail_direct')
    .eq('status', 'active')
    .single();

  if (connError || !connection) {
    throw new Error('Gmail connection not found');
  }

  const metadata = connection.metadata as any;
  let accessToken = metadata?.access_token;
  const expiresAt = metadata?.expires_at;

  // Check if token is expired and refresh if needed
  if (expiresAt && new Date(expiresAt) <= new Date()) {
    console.log(`User ${userId}: Gmail access token expired, refreshing...`);

    const refreshResponse = await supabase.functions.invoke('gmail-oauth-refresh', {
      body: { connection_id: connection.id }
    });

    if (refreshResponse.error || !refreshResponse.data?.access_token) {
      throw new Error('Failed to refresh Gmail token');
    }

    accessToken = refreshResponse.data.access_token;
  }

  if (!accessToken) {
    throw new Error('Gmail access token not found');
  }

  // Get email activities that were sent via Gmail (to find thread IDs)
  const { data: sentEmails, error: emailsError } = await supabase
    .from('email_activities')
    .select(`
      *,
      company_sequences!inner (
        id,
        company_id,
        sequence_id,
        status,
        companies:company_id (name, general_email)
      )
    `)
    .eq('status', 'sent')
    .not('external_message_id', 'is', null)
    .order('sent_at', { ascending: false })
    .limit(50);

  if (emailsError) {
    console.error(`User ${userId}: Error fetching sent emails:`, emailsError);
    throw emailsError;
  }

  console.log(`User ${userId}: Found ${sentEmails?.length || 0} sent emails to check for replies`);

  let repliesFound = 0;
  const processedThreads = new Set<string>();

  for (const email of sentEmails || []) {
    try {
      // Skip if we've already processed this thread
      if (email.thread_id && processedThreads.has(email.thread_id)) {
        continue;
      }

      // Get the thread from Gmail
      const threadId = email.thread_id || email.external_message_id;
      if (!threadId) continue;

      // First, try to get the message to find its thread
      let gmailThreadId = email.metadata?.gmail_thread_id;

      if (!gmailThreadId && email.external_message_id) {
        // Get the message first to find its thread
        const msgResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${email.external_message_id}?format=metadata`,
          {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          }
        );

        if (msgResponse.ok) {
          const msgData = await msgResponse.json();
          gmailThreadId = msgData.threadId;

          // Update the email activity with the thread ID
          await supabase
            .from('email_activities')
            .update({
              metadata: {
                ...email.metadata,
                gmail_thread_id: gmailThreadId
              }
            })
            .eq('id', email.id);
        }
      }

      if (!gmailThreadId) continue;
      processedThreads.add(gmailThreadId);

      // Fetch the thread to get all messages
      const threadResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/threads/${gmailThreadId}?format=full`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        }
      );

      if (!threadResponse.ok) {
        console.log(`User ${userId}: Could not fetch thread ${gmailThreadId}:`, await threadResponse.text());
        continue;
      }

      const thread = await threadResponse.json();
      const messages = thread.messages || [];

      // Find messages that are replies (not sent by us)
      const userEmail = connection.from_email?.toLowerCase();

      for (const message of messages) {
        // Skip messages we've already processed
        const existingReply = await supabase
          .from('email_threads')
          .select('id')
          .eq('message_id', message.id)
          .maybeSingle();

        if (existingReply.data) continue;

        // Extract headers
        const headers = message.payload?.headers || [];
        const getHeader = (name: string) =>
          headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

        const from = getHeader('From');
        const to = getHeader('To');
        const subject = getHeader('Subject');
        const date = getHeader('Date');

        // Extract email from "Name <email@domain.com>" format
        const fromEmail = from.match(/<([^>]+)>/)?.[1] || from;

        // Skip if this message is from us
        if (fromEmail.toLowerCase() === userEmail) continue;

        // Extract body
        let bodyText = '';
        let bodyHtml = '';

        const extractBody = (part: any): void => {
          if (part.mimeType === 'text/plain' && part.body?.data) {
            bodyText = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
          } else if (part.mimeType === 'text/html' && part.body?.data) {
            bodyHtml = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
          } else if (part.parts) {
            part.parts.forEach(extractBody);
          }
        };

        if (message.payload?.body?.data) {
          bodyText = atob(message.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
        } else if (message.payload?.parts) {
          message.payload.parts.forEach(extractBody);
        }

        // This is a reply from someone else - store it
        console.log(`User ${userId}: Found reply from ${fromEmail} in thread ${gmailThreadId}`);

        // Store in email_threads (schema uses message_id, not external_message_id)
        const { error: threadError } = await supabase
          .from('email_threads')
          .insert({
            company_sequence_id: email.company_sequence_id,
            message_id: message.id,
            thread_id: gmailThreadId,
            direction: 'inbound',
            from_email: fromEmail,
            to_email: to,
            subject: subject,
            body_text: bodyText,
            body_html: bodyHtml,
            received_at: date ? new Date(date).toISOString() : new Date().toISOString(),
            metadata: {
              gmail_thread_id: gmailThreadId,
              gmail_message_id: message.id,
              labels: message.labelIds,
            }
          });

        if (threadError) {
          console.error(`User ${userId}: Error storing reply:`, threadError);
          continue;
        }

        // Update the email activity to mark as replied
        await supabase
          .from('email_activities')
          .update({
            replied_at: new Date().toISOString(),
            status: 'replied',
            metadata: {
              ...email.metadata,
              reply_message_id: message.id,
              reply_from: fromEmail,
            }
          })
          .eq('id', email.id);

        // Update the company sequence
        if (email.company_sequence_id) {
          // Get current conversation history
          const { data: sequence } = await supabase
            .from('company_sequences')
            .select('conversation_history')
            .eq('id', email.company_sequence_id)
            .single();

          const history = (sequence?.conversation_history as any[]) || [];
          history.push({
            role: 'prospect',
            content: bodyText || bodyHtml,
            timestamp: new Date().toISOString(),
            from: fromEmail,
            subject: subject,
            gmail_message_id: message.id,
          });

          await supabase
            .from('company_sequences')
            .update({
              conversation_history: history,
              next_action: 'personalized_response',
              updated_at: new Date().toISOString()
            })
            .eq('id', email.company_sequence_id);
        }

        repliesFound++;
      }

      // Rate limiting - don't hammer Gmail API
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (threadError) {
      console.error(`User ${userId}: Error processing thread for email ${email.id}:`, threadError);
    }
  }

  return { repliesFound };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get the auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');

    // Detect mode: try to get user from token
    // If service role key is used, getUser returns an error — use multi-user cron mode
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (!authError && user) {
      // Single-user mode: called with a user JWT (e.g. manual button click in UI)
      console.log('Syncing Gmail replies for user:', user.id);

      try {
        const { repliesFound } = await syncRepliesForUser(supabase, user.id);
        console.log(`Sync complete. Found ${repliesFound} new replies.`);

        return new Response(
          JSON.stringify({
            success: true,
            repliesFound,
            message: `Synced ${repliesFound} new replies from Gmail`
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          }
        );
      } catch (err: any) {
        console.error('Error syncing Gmail replies for user:', err);
        return new Response(
          JSON.stringify({ error: 'Failed to sync Gmail replies. Please reconnect your Gmail account.' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
          }
        );
      }
    } else {
      // Service-role / cron mode: iterate over all active Gmail direct users
      console.log('[gmail-sync-replies] Running in cron/service-role mode — syncing all Gmail-connected users');

      const { data: connections, error: connError } = await supabase
        .from('crm_connections')
        .select('user_id')
        .eq('provider', 'gmail_direct')
        .eq('status', 'active');

      if (connError) {
        console.error('[gmail-sync-replies] Error fetching connections:', connError);
        throw new Error('Failed to fetch Gmail connections');
      }

      const userIds = [...new Set((connections || []).map((c: any) => c.user_id))];
      console.log(`[gmail-sync-replies] Found ${userIds.length} Gmail-connected users to sync`);

      let totalReplies = 0;
      const userResults: { userId: string; repliesFound?: number; error?: string }[] = [];

      for (const userId of userIds) {
        try {
          const { repliesFound } = await syncRepliesForUser(supabase, userId);
          totalReplies += repliesFound;
          userResults.push({ userId, repliesFound });
          console.log(`[gmail-sync-replies] User ${userId}: ${repliesFound} new replies`);
        } catch (err: any) {
          console.error(`[gmail-sync-replies] User ${userId} failed:`, err);
          userResults.push({ userId, error: 'Sync failed' });
        }
      }

      console.log(`[gmail-sync-replies] Cron sync complete. Total replies found: ${totalReplies}`);

      return new Response(
        JSON.stringify({
          success: true,
          mode: 'cron',
          usersProcessed: userIds.length,
          totalRepliesFound: totalReplies,
          results: userResults,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

  } catch (error: any) {
    console.error('Error in gmail-sync-replies:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
