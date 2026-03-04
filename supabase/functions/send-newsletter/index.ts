import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { renderEmailTemplate } from "../_shared/professional-template.ts";
import { encodeRfc2047 } from "../_shared/gmail-utils.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let body: any;
    try {
      body = await req.json();
    } catch (_) {
      throw new Error('Invalid request body (expected JSON)');
    }
    if (!body || typeof body !== 'object') throw new Error('Invalid request body');
    // Support both flat body and nested body (some clients wrap in .body)
    const newsletterId = body.newsletterId ?? body.newsletter_id;
    const testEmailRaw = body.testEmail ?? body.test_email ?? body.body?.testEmail ?? body.body?.test_email
      ?? (typeof body === 'object' && Object.keys(body).find((k) => /^test_?email$/i.test(k)) ? (body as any)[Object.keys(body).find((k) => /^test_?email$/i.test(k))!] : undefined);
    const testEmail = typeof testEmailRaw === 'string' ? testEmailRaw.trim() : '';
    const isTest = testEmail.length > 0;

    if (!newsletterId) throw new Error('Missing newsletterId');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization')!;

    const supabaseAnon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const triggeredByCron = body.triggeredByCron === true && authHeader === `Bearer ${supabaseServiceKey}`;
    let user: { id: string; email?: string } | null = null;
    let newsletter: any = null;
    let nlError: any = null;

    if (triggeredByCron) {
      const { data: nl, error: err } = await supabaseAdmin
        .from('newsletters')
        .select('*')
        .eq('id', newsletterId)
        .single();
      newsletter = nl;
      nlError = err;
      if (nlError || !newsletter) throw new Error('Newsletter not found');
      if (newsletter.status !== 'scheduled') {
        throw new Error(`Newsletter is not scheduled (status: ${newsletter.status})`);
      }
      const { data: profile } = await supabaseAdmin.from('profiles').select('email').eq('id', newsletter.user_id).maybeSingle();
      user = { id: newsletter.user_id, email: profile?.email };
    } else {
      const { data: { user: authUser } } = await supabaseAnon.auth.getUser();
      user = authUser;
      if (!user) throw new Error('Not authenticated');
      const { data: nl, error: err } = await supabaseAnon
        .from('newsletters')
        .select('*')
        .eq('id', newsletterId)
        .eq('user_id', user.id)
        .single();
      newsletter = nl;
      nlError = err;
    }
    if (nlError || !newsletter) throw new Error('Newsletter not found');

    // When cron triggers, use stored audience/sender from scheduled_send_options
    if (triggeredByCron && newsletter.scheduled_send_options && typeof newsletter.scheduled_send_options === 'object') {
      const opts = newsletter.scheduled_send_options as Record<string, unknown>;
      if (opts.categoryFilters != null) body.categoryFilters = opts.categoryFilters;
      if (opts.recipientGroupIds != null) body.recipientGroupIds = opts.recipientGroupIds;
      if (opts.industryFilter != null) body.industryFilter = opts.industryFilter;
      if (opts.tagCategoryIds != null) body.tagCategoryIds = opts.tagCategoryIds;
      if (opts.sender_connection_id != null) body.sender_connection_id = opts.sender_connection_id;
      if (opts.sendToAllActive === true) body.sendToAllActive = true;
    }

    const categoryFilter = body.categoryFilter ?? body.category_filter;
    const categoryFiltersRaw = body.categoryFilters ?? body.category_filters;
    const categoryFilters: string[] = Array.isArray(categoryFiltersRaw)
      ? categoryFiltersRaw.filter((id: any) => id != null && String(id).trim())
      : categoryFilter ? [String(categoryFilter).trim()] : [];

    const recipientGroupId = body.recipientGroupId ?? body.recipient_group_id;
    const recipientGroupIdsRaw = body.recipientGroupIds ?? body.recipient_group_ids;
    const recipientGroupIds: string[] = Array.isArray(recipientGroupIdsRaw)
      ? recipientGroupIdsRaw.filter((id: any) => id != null && String(id).trim())
      : recipientGroupId ? [String(recipientGroupId).trim()] : [];

    const industryFilter = body.industryFilter ?? body.industry_filter;
    const industries: string[] = Array.isArray(industryFilter)
      ? industryFilter.filter((i: any) => i != null && String(i).trim())
      : industryFilter ? [String(industryFilter).trim()] : [];

    const tagCategoryIds = body.tagCategoryIds ?? body.tag_category_ids;
    const tagIds: string[] = Array.isArray(tagCategoryIds) ? tagCategoryIds.filter((id: any) => id) : [];

    const sendToAllActive = body.sendToAllActive === true || body.send_to_all_active === true;

    const senderConnectionId = body.sender_connection_id ?? body.senderConnectionId ?? null;

    const sendInBatches = body.sendInBatches === true || body.send_in_batches === true;
    const batchSize = Math.min(10000, Math.max(1, Number(body.batchSize ?? body.batch_size ?? 50) | 0)) || 50;
    const continueBatch = body.continueBatch === true || body.continue_batch === true;
    const dailySendLimitRaw = body.dailySendLimit ?? body.daily_send_limit;
    const dailySendLimitFromBody = dailySendLimitRaw != null ? Math.min(2000, Math.max(1, Number(dailySendLimitRaw) | 0)) : null;

    const db = triggeredByCron ? supabaseAdmin : supabaseAnon;

    // Never block test sends: if request has test email (any key) or isTest, allow regardless of newsletter status
    const hasTestEmailInBody = !!(String(body.testEmail ?? body.test_email ?? body.body?.testEmail ?? body.body?.test_email ?? '').trim())
      || (typeof body === 'object' && Object.keys(body).some((k) => /^test_?email$/i.test(k) && String((body as any)[k] || '').trim()));
    if (!isTest && !hasTestEmailInBody && newsletter.status === 'sent') {
      throw new Error('Newsletter already fully sent. Duplicate or create a new newsletter to send again.');
    }

    // Fetch branding
    const { data: businessProfile } = await db
      .from('business_profiles')
      .select('company_name, email_header_name, email_provider, email_logo_url, email_brand_color, email_footer_text, email_footer_image_url, email_footer_logo_url, email_sender_image_url, email_sender_name, email_signature_name, email_sender_title, email_sender_email, email_signature, website')
      .eq('user_id', user.id)
      .maybeSingle();

    const { data: userProfile } = await db
      .from('profiles')
      .select('full_name, job_title, email, avatar_url')
      .eq('id', user.id)
      .maybeSingle();

    let branding: any = {
      companyName: businessProfile?.company_name || null,
      headerName: businessProfile?.email_header_name || null,
      logoUrl: businessProfile?.email_logo_url || null,
      brandColor: businessProfile?.email_brand_color || '#8b5cf6',
      footerText: businessProfile?.email_footer_text || null,
      footerImageUrl: businessProfile?.email_footer_logo_url || businessProfile?.email_logo_url || null,
      signature: businessProfile?.email_signature || null,
      templateStyle: newsletter.template_style || 'professional',
      senderImageUrl: businessProfile?.email_sender_image_url || null,
      senderName: businessProfile?.email_sender_name || null,
      signatureName: businessProfile?.email_signature_name || null,
      senderEmail: businessProfile?.email_sender_email || null,
      senderTitle: businessProfile?.email_sender_title || null,
      websiteUrl: businessProfile?.website || null,
    };

    if (newsletter.sender_profile_id) {
      const { data: sp } = await db
        .from('sender_profiles')
        .select('name, display_name, logo_url, brand_color, footer_text, footer_image_url, footer_logo_url, signature, template_style, sender_name, signature_name, sender_email, sender_title, sender_image_url, website_url')
        .eq('id', newsletter.sender_profile_id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (sp) {
        const str = (v: any) => (v != null && String(v).trim() !== '' ? String(v).trim() : null);
        branding = {
          ...branding,
          headerName: str(sp.display_name) ?? branding.headerName,
          logoUrl: str(sp.logo_url) ?? branding.logoUrl,
          brandColor: str(sp.brand_color) ?? branding.brandColor,
          footerText: str(sp.footer_text) ?? branding.footerText,
          footerImageUrl: str(sp.footer_logo_url) ?? str(sp.logo_url) ?? branding.footerImageUrl,
          signature: str(sp.signature) ?? branding.signature,
          templateStyle: str(sp.template_style) ?? branding.templateStyle,
          // From line (inbox): prefer sender_name, then display_name so header-name change reflects when From name is empty
          senderName: str(sp.sender_name) ?? str(sp.display_name) ?? branding.senderName,
          signatureName: str(sp.signature_name) ?? branding.signatureName,
          senderEmail: str(sp.sender_email) ?? branding.senderEmail,
          senderTitle: str(sp.sender_title) ?? branding.senderTitle,
          senderImageUrl: str(sp.sender_image_url) ?? branding.senderImageUrl,
          websiteUrl: str(sp.website_url) ?? branding.websiteUrl,
        };
      }
    }

    // Per-newsletter header image override (fully customise branding for this send)
    if (newsletter.header_image_url && String(newsletter.header_image_url).trim()) {
      branding.logoUrl = newsletter.header_image_url.trim();
    }

    // Determine subscribers (or single test recipient)
    let targetSubscribers: { id: string; email: string; first_name: string | null; last_name: string | null; company: string | null; unsubscribe_token: string }[];

    if (isTest) {
      // Test send: ONLY this one address. Do not fetch or use subscriber list.
      const email = testEmail.toLowerCase();
      targetSubscribers = [{
        id: 'test',
        email,
        first_name: null,
        last_name: null,
        company: null,
        unsubscribe_token: '',
      }];
    } else {
      // When recipient groups are selected, add all group members as newsletter subscribers first
      // so the send list can include 1000+ (not just the subset already in newsletter_subscribers).
      // Use service role so RLS cannot block the insert (e.g. when user has no subscribers yet).
      let groupMembersForFallback: { email: string; first_name: string | null; last_name: string | null; company: string | null }[] = [];
      if (recipientGroupIds.length > 0) {
        const { data: groupMembers, error: groupErr } = await db
          .from('recipient_group_members')
          .select('email, first_name, last_name, company')
          .in('group_id', recipientGroupIds);
        if (!groupErr && groupMembers && groupMembers.length > 0) {
          const seen = new Set<string>();
          const toUpsert: { user_id: string; email: string; first_name: string | null; last_name: string | null; company: string | null; source: string; status: string }[] = [];
          for (const m of groupMembers as { email: string; first_name: string | null; last_name: string | null; company: string | null }[]) {
            const email = m.email ? String(m.email).trim().toLowerCase() : '';
            if (!email || seen.has(email)) continue;
            seen.add(email);
            groupMembersForFallback.push({ email, first_name: m.first_name || null, last_name: m.last_name || null, company: m.company || null });
            toUpsert.push({
              user_id: user.id,
              email,
              first_name: m.first_name || null,
              last_name: m.last_name || null,
              company: m.company || null,
              source: 'recipient_group',
              status: 'active',
            });
          }
          if (toUpsert.length > 0) {
            const { error: upsertErr } = await supabaseAdmin
              .from('newsletter_subscribers')
              .upsert(toUpsert, { onConflict: 'user_id,email', ignoreDuplicates: true });
            if (upsertErr) {
              console.warn('Newsletter send: upsert group members failed', upsertErr.message);
            }
          }
        }
      }

      // Use service role to fetch subscribers so RLS cannot block (user is already authenticated)
      let allSubscribers: { id: string; email: string; first_name: string | null; last_name: string | null; company: string | null; unsubscribe_token: string; industry?: string | null }[] | null = null;
      {
        const { data: subData, error: subErr } = await supabaseAdmin
          .from('newsletter_subscribers')
          .select('id, email, first_name, last_name, company, unsubscribe_token, industry')
          .eq('user_id', user.id)
          .eq('status', 'active');
        if (subErr) {
          throw new Error(`Could not load subscribers: ${subErr.message}`);
        }
        allSubscribers = (subData || null) as typeof allSubscribers;
      }

      // If we have selected groups but still no active subscribers, try inserting via admin (ensures RLS doesn't block)
      if ((!allSubscribers || allSubscribers.length === 0) && groupMembersForFallback.length > 0) {
        const toInsert = groupMembersForFallback.map((m) => ({
          user_id: user.id,
          email: m.email,
          first_name: m.first_name,
          last_name: m.last_name,
          company: m.company,
          source: 'recipient_group',
          status: 'active',
        }));
        const { error: insertErr } = await supabaseAdmin
          .from('newsletter_subscribers')
          .upsert(toInsert, { onConflict: 'user_id,email', ignoreDuplicates: true });
        if (!insertErr) {
          const { data: resData } = await supabaseAdmin
            .from('newsletter_subscribers')
            .select('id, email, first_name, last_name, company, unsubscribe_token, industry')
            .eq('user_id', user.id)
            .eq('status', 'active');
          allSubscribers = (resData || []) as typeof allSubscribers;
        }
      }

      if (!allSubscribers || allSubscribers.length === 0) {
        if (recipientGroupIds.length > 0 || categoryFilters.length > 0 || industries.length > 0) {
          throw new Error(
            'No recipients found for the selected audiences. Check that your groups have members with valid emails, or add subscribers in Newsletters > Subscribers first.'
          );
        }
        throw new Error('No active subscribers found. Add subscribers in Newsletters > Subscribers, or select recipient groups that have members.');
      }

      let subs = allSubscribers as { id: string; email: string; first_name: string | null; last_name: string | null; company: string | null; unsubscribe_token: string; industry?: string | null }[];

      const hasExplicitAudience = categoryFilters.length > 0 || recipientGroupIds.length > 0 || industries.length > 0;

      // When "All active subscribers" is selected, send to everyone (ignore categories/groups/industry)
      if (sendToAllActive) {
        // subs already holds all active subscribers; optional tag narrow applied below
      } else if (hasExplicitAudience) {
        const audienceSubscriberIds = new Set<string>();
        // Union of: subscribers in any selected category, in any selected group, or in any selected industry
        if (categoryFilters.length > 0) {
          const { data: subCats } = await db
            .from('newsletter_subscriber_categories')
            .select('subscriber_id')
            .in('category_id', categoryFilters);
          (subCats || []).forEach((sc: any) => audienceSubscriberIds.add(sc.subscriber_id));
        }
        if (recipientGroupIds.length > 0) {
          const { data: groupMembers, error: groupErr } = await db
            .from('recipient_group_members')
            .select('email')
            .in('group_id', recipientGroupIds);
          if (groupErr) throw new Error('Failed to load recipient groups');
          const groupEmails = new Set((groupMembers || []).map((m: any) => String(m.email).toLowerCase().trim()));
          subs.forEach((s: any) => {
            if (groupEmails.has(String(s.email).toLowerCase().trim())) audienceSubscriberIds.add(s.id);
          });
        }
        if (industries.length > 0) {
          const industrySet = new Set(industries.map((i: string) => String(i).trim().toLowerCase()));
          subs.forEach((s: any) => {
            if (s.industry && industrySet.has(String(s.industry).trim().toLowerCase())) audienceSubscriberIds.add(s.id);
          });
        }
        subs = subs.filter((s: any) => audienceSubscriberIds.has(s.id));
      } else {
        // No explicit audience and not sendToAllActive: use newsletter content selection (target categories)
        const targetCategoryIds: string[] = [];
        const { data: nlCats } = await db
          .from('newsletter_target_categories')
          .select('category_id')
          .eq('newsletter_id', newsletterId);
        if (nlCats && nlCats.length > 0) {
          nlCats.forEach((c: any) => targetCategoryIds.push(c.category_id));
        }
        if (targetCategoryIds.length > 0) {
          const { data: subCats } = await db
            .from('newsletter_subscriber_categories')
            .select('subscriber_id')
            .in('category_id', targetCategoryIds);
          const subscriberIds = new Set((subCats || []).map((sc: any) => sc.subscriber_id));
          subs = subs.filter((s: any) => subscriberIds.has(s.id));
        }
      }

      // Optional: narrow by tags (subscriber must be in at least one of these categories)
      if (tagIds.length > 0) {
        const { data: tagSubCats } = await db
          .from('newsletter_subscriber_categories')
          .select('subscriber_id')
          .in('category_id', tagIds);
        const tagSubscriberIds = new Set((tagSubCats || []).map((sc: any) => sc.subscriber_id));
        subs = subs.filter((s: any) => tagSubscriberIds.has(s.id));
      }

      if (subs.length === 0) {
        throw new Error('No subscribers match the selected filters (category, tags, industry, or group)');
      }
      targetSubscribers = subs;
    }

    // Exclude anyone already sent this newsletter (so resend/cleaned-list sends and cron batches never double-send)
    if (!isTest) {
      const { data: alreadySentRows } = await db
        .from('newsletter_sends')
        .select('subscriber_id')
        .eq('newsletter_id', newsletterId)
        .eq('status', 'sent');
      const alreadySentIds = new Set((alreadySentRows || []).map((r: { subscriber_id: string }) => r.subscriber_id));
      targetSubscribers = targetSubscribers.filter((s) => !alreadySentIds.has(s.id));
      targetSubscribers.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      if (targetSubscribers.length === 0) {
        throw new Error('No recipients left to send to. Everyone in the audience has already received this newsletter.');
      }
    }

    const totalRecipients = targetSubscribers.length;

    // Batch send: send in chunks (e.g. 400/day for Gmail limit)
    if (!isTest && (sendInBatches || continueBatch)) {
      const batchSend = (newsletter as any).batch_send === true;
      const currentBatchSent = Math.max(0, Number((newsletter as any).batch_sent_count) | 0);
      const defaultContinueSize = Math.max(1, Number((newsletter as any).batch_size) | 0) || 50;
      const requestedSize = Math.max(1, Number(body.batchSize ?? body.batch_size ?? 0) | 0);
      const size = continueBatch ? (requestedSize > 0 ? Math.min(requestedSize, 10000) : defaultContinueSize) : batchSize;

      if (sendInBatches && !continueBatch) {
        // First batch: save audience to scheduled_send_options for cron, then send first chunk
        const dailyLimitForCron = dailySendLimitFromBody ?? 400;
        const scheduledOpts: Record<string, unknown> = {
          sendToAllActive: body.sendToAllActive === true,
          recipientGroupIds: body.recipientGroupIds ?? body.recipient_group_ids ?? undefined,
          categoryFilters: body.categoryFilters ?? body.category_filters ?? undefined,
          industryFilter: body.industryFilter ?? body.industry_filter ?? undefined,
          tagCategoryIds: body.tagCategoryIds ?? body.tag_category_ids ?? undefined,
          sender_connection_id: senderConnectionId ?? undefined,
          daily_send_limit: dailyLimitForCron,
        };
        await db.from('newsletters').update({
          batch_send: true,
          batch_size: size,
          batch_sent_count: 0,
          batch_next_at: null,
          total_recipients: totalRecipients,
          scheduled_send_options: scheduledOpts,
        }).eq('id', newsletterId);

        targetSubscribers = targetSubscribers.slice(0, size);
      } else if (continueBatch && batchSend) {
        // Next batch: send next chunk
        targetSubscribers = targetSubscribers.slice(currentBatchSent, currentBatchSent + size);
        if (targetSubscribers.length === 0) {
          await db.from('newsletters').update({
            status: 'sent',
            sent_at: new Date().toISOString(),
          }).eq('id', newsletterId);
          return new Response(
            JSON.stringify({ success: true, continueBatch: true, batchComplete: true, sent: 0 }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Mark newsletter as sending (skip for test)
    if (!isTest) {
      await db.from('newsletters').update({
        status: 'sending',
        total_recipients: totalRecipients,
      }).eq('id', newsletterId);
    }

    // Determine email provider and connection (user-selected, or match sender profile / branding email)
    const { data: connections } = await db
      .from('crm_connections')
      .select('id, provider, from_email, metadata, status, connection_id')
      .eq('user_id', user.id)
      .in('provider', ['gmail', 'gmail_direct', 'resend', 'sendgrid'])
      .eq('status', 'active');

    const connList = connections || [];
    let effectiveConnection: any = null;
    if (senderConnectionId) {
      effectiveConnection = connList.find((c: any) => c.id === senderConnectionId) || null;
      if (!effectiveConnection && connList.length > 0) {
        throw new Error('Selected sender connection not found. Choose another in Send from.');
      }
    }
    if (!effectiveConnection) {
      const desiredFromEmail = (branding.senderEmail || '').trim().toLowerCase();
      const matchConnection = desiredFromEmail && connList.length
        ? connList.find((c: any) => (c.from_email || '').trim().toLowerCase() === desiredFromEmail)
        : null;
      // Prefer Gmail when no connection selected — typically lands in Primary; Resend/SendGrid often in Promotions
      const gmailFirst = connList.find((c: any) => ['gmail', 'gmail_direct'].includes(c.provider));
      effectiveConnection = matchConnection
        || gmailFirst
        || connList.find((c: any) => ['resend', 'sendgrid'].includes(c.provider))
        || connList[0];
    }

    const defaultProvider = businessProfile?.email_provider || 'resend';
    if (!effectiveConnection && connList.length === 0) {
      throw new Error('No active email connection. Add an email account in Settings > Integrations or Email Providers, then try again.');
    }

    // Daily send limit only for Gmail (500/day). Resend/SendGrid have no daily cap; 50 every 15 min applies to all.
    const isGmail = effectiveConnection && ['gmail', 'gmail_direct'].includes(effectiveConnection.provider);
    const batchSend = (newsletter as any).batch_send === true;
    const isBatchMode = sendInBatches || batchSend;
    let sentTodayForConnection = 0;
    let dailySendLimit = 400;
    if (!isTest && isBatchMode && effectiveConnection?.id && isGmail) {
      const opts = (newsletter as any).scheduled_send_options as Record<string, unknown> | null;
      dailySendLimit = dailySendLimitFromBody ?? (opts?.daily_send_limit != null ? Math.min(2000, Math.max(1, Number(opts.daily_send_limit) | 0)) : 400);
      const now = new Date();
      const startOfTodayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
      const { count } = await db.from('newsletter_sends').select('id', { count: 'exact', head: true }).eq('sender_connection_id', effectiveConnection.id).eq('status', 'sent').gte('sent_at', startOfTodayUTC);
      sentTodayForConnection = count ?? 0;
      if (continueBatch && sentTodayForConnection >= dailySendLimit) {
        const startOfNextDayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString();
        await db.from('newsletters').update({ batch_next_at: startOfNextDayUTC }).eq('id', newsletterId);
        return new Response(
          JSON.stringify({ success: true, continueBatch: true, dailyLimitReached: true, sent: 0, nextBatchAt: startOfNextDayUTC }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const maxCanSendToday = dailySendLimit - sentTodayForConnection;
      if (targetSubscribers.length > maxCanSendToday) {
        targetSubscribers = targetSubscribers.slice(0, maxCanSendToday);
      }
    }

    const emailProvider = effectiveConnection?.provider || defaultProvider;
    const senderName = branding.senderName || branding.companyName || userProfile?.full_name || 'Newsletter';
    const senderTitle = branding.senderTitle || userProfile?.job_title;
    const senderEmail = effectiveConnection?.from_email || branding.senderEmail || userProfile?.email || user.email;

    // Build the unsubscribe base URL
    const appUrl = supabaseUrl.replace('.supabase.co', '.supabase.co');
    const unsubscribeBaseUrl = `${supabaseUrl}/functions/v1/newsletter-unsubscribe`;

    let sentCount = 0;
    let failedCount = 0;

    const bc = branding.brandColor || '#8b5cf6';
    const companyDisplayName = branding.companyName || senderName;
    const websiteLink = branding.websiteUrl
      ? `<a href="${branding.websiteUrl.startsWith('http') ? branding.websiteUrl : 'https://' + branding.websiteUrl}" style="color:${bc};text-decoration:underline;">${branding.websiteUrl.replace(/^https?:\/\//i, '')}</a>`
      : '';

    for (const subscriber of targetSubscribers) {
      let sendRecord: { id: string } | null = null;
      try {
        const unsubscribeUrl = `${unsubscribeBaseUrl}?token=${subscriber.unsubscribe_token}`;

        let fullBody = newsletter.body_html || '';
        if (newsletter.cta_text && newsletter.cta_url) {
          fullBody += `
            <div style="text-align:center;margin:28px 0;">
              <a href="${newsletter.cta_url}" style="display:inline-block;padding:14px 36px;background:${bc};color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:16px;">${newsletter.cta_text}</a>
            </div>`;
        }

        const firstName = subscriber.first_name || '';
        const lastName = subscriber.last_name || '';
        fullBody = fullBody
          .replace(/\[first_name\]/gi, firstName)
          .replace(/\[last_name\]/gi, lastName)
          .replace(/\[company\]/gi, subscriber.company || '')
          .replace(/\[email\]/gi, subscriber.email);

        const newsletterFooterHtml = `
          <div style="border-top:1px solid #e5e7eb;margin-top:8px;padding:20px 28px 16px;text-align:center;">
            <p style="margin:0 0 6px;font-size:12px;color:#6b7280;line-height:1.5;">
              You received this because you subscribed to <strong>${companyDisplayName}</strong> newsletters.
            </p>
            ${websiteLink ? `<p style="margin:0 0 10px;font-size:12px;">${websiteLink}</p>` : ''}
            <p style="margin:0;font-size:11px;">
              <a href="${unsubscribeUrl}" style="color:#9ca3af;text-decoration:underline;">Unsubscribe</a>
              <span style="color:#d1d5db;margin:0 6px;">|</span>
              <a href="mailto:${senderEmail}" style="color:#9ca3af;text-decoration:underline;">Contact us</a>
            </p>
          </div>`;

        const finalHtml = renderEmailTemplate(branding.templateStyle, {
          body: fullBody,
          senderName,
          signatureName: branding.signatureName ?? undefined,
          senderEmail,
          senderTitle,
          companyName: branding.companyName,
          headerName: branding.headerName || undefined,
          logoUrl: branding.logoUrl,
          brandColor: bc,
          footerText: branding.footerText,
          footerImageUrl: branding.footerImageUrl,
          signature: branding.signature,
          senderImageUrl: branding.senderImageUrl || userProfile?.avatar_url,
          websiteUrl: branding.websiteUrl ?? undefined,
          newsletterFooterHtml,
        });

        const personalizedSubject = (newsletter.subject || 'Newsletter')
          .replace(/\[first_name\]/gi, firstName)
          .replace(/\[last_name\]/gi, lastName)
          .replace(/\[company\]/gi, subscriber.company || '');

        // Create send record (skip for test)
        if (!isTest) {
          const { data: sr } = await db.from('newsletter_sends').insert({
            newsletter_id: newsletterId,
            subscriber_id: subscriber.id,
            status: 'pending',
            sender_connection_id: effectiveConnection?.id ?? null,
          }).select('id').single();
          sendRecord = sr;
        }

        // Send the email via configured provider
        let messageId: string | null = null;

        if (emailProvider === 'gmail_direct' || emailProvider === 'gmail') {
          const gmailConnection = (effectiveConnection && ['gmail', 'gmail_direct'].includes(effectiveConnection.provider))
            ? effectiveConnection
            : (connections || []).find((c: any) =>
                ['gmail', 'gmail_direct'].includes(c.provider) && c.status === 'active'
              );
          if (gmailConnection) {
            const metadata = gmailConnection.metadata as any;
            let accessToken = metadata?.access_token;
            const expiresAt = metadata?.expires_at;

            if (expiresAt && new Date(expiresAt) <= new Date()) {
              const refreshResponse = await (triggeredByCron ? supabaseAdmin : supabaseAnon).functions.invoke('gmail-oauth-refresh', {
                body: { connection_id: gmailConnection.id },
              });
              if (refreshResponse.data?.access_token) {
                accessToken = refreshResponse.data.access_token;
              }
            }

            if (accessToken) {
              const fromEmail = senderEmail;
              const fromLine = senderName ? `From: ${encodeRfc2047(senderName)} <${fromEmail}>` : `From: ${fromEmail}`;
              const rawEmail = [
                fromLine,
                `To: ${subscriber.email}`,
                `Subject: ${encodeRfc2047(personalizedSubject)}`,
                'MIME-Version: 1.0',
                'Content-Type: text/html; charset=utf-8',
                `List-Unsubscribe: <${unsubscribeUrl}>`,
                `List-Unsubscribe-Post: List-Unsubscribe=One-Click`,
                '',
                finalHtml,
              ].join('\r\n');

              const utf8Bytes = new TextEncoder().encode(rawEmail);
              const binary = Array.from(utf8Bytes).map((b) => String.fromCharCode(b)).join('');
              const encodedMessage = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
              const gmailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ raw: encodedMessage }),
              });

              if (gmailRes.ok) {
                const gdata = await gmailRes.json();
                messageId = gdata.id;
              } else {
                throw new Error(`Gmail send failed: ${await gmailRes.text()}`);
              }
            }
          }
        } else if (emailProvider === 'sendgrid') {
          const sendgridApiKey = Deno.env.get('SENDGRID_API_KEY');
          if (sendgridApiKey) {
            const fromEmail = senderEmail;
            const sgRes = await fetch('https://api.sendgrid.com/v3/mail/send', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${sendgridApiKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                personalizations: [{ to: [{ email: subscriber.email }] }],
                from: { email: fromEmail, name: senderName },
                reply_to: { email: fromEmail, name: senderName },
                subject: personalizedSubject,
                content: [{ type: 'text/html', value: finalHtml }],
                headers: {
                  'List-Unsubscribe': `<${unsubscribeUrl}>`,
                  'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
                  'X-Priority': '3',
                  'Importance': 'normal',
                },
              }),
            });
            if (sgRes.ok || sgRes.status === 202) {
              messageId = sgRes.headers.get('X-Message-Id') || `sg-${Date.now()}`;
            } else {
              throw new Error(`SendGrid failed: ${await sgRes.text()}`);
            }
          }
        } else {
          // Resend
          const resendApiKey = Deno.env.get('RESEND_API_KEY');
          if (!resendApiKey) throw new Error('No email provider configured');

          const fromEmail = senderEmail;
          const resendRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: `${senderName} <${fromEmail}>`,
              to: [subscriber.email],
              subject: personalizedSubject,
              html: finalHtml,
              reply_to: fromEmail,
              headers: {
                'List-Unsubscribe': `<${unsubscribeUrl}>`,
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
                'X-Priority': '3',
                'Importance': 'normal',
              },
            }),
          });
          if (resendRes.ok) {
            const rdata = await resendRes.json();
            messageId = rdata.id;
          } else {
            throw new Error(`Resend failed: ${await resendRes.text()}`);
          }
        }

        // Update send record (skip for test); store external_message_id for Resend webhook/sync
        if (!isTest && sendRecord) {
          await supabaseAdmin.from('newsletter_sends').update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            ...(messageId && { external_message_id: messageId }),
          }).eq('id', sendRecord.id);
        }
        sentCount++;

        // Rate limit: 100ms between sends
        await new Promise(r => setTimeout(r, 100));

      } catch (sendError: any) {
        console.error(`Failed to send to ${subscriber.email}:`, sendError.message);
        if (isTest) {
          // For test send, surface the error so the user sees why it failed
          throw new Error(sendError?.message || 'Test send failed');
        }
        if (sendRecord) {
          await supabaseAdmin.from('newsletter_sends').update({
            status: 'failed',
            error_message: (sendError?.message || 'Send failed').slice(0, 500),
          }).eq('id', sendRecord.id);
        }
        failedCount++;
      }
    }

    // Update newsletter status (skip for test)
    if (!isTest) {
      const prevBatchSent = Math.max(0, Number((newsletter as any).batch_sent_count) | 0);
      const newBatchSent = prevBatchSent + sentCount;
      const totalExpected = batchSend ? (Number((newsletter as any).total_recipients) || totalRecipients) : totalRecipients;
      const allBatchesDone = batchSend && newBatchSent >= totalExpected;
      const sentTodayAfter = sentTodayForConnection + sentCount;
      const hitDailyLimit = isBatchMode && isGmail && effectiveConnection?.id && sentTodayAfter >= dailySendLimit;
      const nowForNext = new Date();
      const nextBatchAt = allBatchesDone
        ? null
        : hitDailyLimit
          ? new Date(Date.UTC(nowForNext.getUTCFullYear(), nowForNext.getUTCMonth(), nowForNext.getUTCDate() + 1)).toISOString()
          : new Date(Date.now() + 15 * 60 * 1000).toISOString();

      if (batchSend) {
        await db.from('newsletters').update({
          batch_sent_count: newBatchSent,
          batch_next_at: allBatchesDone ? null : nextBatchAt,
          status: allBatchesDone ? 'sent' : 'sending',
          sent_at: allBatchesDone ? new Date().toISOString() : (newsletter as any).sent_at,
          total_sent: newBatchSent,
        }).eq('id', newsletterId);
      } else {
        await db.from('newsletters').update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          total_sent: sentCount,
        }).eq('id', newsletterId);
      }
    } else if (sentCount > 0 && newsletter.status === 'sending') {
      // Unstick newsletter that was left in 'sending' after a failed run so test sends work next time
      await db.from('newsletters').update({ status: 'draft' }).eq('id', newsletterId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        recipientCount: targetSubscribers.length,
        sent: sentCount,
        failed: failedCount,
        test: isTest,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Newsletter send error:', error);
    const message = error?.message || 'Newsletter send failed';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
