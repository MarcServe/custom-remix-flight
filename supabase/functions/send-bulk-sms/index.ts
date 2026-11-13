import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

function base64Encode(str: string): string {
  if (typeof btoa !== 'undefined') return btoa(str);
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  return btoa(String.fromCharCode(...data));
}

const TWO_DIGIT_CODES = new Set(['20','27','30','31','32','33','34','36','39','40','41','43','44','45','46','47','48','49','51','52','53','54','55','56','57','58','60','61','62','63','64','65','66','81','82','84','86','90','91','92','93','94','95','98']);

/** Country calling code of an E.164 number ("+447…" → "44"), used as the default for local numbers. */
function countryCodeOf(e164: string | null | undefined): string {
  const d = String(e164 || '').replace(/\D/g, '');
  if (!d) return '';
  if (d[0] === '1' || d[0] === '7') return d[0];
  if (TWO_DIGIT_CODES.has(d.slice(0, 2))) return d.slice(0, 2);
  return d.slice(0, 3);
}

/**
 * Turn whatever was typed or imported into E.164. Local numbers ("0117 924 0284",
 * "07772 550734") take the sender's country code; without this they became "+0117…",
 * which every provider rejects.
 */
function extractPhone(raw: string | null | undefined, defaultCc = ''): string | null {
  if (!raw) return null;
  let phone = String(raw).trim();
  if (phone.toLowerCase().startsWith('phone:')) phone = phone.slice(6).trim();
  const hasPlus = phone.startsWith('+');
  let digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return null;
  if (hasPlus) return `+${digits}`;
  if (digits.startsWith('00')) return `+${digits.slice(2)}`;
  if (digits.startsWith('0')) return defaultCc ? `+${defaultCc}${digits.replace(/^0+/, '')}` : null;
  if (defaultCc && digits.startsWith(defaultCc) && digits.length >= 11) return `+${digits}`;
  return defaultCc ? `+${defaultCc}${digits}` : `+${digits}`;
}

/** UK geographic/non-mobile numbers cannot receive SMS; only 07 mobiles can. */
function isUkNonMobile(e164: string): boolean {
  return e164.startsWith('+44') && !/^\+447[1-9]/.test(e164);
}

const SEND_TIME_BUDGET_MS = 100_000;
const MAX_PER_RUN = 500;

function personalizeText(template: string, recipient: { name?: string | null; email?: string | null }): string {
  if (!template) return '';
  const fullName = recipient.name || '';
  const nameParts = fullName.split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';
  return template
    .replace(/\{\{firstName\}\}/gi, firstName)
    .replace(/\{\{lastName\}\}/gi, lastName)
    .replace(/\{\{fullName\}\}/gi, fullName)
    .replace(/\{\{name\}\}/gi, fullName)
    .replace(/\{\{email\}\}/gi, recipient.email || '')
    .replace(/\{\{phone\}\}/gi, extractPhone(recipient.email) || '');
}

type SmsResult = { success: boolean; messageId?: string; status?: string; error?: string };

