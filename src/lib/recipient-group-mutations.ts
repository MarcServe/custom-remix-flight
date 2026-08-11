import type { SupabaseClient } from "@supabase/supabase-js";

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
  const { data: group, error } = await supabase
    .from("recipient_groups")
    .insert({
      user_id: params.userId,
      name: params.name.trim(),
      description: params.description?.trim() || null,
      channel: params.channel || "email",
    } as any)
    .select("id")
    .single();
  if (error || !group) throw error || new Error("Failed to create group");

  const cleaned = params.members
    .map((m) => ({
      email: m.email?.trim().toLowerCase() || null,
      phone: m.phone?.trim() || null,
      first_name: m.first_name,
      last_name: m.last_name,
      company: m.company,
      person_id: m.person_id,
      group_id: group.id,
    }))
    .filter((m) => m.email || m.phone);

  for (let i = 0; i < cleaned.length; i += CHUNK) {
    const slice = cleaned.slice(i, i + CHUNK);
    const { error: insErr } = await supabase.from("recipient_group_members").insert(slice as any);
    if (insErr) throw insErr;
  }

  return { groupId: group.id, count: cleaned.length };
}
