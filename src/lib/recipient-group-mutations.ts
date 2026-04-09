import type { SupabaseClient } from "@supabase/supabase-js";

const CHUNK = 400;

export type RecipientGroupMemberInput = {
  email: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  person_id: string | null;
};

/**
 * Creates a recipient group and inserts members in chunks (Supabase row limits).
 */
export async function createRecipientGroupWithMembers(
  supabase: SupabaseClient,
  params: {
    userId: string;
    name: string;
    description: string | null;
    members: RecipientGroupMemberInput[];
  }
): Promise<{ groupId: string; count: number }> {
  const { data: group, error } = await supabase
    .from("recipient_groups")
    .insert({
      user_id: params.userId,
      name: params.name.trim(),
      description: params.description?.trim() || null,
    })
    .select("id")
    .single();
  if (error || !group) throw error || new Error("Failed to create group");

  for (let i = 0; i < params.members.length; i += CHUNK) {
    const slice = params.members.slice(i, i + CHUNK).map((m) => ({
      ...m,
      group_id: group.id,
    }));
    const { error: insErr } = await supabase.from("recipient_group_members").insert(slice);
    if (insErr) throw insErr;
  }

  return { groupId: group.id, count: params.members.length };
}
