// Snapshot of what is going on in an account, for the support assistant.
async function count(q: any): Promise<number> {
  const { count: c } = await q;
  return c || 0;
}

export async function overview(db: any, userId: string, daysIn?: number) {
  const days = Math.max(1, Math.min(60, Number(daysIn) || 14));
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data: camps } = await db.from("email_campaigns")
    .select("id, name, status, total_recipients, sent_count, scheduled_at, started_at, completed_at, created_at, auto_follow_up_enabled, sender_profile:sender_profiles(name, sender_email)")
    .eq("user_id", userId)
    .or(`status.in.(sending,scheduled,paused),and(status.eq.draft,total_recipients.gt.0),and(status.eq.completed,completed_at.gte.${since})`)
    .order("created_at", { ascending: false }).limit(40);
  const campaigns = [];
  for (const c of camps || []) {
    const r = db.from("email_campaign_recipients");
    const [sent, opened, clicked, replied, bounced, pending, failed] = await Promise.all([
      count(r.select("id", { count: "exact", head: true }).eq("campaign_id", c.id).not("external_message_id", "is", null)),
      count(db.from("email_campaign_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", c.id).in("status", ["opened", "clicked", "replied"])),
      count(db.from("email_campaign_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", c.id).eq("status", "clicked")),
      count(db.from("email_campaign_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", c.id).eq("status", "replied")),
      count(db.from("email_campaign_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", c.id).eq("status", "bounced")),
      count(db.from("email_campaign_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", c.id).eq("status", "pending")),
      count(db.from("email_campaign_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", c.id).eq("status", "failed")),
    ]);
    const [fuActive, fuPaused, fuDone] = await Promise.all([
      count(db.from("company_sequences").select("id", { count: "exact", head: true }).eq("campaign_id", c.id).eq("status", "active")),
      count(db.from("company_sequences").select("id", { count: "exact", head: true }).eq("campaign_id", c.id).eq("status", "paused")),
      count(db.from("company_sequences").select("id", { count: "exact", head: true }).eq("campaign_id", c.id).eq("status", "completed")),
    ]);
    campaigns.push({
      id: c.id, name: c.name, status: c.status, recipients: c.total_recipients,
      created: c.created_at, scheduled_for: c.scheduled_at, finished: c.completed_at,
      sends_as: (c as any).sender_profile ? `${(c as any).sender_profile.name} <${(c as any).sender_profile.sender_email || "default"}>` : "default business profile",
      delivered_to_provider: sent, opened, clicked, replied, bounced, waiting_to_send: pending, failed,
      follow_ups: c.auto_follow_up_enabled ? { running: fuActive, paused: fuPaused, finished: fuDone } : "off",
      link: `/campaigns?open=${c.id}`,
    });
  }
  const { data: ap } = await db.from("autonomous_discovery_settings")
    .select("enabled, discovery_frequency, daily_lead_target, full_auto_mode, next_run_at, last_run_at").eq("user_id", userId).maybeSingle();
  const { data: personas } = await db.from("discovery_personas").select("name, is_active").eq("user_id", userId);
  const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  const [pendingLeads, leadsThisMonth, unreadNotes, repliesWeek, bouncesWeek] = await Promise.all([
    count(db.from("autonomous_leads").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "pending")),
    count(db.from("autonomous_leads").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", monthStart.toISOString()).neq("source", "curated")),
    count(db.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null)),
    count(db.from("email_campaign_recipients").select("id, email_campaigns!inner(user_id)", { count: "exact", head: true }).eq("email_campaigns.user_id", userId).eq("status", "replied").gte("updated_at", new Date(Date.now() - 7 * 86_400_000).toISOString())),
    count(db.from("email_bounce_events").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("occurred_at", new Date(Date.now() - 7 * 86_400_000).toISOString())),
  ]);
  const { data: newsletters } = await db.from("newsletters").select("id, title, status, scheduled_at, sent_at")
    .eq("user_id", userId).in("status", ["scheduled", "sending"]).limit(10);
  const { data: series } = await db.from("newsletter_series").select("name, status, start_date, duration_days, send_time").eq("user_id", userId);
  return {
    now_uk: new Date().toLocaleString("en-GB", { timeZone: "Europe/London" }),
    campaigns,
    autopilot: ap ? { ...ap, personas_active: (personas || []).filter((p: any) => p.is_active).map((p: any) => p.name), new_leads_this_month: leadsThisMonth, leads_waiting_for_review: pendingLeads, link: "/autopilot" } : { enabled: false, link: "/autopilot" },
    lead_inbox: { waiting_for_review: pendingLeads, link: "/lead-inbox?tab=pending" },
    replies_last_7_days: { count: repliesWeek, link: "/conversations" },
    bounces_last_7_days: { count: bouncesWeek, link: "/email-deliverability" },
    unread_notifications: unreadNotes,
    newsletters_scheduled_or_sending: (newsletters || []).map((n: any) => ({ ...n, link: `/newsletters?edit=${n.id}` })),
    newsletter_series: series || [],
  };
}

