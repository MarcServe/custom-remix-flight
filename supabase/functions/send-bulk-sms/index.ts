import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { sendOneSms, logSms } from '../_shared/sms-send.ts';

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

// Same rules as src/lib/smsMerge.ts: {name} and {{name}}, {first_name}, {company}, ...
const PLACEHOLDER_NAMES = new Set(['manual entry', 'contact', 'group member']);
function personalizeText(template: string, recipient: { name?: string | null; email?: string | null }): string {
  if (!template) return '';
  let full = (recipient.name || '').trim();
  if (PLACEHOLDER_NAMES.has(full.toLowerCase())) full = '';
  const parts = full.split(/\s+/).filter(Boolean);
  const first = parts[0] || '';
  const last = parts.slice(1).join(' ');
  const phone = extractPhone(recipient.email) || '';
  const email = recipient.email && !recipient.email.startsWith('phone:') ? recipient.email : '';
  const values: Record<string, string> = {
    name: full || 'there', fullname: full || 'there', contactname: full || 'there',
    firstname: first || 'there', first: first || 'there',
    lastname: last, last: last, surname: last,
    company: full, companyname: full, business: full, businessname: full,
    phone, mobile: phone, email,
  };
  return template.replace(/\{\{?\s*([A-Za-z][A-Za-z _-]{0,30}?)\s*\}?\}/g, (match, key: string) => {
    const k = key.toLowerCase().replace(/[\s_-]/g, '');
    return k in values ? values[k] : match;
  });
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

    // Numbers that replied STOP are never texted again, by any campaign.
    const { data: optOutRows } = await supabaseClient.from('sms_opt_outs').select('phone').eq('user_id', campaign.user_id);
    const optedOut = new Set((optOutRows || []).map((o: any) => o.phone));
    const fromNumber = metadata.phone_number || metadata.from_number || metadata.originator || '';
    let skippedOptOut = 0;

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
          if (optedOut.has(phone)) {
            skippedOptOut++;
            await supabaseClient.from('email_campaign_recipients').update({ status: 'skipped', error_message: 'Opted out (replied STOP)' }).eq('id', recipient.id);
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
              // Show the campaign text in the Conversations thread so replies have context.
              await logSms(supabaseClient, {
                user_id: campaign.user_id, connection_id: campaign.sender_connection_id || null, direction: 'outbound', counterparty: phone,
                from_number: fromNumber, to_number: phone, body: message, status: 'sent', provider, provider_sid: result.messageId || null,
                campaign_id: campaignId, campaign_recipient_id: recipient.id, contact_name: ['Contact', 'Manual Entry', 'Group member'].includes(recipient.name) ? null : recipient.name || null,
                read_at: new Date().toISOString(), metadata: { campaign: true },
              });
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
        sent: sentCount, skipped_opt_out: skippedOptOut,
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
