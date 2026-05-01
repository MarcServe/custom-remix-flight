/**
 * Remove a duplicate sign-off / signature block from the end of HTML so
 * renderEmailTemplate can add branding without doubling closings.
 *
 * Only considers matches in the last `windowChars` characters so a mention of
 * "Best regards" in the main message does not truncate the body.
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
