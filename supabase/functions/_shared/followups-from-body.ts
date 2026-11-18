// Campaign follow-ups are always written from the campaign's own email (same product, offer and
// links), on day 1, 3 and 5, stopping when the recipient replies. Generated once per campaign;
// a sequence already written from this campaign is reused.
import { ensureNoReplySequence } from "./followup.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const plain = (html: string) => String(html || "")
  .replace(/<\s*br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

export async function followUpSequenceFromBody(db: any, campaign: any): Promise<string | null> {
  // Already written from this campaign?
  if (campaign.follow_up_sequence_id) {
    const { data: seq } = await db.from("email_sequences").select("id, segment_filters").eq("id", campaign.follow_up_sequence_id).maybeSingle();
    const f = (seq?.segment_filters || {}) as any;
    // Written from this campaign, or previewed from its email in the campaign editor
    if (seq && (f.from_campaign === campaign.id || f.from_email === true)) return seq.id;
  }
  const { data: c } = await db.from("email_campaigns").select("id, user_id, name, subject_template, body_text_template, body_html_template").eq("id", campaign.id).maybeSingle();
  const body = (String(c?.body_text_template || "").trim() || plain(c?.body_html_template || "")).slice(0, 6000);
  let id: string | null = null;
  if (body.length >= 40) {
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/generate-sequence`, {
        method: "POST",
        headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ followUpOf: { subject: c?.subject_template || "", body, campaignName: c?.name || "" }, tone: "friendly, professional" }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j?.sequenceId) {
        id = j.sequenceId;
        await db.from("email_sequences").update({ created_by: c?.user_id ?? campaign.user_id, segment_filters: { from_campaign: campaign.id, from_email: true } }).eq("id", id);
      } else {
        console.error("[followups-from-body] generation failed:", j?.error || r.status);
      }
    } catch (e) {
      console.error("[followups-from-body] generation error:", e);
    }
  }
  // Never drop follow-ups: fall back to the standard Day 1 / 3 / 5 no-reply follow-up.
  if (!id) id = await ensureNoReplySequence(db, campaign.user_id).catch(() => null);
  if (id) await db.from("email_campaigns").update({ follow_up_sequence_id: id }).eq("id", campaign.id);
  return id;
}
