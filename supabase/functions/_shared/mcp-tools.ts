// Single source of truth for the LeadBoosters MCP tool catalogue (JSON Schema).
// Served by the hosted `mcp` function; the local stdio server proxies to it.
// Every tool maps 1:1 onto an `action` of api-campaigns.

type Schema = Record<string, unknown>;
const S = (d: string, extra: Schema = {}): Schema => ({ type: "string", description: d, ...extra });
const N = (d: string, extra: Schema = {}): Schema => ({ type: "number", description: d, ...extra });
const I = (d: string, extra: Schema = {}): Schema => ({ type: "integer", description: d, ...extra });
const B = (d: string): Schema => ({ type: "boolean", description: d });
const A = (items: Schema, d: string): Schema => ({ type: "array", items, description: d });
const O = (props: Record<string, Schema>, required: string[] = []): Schema => ({ type: "object", properties: props, ...(required.length ? { required } : {}), additionalProperties: false });
const TAGS = A({ type: "string" }, "Tags");

const recipient = O({
  email: S("Email address"),
  phone: S("Phone number; +44… preferred, UK numbers starting 0 are converted"),
  first_name: S("First name"), last_name: S("Last name"),
  name: S("Full name or business name (used when first/last not given)"),
  company: S("Company name"),
});
const scheduleAt = S("UK (London) wall-clock 'YYYY-MM-DDTHH:mm', or a full ISO timestamp. Omit for a draft.");
const step = O({ subject: S("Email subject"), body: S("Plain text; {{firstName}} {{company}} etc. supported"), delayDays: I("Days after the previous step. Step 1 sends immediately on enrolment.", { minimum: 0 }) }, ["subject", "body"]);

export interface McpTool { name: string; description: string; inputSchema: Schema; action: string; sends?: boolean }

