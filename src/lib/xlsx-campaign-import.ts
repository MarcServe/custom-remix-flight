/** First worksheet → string rows (for detectColumnMap + parseCampaignCsvRows). Loads xlsx on demand. */
export async function parseCampaignXlsxToRows(buffer: ArrayBuffer): Promise<string[][]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buffer, { type: "array", cellDates: false });
  const name = wb.SheetNames[0];
  if (!name) return [];
  const sheet = wb.Sheets[name];
  const raw = XLSX.utils.sheet_to_json<(string | number | boolean | null | undefined)[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });
  return raw
    .map((row) =>
      (Array.isArray(row) ? row : []).map((cell) => (cell == null ? "" : String(cell).trim())),
    )
    .filter((r) => r.some((c) => c !== ""));
}