async function sendOneSms(
  provider: string,
  metadata: Record<string, any>,
  phoneNumber: string,
  message: string,
): Promise<SmsResult> {
  switch (provider) {
    case 'twilio': {
      const accountSid = metadata.account_sid;
      const authToken = metadata.auth_token;
      const fromNumber = metadata.phone_number;
      if (!accountSid || !authToken || !fromNumber) {
        return { success: false, error: 'Twilio credentials not configured' };
      }
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
      const twilioAuth = base64Encode(`${accountSid}:${authToken}`);
      const twilioResponse = await fetch(twilioUrl, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${twilioAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ From: fromNumber, To: phoneNumber, Body: message }),
      });
      if (!twilioResponse.ok) {
        const errorData = await twilioResponse.text();
        let errorMessage = 'Twilio API error';
        try {
          const errorJson = JSON.parse(errorData);
          if (errorJson.message) errorMessage = errorJson.message;
          if (errorJson.code) errorMessage = `Twilio Error ${errorJson.code}: ${errorMessage}`;
        } catch {
          errorMessage = errorData || errorMessage;
        }
        return { success: false, error: errorMessage };
      }
      const twilioData = await twilioResponse.json();
      return { success: true, messageId: twilioData.sid, status: twilioData.status };
    }
    case 'vonage': {
      const apiKey = metadata.api_key;
      const apiSecret = metadata.api_secret;
      const fromNumber = metadata.from_number;
      if (!apiKey || !apiSecret || !fromNumber) {
        return { success: false, error: 'Vonage credentials not configured' };
      }
      const vonageResponse = await fetch('https://rest.nexmo.com/sms/json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          api_secret: apiSecret,
          from: fromNumber,
          to: phoneNumber,
          text: message,
        }),
      });
      if (!vonageResponse.ok) {
        return { success: false, error: `Vonage error: ${await vonageResponse.text()}` };
      }
      const vonageData = await vonageResponse.json();
      if (vonageData.messages?.[0]?.status !== '0') {
        return {
          success: false,
          error: `Vonage error: ${vonageData.messages?.[0]?.['error-text'] || 'Unknown error'}`,
        };
      }
      return {
        success: true,
        messageId: vonageData.messages?.[0]?.['message-id'],
        status: 'sent',
      };
    }
    case 'plivo': {
      const authId = metadata.auth_id;
      const authToken = metadata.auth_token;
      const fromNumber = metadata.phone_number;
      if (!authId || !authToken || !fromNumber) {
        return { success: false, error: 'Plivo credentials not configured' };
      }
      const plivoAuth = base64Encode(`${authId}:${authToken}`);
      const plivoResponse = await fetch(`https://api.plivo.com/v1/Account/${authId}/Message/`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${plivoAuth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ src: fromNumber, dst: phoneNumber, text: message }),
      });
      if (!plivoResponse.ok) {
        return { success: false, error: `Plivo error: ${await plivoResponse.text()}` };
      }
      const plivoData = await plivoResponse.json();
      return { success: true, messageId: plivoData.message_uuid?.[0], status: 'sent' };
    }
    case 'messagebird': {
      const accessKey = metadata.access_key;
      const originator = metadata.originator;
      if (!accessKey || !originator) {
        return { success: false, error: 'MessageBird credentials not configured' };
      }
      const messagebirdResponse = await fetch('https://rest.messagebird.com/messages', {
        method: 'POST',
        headers: {
          Authorization: `AccessKey ${accessKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          originator,
          recipients: [phoneNumber],
          body: message,
        }),
      });
      if (!messagebirdResponse.ok) {
        return { success: false, error: `MessageBird error: ${await messagebirdResponse.text()}` };
      }
      const messagebirdData = await messagebirdResponse.json();
      return {
        success: true,
        messageId: messagebirdData.id,
        status: messagebirdData.status,
      };
    }
    default:
      return { success: false, error: `Unsupported provider: ${provider}` };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { campaignId, triggeredByCron } = await req.json();
    if (!campaignId) {
      return new Response(JSON.stringify({ success: false, error: 'Campaign ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const startedAt = Date.now();
    const authHeader = req.headers.get('Authorization') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    // Only the real service key unlocks the cron path. "triggeredByCron" in the body is
    // caller-supplied, so on its own it must never bypass the ownership check.
    const isServiceRole = serviceRoleKey.length > 0 && authHeader === `Bearer ${serviceRoleKey}`;
    void triggeredByCron;

    let supabaseClient: any;
    let userId: string | null = null;

    if (isServiceRole) {
      supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      );
      const { data: campaignRow, error: campaignLookupError } = await supabaseClient
        .from('email_campaigns')
        .select('user_id')
        .eq('id', campaignId)
        .single();
      if (campaignLookupError || !campaignRow) throw new Error('Campaign not found');
      userId = campaignRow.user_id;
    } else {
      supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
      if (authError || !user) throw new Error('Unauthorized');
      userId = user.id;
      supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      );
    }

    const { data: campaign, error: campaignError } = await supabaseClient
      .from('email_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();
    if (campaignError || !campaign) throw new Error('Campaign not found');
    if (!isServiceRole && campaign.user_id !== userId) {
      throw new Error('Unauthorized: Campaign does not belong to user');
    }

    const tags: string[] = Array.isArray(campaign.tags) ? campaign.tags : [];
    const isPhone =
      tags.includes('phone_sms') ||
      String(campaign.name || '').startsWith('📞') ||
      String(campaign.subject_template || '').toLowerCase().startsWith('phone campaign');
    if (!isPhone) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Not a phone/SMS campaign. Use send-bulk-emails for email campaigns.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!campaign.sender_connection_id) {
      throw new Error('Phone campaign has no phone service connection. Re-create or set sender_connection_id.');
    }

    const { data: connection, error: connectionError } = await supabaseClient
      .from('crm_connections')
      .select('*')
      .eq('id', campaign.sender_connection_id)
      .eq('user_id', campaign.user_id)
      .eq('status', 'active')
      .maybeSingle();

    if (connectionError || !connection) {
      throw new Error('Phone service connection not found or inactive');
    }

    const provider = connection.provider as string;
    const metadata = (connection.metadata || {}) as Record<string, any>;
    if (!['twilio', 'vonage', 'messagebird', 'plivo'].includes(provider)) {
      throw new Error(`Unsupported phone provider: ${provider}`);
    }

    await supabaseClient.from('email_campaigns').update({
      status: 'sending',
      started_at: campaign.started_at || new Date().toISOString(),
    }).eq('id', campaignId);

    const { data: pendingRecipients, error: recipientsError } = await supabaseClient
      .from('email_campaign_recipients')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(MAX_PER_RUN);

    if (recipientsError) throw new Error('Failed to fetch recipients');

    if (!pendingRecipients?.length) {
      await supabaseClient.from('email_campaigns').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      }).eq('id', campaignId);
      return new Response(JSON.stringify({ success: true, message: 'No pending recipients', sent: 0, failed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let sentCount = 0;
    let failedCount = 0;
    const CONCURRENCY = 5;
    const defaultCc = countryCodeOf(metadata.phone_number || metadata.from_number);

    const markFailed = (id: string, error_message: string) =>
      supabaseClient.from('email_campaign_recipients').update({ status: 'failed', error_message }).eq('id', id);

    for (let i = 0; i < pendingRecipients.length; i += CONCURRENCY) {
      // Stop before the runtime kills us; the cron picks up whoever is still pending.
      if (Date.now() - startedAt > SEND_TIME_BUDGET_MS) break;
      const batch = pendingRecipients.slice(i, i + CONCURRENCY);
      await Promise.all(
        batch.map(async (recipient: any) => {
          const phone = extractPhone(recipient.email, defaultCc);
          const template = recipient.personalized_body_text || campaign.body_text_template || '';
          const message = personalizeText(template, recipient);

          // Claim the row first (pending → sent). If another run already took it, skip:
          // this is what stops overlapping runs texting the same person twice.
          const { data: claimed } = await supabaseClient
            .from('email_campaign_recipients')
            .update({ status: 'sent', sent_at: new Date().toISOString(), error_message: null })
            .eq('id', recipient.id)
            .eq('status', 'pending')
            .select('id');
          if (!claimed || claimed.length === 0) return;

          if (!phone) {
            failedCount++;
            await markFailed(recipient.id, 'Invalid or missing phone number');
            return;
          }
          if (isUkNonMobile(phone)) {
            failedCount++;
            await markFailed(recipient.id, 'UK landline or non-mobile number: it cannot receive SMS');
            return;
          }
          if (!message.trim()) {
            failedCount++;
            await markFailed(recipient.id, 'Empty SMS message');
            return;
          }

          try {
            const result = await sendOneSms(provider, metadata, phone, message);
            if (result.success) {
              sentCount++;
              if (result.messageId) {
                await supabaseClient.from('email_campaign_recipients')
                  .update({ external_message_id: result.messageId }).eq('id', recipient.id);
              }
            } else {
              failedCount++;
              await markFailed(recipient.id, result.error || 'SMS send failed');
            }
          } catch (e: any) {
            failedCount++;
            await markFailed(recipient.id, e?.message || 'SMS send failed');
          }
        }),
      );
    }

    const { count: stillPending } = await supabaseClient
      .from('email_campaign_recipients')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .eq('status', 'pending');

    const countOf = async (status: string) => {
      const { count } = await supabaseClient
        .from('email_campaign_recipients')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', campaignId)
        .eq('status', status);
      return count || 0;
    };
    const totalSent = await countOf('sent');
    const totalFailed = await countOf('failed');

    await supabaseClient.from('email_campaigns').update({
      sent_count: totalSent,
      failed_count: totalFailed,
      status: (stillPending || 0) > 0 ? 'sending' : 'completed',
      completed_at: (stillPending || 0) > 0 ? null : new Date().toISOString(),
    }).eq('id', campaignId);

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        failed: failedCount,
        pending: stillPending || 0,
        provider,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: any) {
    console.error('send-bulk-sms error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || 'Failed to send bulk SMS',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
