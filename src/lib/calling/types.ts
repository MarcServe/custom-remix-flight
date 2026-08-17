export const CALLING_PRODUCTS = ["TalkStay", "TalkWeb", "GrantsCopilot", "other"] as const;
export type CallingProduct = (typeof CALLING_PRODUCTS)[number];

export const CALLING_STATUSES = ["draft", "ready", "active", "paused", "completed"] as const;
export type CallingCampaignStatus = (typeof CALLING_STATUSES)[number];

export const QUEUE_STATUSES = ["pending", "blocked", "calling", "completed", "skipped"] as const;
export type QueueStatus = (typeof QUEUE_STATUSES)[number];

export const CALL_OUTCOMES = [
  "interested",
  "send_demo",
  "call_back",
  "not_right_person",
  "not_interested",
  "no_answer",
  "invalid_number",
  "do_not_call",
] as const;
export type CallOutcome = (typeof CALL_OUTCOMES)[number];

export const OUTCOME_LABELS: Record<CallOutcome, string> = {
  interested: "Interested",
  send_demo: "Send demo",
  call_back: "Call back",
  not_right_person: "Not the right person",
  not_interested: "Not interested",
  no_answer: "No answer",
  invalid_number: "Invalid number",
  do_not_call: "Do not call",
};

export const SCREENING_STATUSES = ["unknown", "clear", "listed", "pending"] as const;
export type ScreeningStatus = (typeof SCREENING_STATUSES)[number];

export interface CallingCampaign {
  id: string;
  user_id: string;
  name: string;
  product: CallingProduct;
  status: CallingCampaignStatus;
  script: string | null;
  sms_template: string | null;
  email_followup_subject: string | null;
  email_followup_body: string | null;
  connection_id: string | null;
  caller_phone: string | null;
  assigned_caller: string | null;
  notes: string | null;
  max_queue_size: number;
  started_at: string | null;
  paused_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CallingQueueItem {
  id: string;
  campaign_id: string;
  user_id: string;
  company_id: string | null;
  person_id: string | null;
  contact_name: string | null;
  company_name: string | null;
  phone: string;
  email: string | null;
  queue_position: number;
  status: QueueStatus;
  outcome: CallOutcome | null;
  tps_status: ScreeningStatus;
  ctps_status: ScreeningStatus;
  sms_consent: boolean;
  follow_up_at: string | null;
  notes: string | null;
  last_called_at: string | null;
  created_at: string;
  updated_at: string;
}

export const DEFAULT_SCRIPTS: Record<CallingProduct, string> = {
  TalkStay: `Hi, is this {{company}}?

My name is {{caller}} calling from LeadBoosters about TalkStay — a guest-messaging tool that helps hotels reply faster and convert more direct bookings.

Have you got 30 seconds?

If yes: We set this up for similar properties so the front desk isn't buried in WhatsApp and booking.com messages. Would a short demo this week be useful?

If no: No problem — when is a better time to call back?`,
  TalkWeb: `Hi, is this {{company}}?

It's {{caller}} from LeadBoosters. We help hospitality businesses with TalkWeb — websites and booking pages that actually convert.

Quick question: are you happy with how your site turns browsers into bookings, or is that something you're reviewing?

If interested: I can send a short walkthrough. What's the best email?

If not: Thanks for your time — I'll note not to call again unless you ask.`,
  GrantsCopilot: `Hi, is this {{company}}?

It's {{caller}} from LeadBoosters. We built GrantsCopilot to help businesses find and apply for relevant UK grants without the usual paperwork slog.

Are you currently looking at any funding, or would a 10-minute overview be useful?

If yes: I'll send a one-pager and book a slot.

If no: Understood — I'll mark you as not interested.`,
  other: `Hi, is this {{company}}?

It's {{caller}}. I'm calling about {{product}}.

Have you got a moment to see if this is relevant?`,
};

export function fillScript(tpl: string, vars: Record<string, string>): string {
  return (tpl || "").replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => vars[key] || "");
}