export const MCP_TOOLS: McpTool[] = [
  // ── Brand & senders
  { name: "get_business_profile", action: "get_business_profile", description: "Read the business profile: company name, industry, services, audience, value proposition, tone, brand colour, logo/footer URLs, email signature and sender name. Read this before writing any email or newsletter so the copy and HTML are on-brand.", inputSchema: O({}) },
  { name: "list_senders", action: "list_senders", description: "List connected email senders (Gmail/Resend/SendGrid: from address, status) and phone/SMS services (Twilio etc.). Tells you whether sends and SMS campaigns can actually go out.", inputSchema: O({}) },

  // ── Contacts & companies
  { name: "search_contacts", action: "search_contacts", description: "Search CRM contacts (people) by name, email or job title; optionally filter by tag or company name. Returns id, name, email, phone, title, company, tags.", inputSchema: O({ query: S("Free text"), tag: S("Exact tag"), company: S("Company name contains"), limit: I("Max rows", { minimum: 1, maximum: 500 }) }) },
  { name: "get_contact", action: "get_contact", description: "Fetch one contact with their company, by contact_id or email.", inputSchema: O({ contact_id: S("Contact id"), email: S("Email") }) },
  { name: "upsert_contact", action: "upsert_contact", description: "Create a contact, or update the one with this email. Company is matched by name (created if new). Use add_tags to append tags without replacing existing ones.", inputSchema: O({ email: S("Email"), first_name: S(""), last_name: S(""), phone: S(""), title: S("Job title"), company: S("Company name"), location: S(""), linkedin_url: S(""), bio: S(""), tags: A({ type: "string" }, "Replace tags"), add_tags: A({ type: "string" }, "Append tags") }, ["email"]) },
  { name: "update_contact", action: "update_contact", description: "Update fields on an existing contact by contact_id.", inputSchema: O({ contact_id: S("Contact id"), email: S(""), first_name: S(""), last_name: S(""), phone: S(""), title: S(""), company: S(""), location: S(""), linkedin_url: S(""), bio: S(""), tags: TAGS }, ["contact_id"]) },
  { name: "search_companies", action: "search_companies", description: "Search companies by name, website, industry or general email; optional status filter (NEW, QUALIFIED, CONTACTED, MEETING, PROPOSAL, WON, LOST).", inputSchema: O({ query: S("Free text"), status: S("Status"), limit: I("Max rows", { minimum: 1, maximum: 500 }) }) },
  { name: "get_company", action: "get_company", description: "Fetch one company with its contacts and deals, by company_id or exact name.", inputSchema: O({ company_id: S(""), name: S("") }) },
  { name: "upsert_company", action: "upsert_company", description: "Create a company, or update the one with this name (case-insensitive match).", inputSchema: O({ name: S("Company name"), website: S(""), industry: S(""), company_phone: S(""), general_email: S(""), description: S(""), headquarters: S(""), size: S(""), linkedin_url: S(""), status: S("NEW|QUALIFIED|CONTACTED|MEETING|PROPOSAL|WON|LOST"), temperature: S("hot|warm|cold", { enum: ["hot", "warm", "cold"] }), tags: TAGS }, ["name"]) },
  { name: "update_company", action: "update_company", description: "Update fields on an existing company by company_id.", inputSchema: O({ company_id: S("Company id"), name: S(""), website: S(""), industry: S(""), company_phone: S(""), general_email: S(""), description: S(""), headquarters: S(""), size: S(""), status: S(""), temperature: S("", { enum: ["hot", "warm", "cold"] }), tags: TAGS }, ["company_id"]) },

  // ── Groups
  { name: "list_groups", action: "list_groups", description: "List recipient groups (id, name, channel email/phone/mixed, member count). Resolve a group name to its id here before using it elsewhere.", inputSchema: O({}) },
  { name: "get_group", action: "get_group", description: "List a group's members (paginated). Pass group_id or group_name.", inputSchema: O({ group_id: S(""), group_name: S(""), limit: I("", { minimum: 1, maximum: 1000 }), offset: I("", { minimum: 0 }) }) },
  { name: "create_group", action: "create_group", description: "Create a recipient group from a list of people. Members may have an email, a phone number, or both (so one group can serve both email and SMS campaigns).", inputSchema: O({ name: S("Group name"), description: S(""), recipients: A(recipient, "Members"), channel: S("email|phone|mixed (defaults from the members given)", { enum: ["email", "phone", "mixed"] }) }, ["name", "recipients"]) },
  { name: "add_to_group", action: "add_to_group", description: "Add people to a group (deduped against existing members). Pass group_id, or group_name (created if it doesn't exist). Sources: recipients[], contact_ids[] (CRM contacts), company_ids[] (uses the company's general email/phone).", inputSchema: O({ group_id: S(""), group_name: S(""), description: S(""), recipients: A(recipient, ""), contact_ids: A({ type: "string" }, ""), company_ids: A({ type: "string" }, ""), create_if_missing: B("Default true when group_name is given") }) },
  { name: "remove_from_group", action: "remove_from_group", description: "Remove members from a group by email and/or phone.", inputSchema: O({ group_id: S(""), group_name: S(""), emails: A({ type: "string" }, ""), phones: A({ type: "string" }, "") }) },
  { name: "delete_group", action: "delete_group", description: "Delete a recipient group and its member list. Refuses when the group has members unless confirm=true (ask the user first). Campaigns already created from it are unaffected.", inputSchema: O({ group_id: S(""), group_name: S(""), confirm: B("") }) },

  // ── Email campaigns
  { name: "create_campaign", action: "create", description: "Create an email campaign (HTML and/or text) and optionally schedule it. Recipients come from an explicit list and/or group_ids. Subject/body support {{firstName}} {{lastName}} {{fullName}} {{company}} {{email}}. Defaults: recipients are linked to CRM people/companies and the Day 1/3/5 no-reply follow-up is on (set follow_up=false for a one-off). With an explicit recipients list, set a short descriptive group_name — it is saved as a reusable group. Omit schedule_at to create a draft, then use send_test to preview and send_campaign to send.", inputSchema: O({ name: S("Internal campaign name"), subject: S("Subject"), body_html: S("Full HTML email body. Branding (logo, footer, signature) is applied by the sender."), body_text: S("Plain-text body; derived from HTML if omitted"), recipients: A(recipient, ""), group_ids: A({ type: "string" }, ""), group_name: S(""), follow_up: B("Default true"), schedule_at: scheduleAt }, ["name", "subject"]) },
  { name: "list_campaigns", action: "list", description: "List recent campaigns (email and SMS) with status and sent/failed counts.", inputSchema: O({}) },
  { name: "get_campaign", action: "get_campaign", description: "Full status for one campaign: counts by recipient status, sample failures, and (with include_body) the subject/body.", inputSchema: O({ campaign_id: S(""), include_body: B("") }, ["campaign_id"]) },
  { name: "update_campaign", action: "update_campaign", description: "Edit a draft/scheduled/paused campaign: name, subject, body_html/body_text (or message for SMS), schedule_at (or unschedule=true). Pending recipients are re-personalised.", inputSchema: O({ campaign_id: S(""), name: S(""), subject: S(""), body_html: S(""), body_text: S(""), message: S("SMS text"), schedule_at: S(""), unschedule: B("") }, ["campaign_id"]) },
  { name: "send_campaign", action: "send_campaign", sends: true, description: "SEND NOW: start sending a draft/scheduled/paused campaign (email or SMS) to its pending recipients immediately. This sends real messages — confirm with the user first unless they already asked to send.", inputSchema: O({ campaign_id: S("") }, ["campaign_id"]) },
  { name: "unschedule_campaign", action: "unschedule_campaign", description: "Cancel a scheduled or paused campaign back to a draft so it will not send.", inputSchema: O({ campaign_id: S("") }, ["campaign_id"]) },
  { name: "send_test", action: "send_test", sends: true, description: "Send a one-off test email to yourself to preview subject/body before sending for real. Needs an active Resend or SendGrid sender.", inputSchema: O({ to_email: S(""), subject: S(""), body_html: S(""), body_text: S("") }, ["to_email", "subject"]) },

  // ── SMS
  { name: "create_phone_campaign", action: "create_phone_campaign", description: "Create an SMS campaign. Recipients from recipients[{phone,name?,message?}] and/or group_ids. message supports {name} {first_name} {company} {phone}; a recipient's own message overrides it. UK landlines are skipped at send time. Saved as a draft unless schedule_at or send_now=true.", inputSchema: O({ name: S(""), message: S(""), recipients: A(O({ phone: S(""), name: S(""), first_name: S(""), last_name: S(""), company: S(""), message: S("Per-recipient text") }), ""), group_ids: A({ type: "string" }, ""), schedule_at: scheduleAt, send_now: B("Send immediately (real texts)") }, ["name"]) },

  // ── Newsletters
  { name: "create_newsletter", action: "create_newsletter", description: "Create a newsletter (HTML) for your subscriber base and optionally schedule it. Audience defaults to all active subscribers; pass group_ids to target a group instead.", inputSchema: O({ subject: S(""), title: S(""), body_html: S(""), body_text: S(""), audience: O({ all_active: B(""), group_ids: A({ type: "string" }, ""), tag_ids: A({ type: "string" }, "") }), schedule_at: scheduleAt }, ["subject"]) },
  { name: "list_newsletters", action: "list_newsletters", description: "List newsletters with status and send/open/click totals.", inputSchema: O({ limit: I("") }) },
  { name: "send_newsletter", action: "send_newsletter", sends: true, description: "SEND NOW: send a draft newsletter immediately to its audience (or an audience given here). Sends real email — confirm with the user first.", inputSchema: O({ newsletter_id: S(""), audience: O({ all_active: B(""), group_ids: A({ type: "string" }, "") }) }, ["newsletter_id"]) },
  { name: "list_subscribers", action: "list_subscribers", description: "List newsletter subscribers (default status active) with optional search.", inputSchema: O({ query: S(""), status: S(""), limit: I("") }) },
  { name: "add_subscribers", action: "add_subscribers", description: "Add newsletter subscribers (existing emails are skipped).", inputSchema: O({ subscribers: A(recipient, ""), source: S("") }, ["subscribers"]) },

  // ── Deals
  { name: "list_deals", action: "list_deals", description: "List deals, optionally by stage (LEAD, QUALIFIED, PROPOSAL, NEGOTIATION, WON, LOST).", inputSchema: O({ stage: S(""), limit: I("") }) },
  { name: "create_deal", action: "create_deal", description: "Create a deal. company is matched by name (created if new).", inputSchema: O({ title: S(""), company: S(""), company_id: S(""), stage: S(""), amount: N(""), priority: S(""), close_date: S("YYYY-MM-DD"), follow_up_date: S("YYYY-MM-DD"), notes: S(""), tags: TAGS }, ["title"]) },
  { name: "update_deal", action: "update_deal", description: "Update a deal by deal_id (stage, amount, dates, notes, tags, company).", inputSchema: O({ deal_id: S(""), title: S(""), stage: S(""), amount: N(""), priority: S(""), close_date: S(""), follow_up_date: S(""), notes: S(""), tags: TAGS, company: S("") }, ["deal_id"]) },

  // ── Sequences & follow-ups
  { name: "list_sequences", action: "list_sequences", description: "List follow-up sequences (id, name, step count, enrolment counts by status).", inputSchema: O({ limit: I("") }) },
  { name: "get_sequence", action: "get_sequence", description: "Get one sequence with its steps and enrolment counts. Pass sequence_id or sequence_name.", inputSchema: O({ sequence_id: S(""), sequence_name: S("") }) },
  { name: "create_sequence", action: "create_sequence", description: "Create a follow-up sequence: an ordered list of emails with day delays. Used as a campaign's follow-up or via enroll_in_sequence.", inputSchema: O({ name: S(""), description: S(""), steps: A(step, "Steps in order"), repeat_sequence: B(""), repeat_after_days: I(""), repeat_only_for: S("", { enum: ["no_reply", "not_opened", "opened_not_clicked", "clicked_not_replied", "all"] }) }, ["name", "steps"]) },
  { name: "update_sequence", action: "update_sequence", description: "Rename a sequence or replace its steps. People already enrolled keep the steps they started with.", inputSchema: O({ sequence_id: S(""), sequence_name: S(""), name: S(""), description: S(""), steps: A(step, ""), repeat_sequence: B(""), repeat_after_days: I(""), repeat_only_for: S("") }) },
  { name: "enroll_in_sequence", action: "enroll_in_sequence", sends: true, description: "Start people on a sequence. Each is linked to a CRM company (created if needed); anyone already active on that sequence is skipped. By default step 1 is emailed immediately (REAL email) and later steps go out automatically after their delays, stopping on reply. Sources: recipients[], contact_ids[], company_ids[], group_id/group_name.", inputSchema: O({ sequence_id: S(""), sequence_name: S(""), recipients: A(recipient, ""), contact_ids: A({ type: "string" }, ""), company_ids: A({ type: "string" }, ""), group_id: S(""), group_name: S(""), send_first_now: B("Default true. false = the hourly run sends step 1 within the hour.") }) },
  { name: "list_enrollments", action: "list_enrollments", description: "Who is on which sequence: status, current step, last send, opened/replied, next step and when it is due. Filter by status (default active; 'all'), sequence_id or campaign_id.", inputSchema: O({ status: S(""), sequence_id: S(""), campaign_id: S(""), limit: I("") }) },
  { name: "update_enrollment", action: "update_enrollment", description: "Pause, resume or stop one enrolment.", inputSchema: O({ enrollment_id: S(""), status: S("", { enum: ["active", "paused", "completed"] }) }, ["enrollment_id", "status"]) },
  { name: "run_sequences_now", action: "run_sequences_now", sends: true, description: "Run the follow-up processor immediately instead of waiting for the hourly cron. Sends any steps that are due (real emails).", inputSchema: O({}) },
  { name: "sequence_health", action: "sequence_health", description: "Check whether follow-ups are working: enrolments by status, steps due now, follow-ups sent in the last 30 days, and recent campaigns with follow-up off or no sequence. Start here when asked if sequences are working.", inputSchema: O({}) },
  { name: "list_sms_conversations", action: "list_sms_conversations", description: "Text message threads (people who replied to your SMS campaigns or texted your number): phone, name, last message, unread count, campaign it answers, opted_out. Filter with unread_only or campaign_id.", inputSchema: O({ unread_only: B(""), campaign_id: S(""), limit: I("") }) },
  { name: "get_sms_conversation", action: "get_sms_conversation", description: "Full text thread with one number, oldest first. Marks it read unless mark_read=false.", inputSchema: O({ phone: S(""), mark_read: B(""), limit: I("") }, ["phone"]) },
  { name: "reply_sms", action: "reply_sms", sends: true, description: "SEND a text reply from your Twilio number to one person (REAL SMS). Refuses numbers that replied STOP. message supports {name}.", inputSchema: O({ phone: S(""), message: S("") }, ["phone", "message"]) },
  { name: "list_sms_opt_outs", action: "list_sms_opt_outs", description: "Numbers that replied STOP. Every campaign and reply skips them automatically.", inputSchema: O({ limit: I("") }) },
  { name: "schedule_sms_followup", action: "schedule_sms_followup", description: "Schedule a follow-up TEXT to everyone who received an SMS campaign and has not replied or opted out, N days later (default 3) or at schedule_at. Cancel with unschedule_campaign. message supports {name} {first_name} {company}.", inputSchema: O({ campaign_id: S(""), message: S(""), days: N(""), schedule_at: scheduleAt, name: S("") }, ["campaign_id", "message"]) },
];

export const MCP_INSTRUCTIONS =
  "LeadBoosters is the user's CRM and outreach platform. Use these tools to look up and save contacts/companies, build recipient groups, " +
  "write and send on-brand email campaigns, SMS campaigns and newsletters, and run follow-up sequences. " +
  "Read get_business_profile before writing copy. Tools whose description says SEND NOW or REAL send real messages: confirm with the user first unless they clearly asked to send. " +
  "Times are UK time. Prefer saving work in LeadBoosters (groups, drafts, contacts) over pasting results back to the user.";
