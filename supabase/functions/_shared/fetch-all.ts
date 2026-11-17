// PostgREST returns at most 1,000 rows per request (and ignores larger .limit()s),
// so page with .range() until a short page comes back.
export async function fetchAllRows<T = any>(
  build: () => { range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }> },
  pageSize = 1000,
  max = 200_000,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < max; from += pageSize) {
    const { data, error } = await build().range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = data || [];
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return out;
}
