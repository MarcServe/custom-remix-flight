/**
 * Runs a Supabase query once per slice of ids and concatenates the rows.
 * PostgREST sends `.in()` filters in the URL, so a list of thousands of ids
 * overflows it; 150 uuids per request stays well under the limit.
 */
export async function selectInChunks<T = any>(
  ids: string[],
  run: (slice: string[]) => PromiseLike<{ data: T[] | null; error: any }>,
  size = 150,
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += size) {
    const { data, error } = await run(ids.slice(i, i + size));
    if (error) throw error;
    if (data) out.push(...data);
  }
  return out;
}
