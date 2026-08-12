import type { SupabaseClient } from "@supabase/supabase-js";

export function looksLikeMissingRecipientGroupColumn(
  error: { message?: string; code?: string; details?: string; hint?: string } | null | undefined,
  column: string
): boolean {
  if (!error) return false;
  const blob = `${error.message || ""} ${error.details || ""} ${error.hint || ""} ${error.code || ""}`.toLowerCase();
  const col = column.toLowerCase();
  // PostgREST: "Could not find the 'channel' column of 'recipient_groups' in the schema cache"
  if (blob.includes(col) && (blob.includes("schema cache") || blob.includes("could not find"))) return true;
  if (blob.includes(col) && blob.includes("column")) return true;
  if (error.code === "PGRST204" || error.code === "42703") return blob.includes(col) || blob.includes("schema cache");
  return false;
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
 * Exact member counts per group.
 * Avoids Supabase's default 1000-row select cap (large CSV groups were showing as 0)
 * and does not swallow count errors.
 */
export async function fetchRecipientGroupMemberCounts(
  supabase: SupabaseClient,
  groupIds: string[]
): Promise<Record<string, number>> {
  const countByGroup: Record<string, number> = {};
  for (const id of groupIds) countByGroup[id] = 0;
  if (groupIds.length === 0) return countByGroup;

  const results = await Promise.all(
    groupIds.map(async (id) => {
      const { count, error } = await supabase
        .from("recipient_group_members")
        .select("id", { count: "exact", head: true })
        .eq("group_id", id);
      if (error) return { id, count: null as number | null, error };
      return { id, count: count ?? 0, error: null };
    })
  );

  const failed = results.filter((r) => r.count == null);
  if (failed.length < results.length) {
    for (const r of results) {
      if (r.count != null) countByGroup[r.id] = r.count;
    }
    return countByGroup;
  }

  // Fallback: paginated row fetch (still correct past the 1000-row default)
  const PAGE = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("recipient_group_members")
      .select("group_id")
      .in("group_id", groupIds)
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = data || [];
    for (const row of rows as { group_id: string }[]) {
      if (row.group_id in countByGroup) {
        countByGroup[row.group_id] += 1;
      }
    }
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return countByGroup;
}

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
    if (!looksLikeMissingRecipientGroupColumn(withChannel.error, "channel")) {
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
  const countByGroup = await fetchRecipientGroupMemberCounts(supabase, ids);

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
  type MemberRow = {
    id: string;
    email: string | null;
    phone: string | null;
    first_name: string | null;
    last_name: string | null;
    company: string | null;
  };

  const mapRow = (m: any, phoneFallback: string | null = null): MemberRow => ({
    id: m.id,
    email: m.email ?? null,
    phone: m.phone ?? phoneFallback,
    first_name: m.first_name ?? null,
    last_name: m.last_name ?? null,
    company: m.company ?? null,
  });

  const PAGE = 1000;
  const fetchAll = async (includePhone: boolean): Promise<MemberRow[]> => {
    const all: MemberRow[] = [];
    let from = 0;
    const cols = includePhone
      ? "id, email, phone, first_name, last_name, company"
      : "id, email, first_name, last_name, company";
    for (;;) {
      const { data, error } = await supabase
        .from("recipient_group_members")
        .select(cols)
        .eq("group_id", groupId)
        .order("created_at", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw error;
      const rows = data || [];
      for (const m of rows as any[]) {
        all.push(mapRow(m));
      }
      if (rows.length < PAGE) break;
      from += PAGE;
    }
    return all;
  };

  try {
    return await fetchAll(true);
  } catch (error: any) {
    if (!looksLikeMissingRecipientGroupColumn(error, "phone")) throw error;
    return await fetchAll(false);
  }
}
