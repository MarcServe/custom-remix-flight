import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// The ready-made "Day 1 / 3 / 5" no-reply follow-up steps. delayDays are gaps from
// the previous email → 1, then +2, then +2 = lands on day 1, 3, 5. No automation_rule
// so it's purely time-based; the engine's guaranteed reply-stop halts it on any reply.
const FOLLOWUP_STEPS = [
  { subject: 'Just following up', body: "Hi {{firstName}},\n\nI wanted to quickly follow up on my previous email in case it slipped through. Would you be open to a short conversation?\n\nThanks!", delayDays: 1 },
  { subject: 'Re: quick follow-up', body: "Hi {{firstName}},\n\nCircling back on this — I'd genuinely value your thoughts, and I'm happy to share more detail or answer any questions.\n\nBest,", delayDays: 2 },
  { subject: 'Last note from me', body: "Hi {{firstName}},\n\nI don't want to clutter your inbox, so this will be my last note. If the timing isn't right, no problem at all — just let me know and I'll reach out again down the line.\n\nThanks for your time.", delayDays: 2 },
];

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization') || '';
    const anon = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authErr } = await anon.auth.getUser();
    if (authErr || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { campaignId, enrollExisting } = await req.json().catch(() => ({}));

    // 1. Create (or reuse an identical) 1/3/5 sequence for this user
    const seqName = 'No-reply follow-up (Day 1 / 3 / 5)';
    let sequenceId: string;
    const { data: existingSeq } = await db.from('email_sequences').select('id').eq('created_by', user.id).eq('name', seqName).limit(1).maybeSingle();
    if (existingSeq?.id) {
      sequenceId = existingSeq.id;
    } else {
      const { data: seq, error: seqErr } = await db.from('email_sequences').insert({
        name: seqName,
        description: 'Auto-created: 3 gentle follow-ups on day 1, 3 and 5. Stops automatically as soon as the recipient replies.',
        steps: FOLLOWUP_STEPS.map((s) => JSON.stringify(s)),
        created_by: user.id,
        repeat_sequence: false,
        repeat_after_days: 5,
        repeat_only_for: 'no_reply',
        auto_respond: false,
        use_email_branding: true,
      }).select('id').single();
      if (seqErr || !seq) throw new Error(seqErr?.message || 'Failed to create sequence');
      sequenceId = seq.id;
    }

    let attachedToCampaign = false;
    let enrolledCompanies = 0;

    if (campaignId) {
      // Verify campaign ownership, then attach the sequence
      const { data: campaign } = await db.from('email_campaigns').select('id, user_id, sender_profile_id').eq('id', campaignId).single();
      if (!campaign || campaign.user_id !== user.id) throw new Error('Campaign not found');
      await db.from('email_campaigns').update({ auto_follow_up_enabled: true, follow_up_sequence_id: sequenceId }).eq('id', campaignId);
      attachedToCampaign = true;

      if (enrollExisting === true) {
        // Emails that already replied to this campaign — exclude them
        const { data: replied } = await db.from('email_activities')
          .select('metadata')
          .not('replied_at', 'is', null)
          .filter('metadata->>campaign_id', 'eq', campaignId);
        const repliedEmails = new Set((replied || []).map((r: any) => (r.metadata?.recipient_email || '').toLowerCase().trim()).filter(Boolean));

        // Sent recipients with a linked person (batched)
        const recipients: any[] = [];
        const PAGE = 1000;
        let page = 0;
        while (true) {
          const { data } = await db.from('email_campaign_recipients')
            .select('id, email, person_id, sent_at, personalized_subject, personalized_body_text, external_message_id')
            .eq('campaign_id', campaignId)
            .in('status', ['sent', 'delivered', 'opened', 'clicked'])
            .not('person_id', 'is', null)
            .range(page * PAGE, (page + 1) * PAGE - 1);
          if (data?.length) recipients.push(...data);
          if (!data || data.length < PAGE) break;
          page++;
        }

        // Resolve person → company
        const personIds = [...new Set(recipients.map((r) => r.person_id).filter(Boolean))];
        const personToCompany = new Map<string, string>();
        for (let i = 0; i < personIds.length; i += PAGE) {
          const { data: people } = await db.from('people').select('id, company_id').in('id', personIds.slice(i, i + PAGE));
          (people || []).forEach((p: any) => { if (p.company_id) personToCompany.set(p.id, p.company_id); });
        }

        // Companies already enrolled for this campaign (dedupe)
        const { data: alreadyEnrolled } = await db.from('company_sequences').select('company_id').eq('campaign_id', campaignId);
        const enrolledSet = new Set((alreadyEnrolled || []).map((c: any) => c.company_id));

        const personalizedEmails = [{ stepNumber: 0, subject: '(Campaign)', body: '', delayDays: 0 },
          ...FOLLOWUP_STEPS.map((s, i) => ({ stepNumber: i + 1, subject: s.subject, body: s.body, delayDays: s.delayDays }))];

        const nowIso = new Date().toISOString();
        const seenCompany = new Set<string>();
        for (const r of recipients) {
          if (repliedEmails.has((r.email || '').toLowerCase().trim())) continue;
          const companyId = personToCompany.get(r.person_id);
          if (!companyId || enrolledSet.has(companyId) || seenCompany.has(companyId)) continue;
          seenCompany.add(companyId);
          const { data: newCs, error: csErr } = await db.from('company_sequences').insert({
            company_id: companyId,
            sequence_id: sequenceId,
            campaign_id: campaignId,
            sender_profile_id: campaign.sender_profile_id ?? null,
            current_step: 0,
            personalized_emails: personalizedEmails,
            status: 'active',
            // Purely time-based for a clean day-1/3/5 cadence; reply-stop still applies.
            automation_rules: { enabled: false, rules: [] },
            metadata: { first_email_sent_at: nowIso, campaign_recipient_id: r.id, enrolled_after_send: true },
          }).select('id').single();
          if (!csErr && newCs?.id) {
            // Step-0 activity timed at NOW so the cadence starts fresh (not from the original send date)
            await db.from('email_activities').insert({
              company_sequence_id: newCs.id, contact_id: null, step_number: 0,
              subject: r.personalized_subject, body: r.personalized_body_text,
              status: 'sent', sent_at: nowIso, external_message_id: r.external_message_id,
              metadata: { campaign_id: campaignId, campaign_recipient_id: r.id, recipient_email: r.email },
            });
            enrolledCompanies++;
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true, sequenceId, attachedToCampaign, enrolledCompanies }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'Failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
