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

/**
 * Creates a recipient group and inserts members in chunks (Supabase row limits).
 * Members may be email-only, phone-only, or both.
 * Retries without channel/phone columns when those migrations aren't applied yet.
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
  const baseGroup = {
    user_id: params.userId,
    name: params.name.trim(),
    description: params.description?.trim() || null,
  };

  let group: { id: string } | null = null;
  const withChannel = await supabase
    .from("recipient_groups")
    .insert({ ...baseGroup, channel: params.channel || "email" } as any)
    .select("id")
    .single();

  if (!withChannel.error && withChannel.data) {
    group = withChannel.data as { id: string };
  } else if (withChannel.error && looksLikeMissingRecipientGroupColumn(withChannel.error, "channel")) {
    if (params.channel === "phone") {
      throw new Error(
        "Phone recipient groups need a database update (channel/phone columns). Apply migration 20260811170000_recipient_groups_phone.sql, then try again."
      );
    }
    const fallback = await supabase.from("recipient_groups").insert(baseGroup as any).select("id").single();
    if (fallback.error || !fallback.data) throw fallback.error || new Error("Failed to create group");
    group = fallback.data as { id: string };
  } else {
    throw withChannel.error || new Error("Failed to create group");
  }

  const cleaned = params.members
    .map((m) => ({
      email: m.email?.trim().toLowerCase() || null,
      phone: m.phone?.trim() || null,
      first_name: m.first_name,
      last_name: m.last_name,
      company: m.company,
      person_id: m.person_id,
      group_id: group!.id,
    }))
    .filter((m) => m.email || m.phone);

  for (let i = 0; i < cleaned.length; i += CHUNK) {
    const slice = cleaned.slice(i, i + CHUNK);
    const withPhone = await supabase.from("recipient_group_members").insert(slice as any);
    if (!withPhone.error) continue;

    if (looksLikeMissingRecipientGroupColumn(withPhone.error, "phone")) {
      const emailOnly = slice
        .filter((m) => m.email)
        .map(({ phone: _p, ...rest }) => rest);
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
