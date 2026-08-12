import type { SupabaseClient } from "@supabase/supabase-js";
import { looksLikeMissingRecipientGroupColumn } from "@/lib/recipient-group-db";

const CHUNK = 400;

export type RecipientGroupMemberInput = {
  email?: string | null;
  phone?: string | null;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  person_id: string | null;
};

function errMessage(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error;
  const e = error as { message?: string; details?: string; hint?: string; code?: string };
  return `${e.message || ""} ${e.details || ""} ${e.hint || ""} ${e.code || ""}`;
}

/**
 * Creates a recipient group and inserts members in chunks (Supabase row limits).
 * Email groups omit `channel` so create works before the phone-groups migration.
 * Phone groups require the migration; members omit `phone` when null.
 */
export async function createRecipientGroupWithMembers(
  supabase: SupabaseClient,
  params: {
    userId: string;
    name: string;
    description: string | null;
    members: RecipientGroupMemberInput[];
    channel?: "email" | "phone" | "mixed";
  }
): Promise<{ groupId: string; count: number }> {
  const channel = params.channel || "email";
  const baseGroup: Record<string, unknown> = {
    user_id: params.userId,
    name: params.name.trim(),
    description: params.description?.trim() || null,
  };

  // Only send channel when non-default — avoids PostgREST "schema cache" errors
  // when 20260811170000_recipient_groups_phone.sql hasn't been applied yet.
  const preferChannel = channel === "phone" || channel === "mixed";
  if (preferChannel) baseGroup.channel = channel;

  let group: { id: string } | null = null;

  const first = await supabase.from("recipient_groups").insert(baseGroup as any).select("id").single();
  if (!first.error && first.data) {
    group = first.data as { id: string };
  } else {
    const msg = errMessage(first.error);
    const missingChannel =
      looksLikeMissingRecipientGroupColumn(first.error, "channel") ||
      /channel/i.test(msg) && /schema cache|could not find|column/i.test(msg);

    if (missingChannel && preferChannel) {
      throw new Error(
        "Phone recipient groups need a database update. Apply migration 20260811170000_recipient_groups_phone.sql, then try again."
      );
    }
    if (missingChannel && "channel" in baseGroup) {
      const { channel: _drop, ...withoutChannel } = baseGroup;
      const retry = await supabase.from("recipient_groups").insert(withoutChannel as any).select("id").single();
      if (retry.error || !retry.data) throw retry.error || new Error("Failed to create group");
      group = retry.data as { id: string };
    } else if (preferChannel) {
      // Column might exist but insert failed for another reason — try plain email insert only for email channel
      throw first.error || new Error("Failed to create group");
    } else {
      // Email path with no channel field still failed
      throw first.error || new Error("Failed to create group");
    }
  }

  if (!group) throw new Error("Failed to create group");

  const cleaned = params.members
    .map((m) => {
      const email = m.email?.trim().toLowerCase() || null;
      const phone = m.phone?.trim() || null;
      const row: Record<string, unknown> = {
        first_name: m.first_name,
        last_name: m.last_name,
        company: m.company,
        person_id: m.person_id,
        group_id: group!.id,
      };
      if (email) row.email = email;
      // Only include phone when present — avoids missing-column errors on email imports
      if (phone) row.phone = phone;
      // Email column may still be required NOT NULL on old schemas
      if (!email && phone) row.email = `phone:${phone.replace(/\D/g, "")}@placeholder.local`;
      return row;
    })
    .filter((m) => m.email || m.phone);

  for (let i = 0; i < cleaned.length; i += CHUNK) {
    const slice = cleaned.slice(i, i + CHUNK);
    const withPhone = await supabase.from("recipient_group_members").insert(slice as any);
    if (!withPhone.error) continue;

    const missingPhone =
      looksLikeMissingRecipientGroupColumn(withPhone.error, "phone") ||
      (/phone/i.test(errMessage(withPhone.error)) &&
        /schema cache|could not find|column/i.test(errMessage(withPhone.error)));

    if (missingPhone) {
      const emailOnly = slice
        .map((m) => {
          const { phone: _p, ...rest } = m;
          return rest;
        })
        .filter((m) => m.email && !String(m.email).startsWith("phone:"));
      if (emailOnly.length === 0) {
        throw new Error(
          "Phone-only members need a database update. Apply migration 20260811170000_recipient_groups_phone.sql."
        );
      }
      const retry = await supabase.from("recipient_group_members").insert(emailOnly as any);
      if (retry.error) throw retry.error;
      continue;
    }
    throw withPhone.error;
  }

  return { groupId: group.id, count: cleaned.length };
}
