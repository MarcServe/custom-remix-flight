import type { SupabaseClient } from "@supabase/supabase-js";

function looksLikeMissingColumn(
  error: { message?: string; code?: string; details?: string; hint?: string } | null | undefined,
  column: string
): boolean {
  if (!error) return false;
  const blob = `${error.message || ""} ${error.details || ""} ${error.hint || ""} ${error.code || ""}`.toLowerCase();
  return (
    blob.includes(column.toLowerCase()) &&
    (blob.includes("column") || blob.includes("schema cache") || error.code === "PGRST204" || error.code === "42703")
  );
}

export type RecipientGroupRow = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  channel?: string | null;
  member_count?: number;
};

/**
 * Load recipient groups for the current user.
 * Retries without `channel` when the phone-groups migration hasn't been applied yet,
 * so existing email groups still appear.
 */
export async function fetchRecipientGroupsResilient(
  supabase: SupabaseClient,
  userId: string
): Promise<RecipientGroupRow[]> {
  const withChannel = await supabase
    .from("recipient_groups")
    .select("id, name, description, created_at, channel")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  let groupsData = withChannel.data as RecipientGroupRow[] | null;
  if (withChannel.error) {
    if (!looksLikeMissingColumn(withChannel.error, "channel")) {
      throw withChannel.error;
    }
    const fallback = await supabase
      .from("recipient_groups")
      .select("id, name, description, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (fallback.error) throw fallback.error;
    groupsData = (fallback.data || []).map((g) => ({ ...g, channel: "email" }));
  }

  if (!groupsData?.length) return [];

  const ids = groupsData.map((g) => g.id);
  const { data: countsData } = await supabase
    .from("recipient_group_members")
    .select("group_id")
    .in("group_id", ids);

  const countByGroup: Record<string, number> = {};
  ids.forEach((id) => (countByGroup[id] = 0));
  (countsData || []).forEach((r: { group_id: string }) => {
    countByGroup[r.group_id] = (countByGroup[r.group_id] || 0) + 1;
  });

  return groupsData.map((g) => ({
    ...g,
    channel: g.channel || "email",
    member_count: countByGroup[g.id] ?? 0,
  }));
}

/**
 * Load group members; retries without `phone` if that column is missing.
 */
export async function fetchRecipientGroupMembersResilient(
  supabase: SupabaseClient,
  groupId: string
): Promise<
  Array<{
    id: string;
    email: string | null;
    phone: string | null;
    first_name: string | null;
    last_name: string | null;
    company: string | null;
  }>
> {
  const withPhone = await supabase
    .from("recipient_group_members")
    .select("id, email, phone, first_name, last_name, company")
    .eq("group_id", groupId)
    .order("created_at", { ascending: true });

  if (!withPhone.error) {
    return (withPhone.data || []).map((m: any) => ({
      id: m.id,
      email: m.email ?? null,
      phone: m.phone ?? null,
      first_name: m.first_name ?? null,
      last_name: m.last_name ?? null,
      company: m.company ?? null,
    }));
  }

  if (!looksLikeMissingColumn(withPhone.error, "phone")) {
    throw withPhone.error;
  }

  const fallback = await supabase
    .from("recipient_group_members")
    .select("id, email, first_name, last_name, company")
    .eq("group_id", groupId)
    .order("created_at", { ascending: true });
  if (fallback.error) throw fallback.error;
  return (fallback.data || []).map((m: any) => ({
    id: m.id,
    email: m.email ?? null,
    phone: null,
    first_name: m.first_name ?? null,
    last_name: m.last_name ?? null,
    company: m.company ?? null,
  }));
}

export { looksLikeMissingColumn as looksLikeMissingRecipientGroupColumn };
