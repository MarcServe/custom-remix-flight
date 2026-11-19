import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { parseBounce } from "../_shared/email-quality.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const b64url = (data: string): string => {
  try {
    const bin = atob(data.replace(/-/g, '+').replace(/_/g, '/'));
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  } catch { return ''; }
};

/** Plain text of a Gmail message, including the machine-readable part of a bounce (DSN). */
// deno-lint-ignore no-explicit-any
function messageText(message: any): string {
  const chunks: string[] = [];
  // deno-lint-ignore no-explicit-any
  const walk = (part: any): void => {
    if (!part) return;
    const mt = String(part.mimeType || '');
    if (part.body?.data && (mt === 'text/plain' || mt === 'message/delivery-status' || mt === '')) chunks.push(b64url(part.body.data));
    (part.parts || []).forEach(walk);
  };
  walk(message.payload);
  return chunks.join('\n') || String(message.snippet || '');
}

/**
 * Read bounce notices (mailer-daemon / postmaster) from the user's Gmail and
 * record them: email_bounce_events (the suppression list every sender checks),
 * the matching campaign recipients and sequence emails marked bounced, and any
 * active follow-up sequence to that address paused. Delay notices are ignored
 * until Gmail gives up and sends the permanent failure.
 */
async function syncBouncesForUser(
  // deno-lint-ignore no-explicit-any
  supabase: SupabaseClient<any, "public", any>,
  userId: string,
  accessToken: string,
  ownEmail: string,
): Promise<number> {
  const q = encodeURIComponent('from:(mailer-daemon OR postmaster) newer_than:14d');
  const listRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${q}&maxResults=100`, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  if (!listRes.ok) {
    console.log(`User ${userId}: could not list bounce notices:`, await listRes.text());
    return 0;
  }
  const ids: string[] = ((await listRes.json()).messages || []).map((m: { id: string }) => m.id);
  if (!ids.length) return 0;

  const { data: seen } = await supabase
    .from('email_bounce_events')
    .select('external_message_id')
    .eq('user_id', userId)
    .in('external_message_id', ids);
  const already = new Set((seen || []).map((r: { external_message_id: string }) => r.external_message_id));

  let recorded = 0;
  for (const id of ids) {
    if (already.has(id)) continue;
    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    if (!res.ok) continue;
    const message = await res.json();
    const headers = message.payload?.headers || [];
    const h = (name: string) => headers.find((x: { name: string; value: string }) => x.name.toLowerCase() === name.toLowerCase())?.value || '';
    const bounce = parseBounce({ from: h('From'), subject: h('Subject'), body: messageText(message) }, [ownEmail]);
    if (!bounce || !bounce.permanent) continue;
    // Case-insensitive exact match: escape LIKE wildcards in the address.
    const emailLike = bounce.recipient.replace(/[\\%_]/g, (c) => '\\' + c);

    const occurredAt = message.internalDate ? new Date(Number(message.internalDate)).toISOString() : new Date().toISOString();
    const { error: insErr } = await supabase.from('email_bounce_events').insert({
      user_id: userId,
      recipient_email: bounce.recipient,
      bounce_type: 'hard',
      bounce_reason: bounce.reason,
      external_message_id: id,
      occurred_at: occurredAt,
      metadata: { source: 'gmail_dsn', subject: h('Subject'), gmail_thread_id: message.threadId },
    });
    if (insErr) {
      console.error(`User ${userId}: could not record bounce for ${bounce.recipient}:`, insErr.message);
      continue;
    }
    recorded++;

    // Campaign recipients of this user with that address → bounced.
    const { data: campaigns } = await supabase.from('email_campaigns').select('id').eq('user_id', userId).limit(5000);
    const campaignIds = (campaigns || []).map((c: { id: string }) => c.id);
    if (campaignIds.length) {
      await supabase.from('email_campaign_recipients')
        .update({ status: 'bounced', error_message: bounce.reason.slice(0, 300) })
        .in('campaign_id', campaignIds)
        .ilike('email', emailLike);
    }

    // The user's companies that have this contact → stop their follow-ups.
    const { data: contactRows } = await supabase
      .from('contacts')
      .select('id, company_id, companies!inner(user_id)')
      .ilike('email', emailLike)
      .eq('companies.user_id', userId);
    const companyIds = [...new Set((contactRows || []).map((c: { company_id: string }) => c.company_id))];
    if (contactRows?.length) {
      await supabase.from('contacts').update({ email_verified: false }).in('id', contactRows.map((c: { id: string }) => c.id));
    }
    if (companyIds.length) {
      const { data: seqs } = await supabase
        .from('company_sequences')
        .update({ status: 'paused', next_action: 'paused', updated_at: new Date().toISOString() })
        .in('company_id', companyIds)
        .eq('status', 'active')
        .select('id');
      const seqIds = (seqs || []).map((s: { id: string }) => s.id);
      if (seqIds.length) {
        await supabase.from('email_activities')
          .update({ status: 'bounced', bounced_at: occurredAt })
          .in('company_sequence_id', seqIds)
          .eq('status', 'sent');
      }
    }
    console.log(`User ${userId}: recorded bounce for ${bounce.recipient} (${bounce.reason.slice(0, 80)})`);
  }
  return recorded;
}

// deno-lint-ignore no-explicit-any
async function syncRepliesForUser(supabase: SupabaseClient<any, "public", any>, userId: string): Promise<{ repliesFound: number; bouncesFound: number }> {
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

  // Bounces first, so the suppression list is current before anything else runs.
  let bouncesFound = 0;
  try {
    bouncesFound = await syncBouncesForUser(supabase, userId, accessToken, String(connection.from_email || ''));
  } catch (e) {
    console.error(`User ${userId}: bounce sync failed:`, e);
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

        // A bounce notice is not a reply from the prospect — syncBouncesForUser handles it.
        if (parseBounce({ from, subject, body: messageText(message) }, [userEmail || ''])) continue;

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

  return { repliesFound, bouncesFound };
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
        const { repliesFound, bouncesFound } = await syncRepliesForUser(supabase, user.id);
        console.log(`Sync complete. Found ${repliesFound} new replies, ${bouncesFound} new bounces.`);

        return new Response(
          JSON.stringify({
            success: true,
            repliesFound,
            bouncesFound,
            message: `Synced ${repliesFound} new replies and ${bouncesFound} bounces from Gmail`
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
