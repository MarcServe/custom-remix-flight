import type { SupabaseClient } from "@supabase/supabase-js";

/** Columns that exist before the merge_vars migration. */
export const EMAIL_CAMPAIGN_EDIT_SELECT =
  "id, name, created_at, updated_at, total_recipients, subject_template, body_html_template, body_text_template, sender_connection_id, sender_profile_id, scheduled_at, tags, auto_follow_up_enabled, follow_up_sequence_id, status, ab_test_enabled, ab_subject_b, ab_body_html_b, ab_body_text_b, ab_traffic_split, ab_winner_metric, header_image_url";

export const EMAIL_CAMPAIGN_DRAFT_LIST_SELECT =
  "id, name, created_at, updated_at, total_recipients, subject_template, body_html_template, body_text_template, sender_connection_id, sender_profile_id, scheduled_at, tags, auto_follow_up_enabled, follow_up_sequence_id, ab_test_enabled, ab_subject_b, ab_body_html_b, ab_body_text_b, ab_traffic_split, ab_winner_metric, header_image_url";

function looksLikeMissingColumn(error: { message?: string; code?: string; details?: string } | null | undefined, column: string): boolean {
  if (!error) return false;
  const blob = `${error.message || ""} ${error.details || ""} ${error.code || ""}`.toLowerCase();
  return blob.includes(column.toLowerCase()) && (blob.includes("column") || blob.includes("schema cache") || error.code === "PGRST204");
}

/** Soft-load merge_vars when the column exists; ignore if migration not applied yet. */
export async function fetchCampaignMergeVars(
  supabase: SupabaseClient,
  campaignId: string
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from("email_campaigns")
    .select("merge_vars")
    .eq("id", campaignId)
    .maybeSingle();
  if (error) {
    if (looksLikeMissingColumn(error, "merge_vars")) return null;
    console.warn("merge_vars fetch:", error.message);
    return null;
  }
  const mv = (data as { merge_vars?: unknown } | null)?.merge_vars;
  return mv && typeof mv === "object" ? (mv as Record<string, unknown>) : null;
}

/**
 * Update/insert campaign payload. If merge_vars column is missing, retry without it
 * so edits still save before the migration is applied.
 */
export async function updateEmailCampaignResilient(
  supabase: SupabaseClient,
  campaignId: string,
  payload: Record<string, unknown>,
  opts?: { select?: boolean }
): Promise<{ data: any | null; error: Error | null }> {
  const run = async (body: Record<string, unknown>) => {
    let q = supabase.from("email_campaigns").update(body as any).eq("id", campaignId);
    if (opts?.select) return q.select().single();
    return q;
  };
  const first = await run(payload);
  if (!first.error) return { data: (first as any).data ?? null, error: null };
  if (looksLikeMissingColumn(first.error, "merge_vars") && "merge_vars" in payload) {
    const { merge_vars: _drop, ...rest } = payload;
    const retry = await run(rest);
    if (!retry.error) return { data: (retry as any).data ?? null, error: null };
    return { data: null, error: new Error(retry.error.message) };
  }
  return { data: null, error: new Error(first.error.message) };
}

export async function insertEmailCampaignResilient(
  supabase: SupabaseClient,
  payload: Record<string, unknown>
): Promise<{ data: any | null; error: Error | null }> {
  const { data, error } = await supabase.from("email_campaigns").insert(payload as any).select().single();
  if (!error && data) return { data, error: null };
  if (error && looksLikeMissingColumn(error, "merge_vars") && "merge_vars" in payload) {
    const { merge_vars: _drop, ...rest } = payload;
    const retry = await supabase.from("email_campaigns").insert(rest as any).select().single();
    if (!retry.error && retry.data) return { data: retry.data, error: null };
    return { data: null, error: new Error(retry.error?.message || error.message) };
  }
  return { data: null, error: new Error(error?.message || "Insert failed") };
}

export function demoLinkFromMergeVars(mv: Record<string, unknown> | null | undefined): string {
  if (!mv) return "";
  if (typeof mv.demoLink === "string") return mv.demoLink;
  if (typeof mv.demo_link === "string") return mv.demo_link;
  return "";
}
