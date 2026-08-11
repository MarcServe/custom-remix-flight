import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

function base64Encode(str: string): string {
  if (typeof btoa !== 'undefined') return btoa(str);
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  return btoa(String.fromCharCode(...data));
}

function extractPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let phone = String(raw).trim();
  if (phone.toLowerCase().startsWith('phone:')) phone = phone.slice(6).trim();
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return null;
  return phone.startsWith('+') ? phone : (phone.includes('+') ? phone : `+${digits}`);
}

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

    const authHeader = req.headers.get('Authorization') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 'invalid';
    const isServiceRole = authHeader.includes(serviceRoleKey);

    let supabaseClient: any;
    let userId: string | null = null;

    if (isServiceRole || triggeredByCron) {
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
    if (!isServiceRole && !triggeredByCron && campaign.user_id !== userId) {
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
      .limit(5000);

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

    for (let i = 0; i < pendingRecipients.length; i += CONCURRENCY) {
      const batch = pendingRecipients.slice(i, i + CONCURRENCY);
      await Promise.all(
        batch.map(async (recipient: any) => {
          const phone = extractPhone(recipient.email);
          const message =
            recipient.personalized_body_text ||
            (campaign.body_text_template
              ? personalizeText(campaign.body_text_template, recipient)
              : '') ||
            '';

          if (!phone) {
            failedCount++;
            await supabaseClient.from('email_campaign_recipients').update({
              status: 'failed',
              error_message: 'Invalid or missing phone number',
            }).eq('id', recipient.id);
            return;
          }
          if (!message.trim()) {
            failedCount++;
            await supabaseClient.from('email_campaign_recipients').update({
              status: 'failed',
              error_message: 'Empty SMS message',
            }).eq('id', recipient.id);
            return;
          }

          try {
            const result = await sendOneSms(provider, metadata, phone, message);
            if (result.success) {
              sentCount++;
              await supabaseClient.from('email_campaign_recipients').update({
                status: 'sent',
                sent_at: new Date().toISOString(),
                error_message: null,
              }).eq('id', recipient.id);
            } else {
              failedCount++;
              await supabaseClient.from('email_campaign_recipients').update({
                status: 'failed',
                error_message: result.error || 'SMS send failed',
              }).eq('id', recipient.id);
            }
          } catch (e: any) {
            failedCount++;
            await supabaseClient.from('email_campaign_recipients').update({
              status: 'failed',
              error_message: e?.message || 'SMS send failed',
            }).eq('id', recipient.id);
          }
        }),
      );
    }

    const { count: stillPending } = await supabaseClient
      .from('email_campaign_recipients')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .eq('status', 'pending');

    const { data: counts } = await supabaseClient
      .from('email_campaign_recipients')
      .select('status')
      .eq('campaign_id', campaignId);

    const totalSent = (counts || []).filter((r: any) => r.status === 'sent').length;
    const totalFailed = (counts || []).filter((r: any) => r.status === 'failed').length;

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
