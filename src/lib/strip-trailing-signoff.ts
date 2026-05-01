/**
 * Same logic as supabase/functions/_shared/strip-trailing-signoff.ts (campaign send path).
 * Used when loading drafts so preview matches what send stripping would do — without
 * greedy regexes that cut the body at the first "Best regards," in the message.
 */
export function stripTrailingDuplicateSignoffHtml(
  html: string,
  windowChars = 4500,
): string {
  if (!html) return html;
  const n = html.length;
  const zoneStart = Math.max(0, n - windowChars);
  const lower = html.toLowerCase();

  const needles = [
    "<br><br><p>best regards,",
    "<br><br>best regards,",
    "<p>best regards,",
    "<p>kind regards,",
    "<p>sincerely,",
    '<div class="signature"',
    '<div class="email-signature"',
  ];

  let cut = n;
  for (const needle of needles) {
    const idx = lower.lastIndexOf(needle);
    if (idx >= zoneStart && idx < cut) cut = idx;
  }

  if (cut === n) {
    const idx = lower.lastIndexOf("best regards,");
    if (idx >= zoneStart && idx < cut) cut = idx;
  }

  if (cut < n) return html.slice(0, cut).trimEnd();
  return html;
}

export function stripTrailingDuplicateSignoffPlain(
  text: string,
  windowChars = 4500,
): string {
  if (!text) return text;
  const n = text.length;
  const zoneStart = Math.max(0, n - windowChars);
  const lower = text.toLowerCase();

  const needles = [
    "\n\nbest regards,",
    "\n\nkind regards,",
    "\n\nsincerely,",
    "\n\nregards,",
  ];

  let cut = n;
  for (const needle of needles) {
    const idx = lower.lastIndexOf(needle);
    if (idx >= zoneStart && idx < cut) cut = idx;
  }

  if (cut === n) {
    const idx = lower.lastIndexOf("best regards,");
    if (idx >= zoneStart && idx < cut) cut = idx;
  }

  if (cut < n) return text.slice(0, cut).trimEnd();
  return text;
}
