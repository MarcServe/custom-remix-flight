/**
 * Encode a header value for MIME (RFC 2047) so non-ASCII characters display correctly in Gmail and other clients.
 * Use for Subject and for display names in From/To when they contain non-ASCII (e.g. smart quotes, accents).
 */
export function encodeRfc2047(value: string): string {
  if (!value || typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  // ASCII-only (excluding control chars) can be used as-is
  if (/^[\x20-\x7E]*$/.test(trimmed)) return trimmed;
  const utf8Bytes = new TextEncoder().encode(trimmed);
  const binary = Array.from(utf8Bytes).map((b) => String.fromCharCode(b)).join('');
  const b64 = btoa(binary);
  return `=?UTF-8?B?${b64}?=`;
}
