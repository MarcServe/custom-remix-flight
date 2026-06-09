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

/**
 * Pre-emptive Gmail OAuth token refresh.
 *
 * Returns a valid access token for the given gmail/gmail_direct crm_connections row.
 * Refreshes when the stored token is missing OR within `bufferSeconds` of expiry
 * (default 5 minutes) so an in-flight send never races the expiry.
 *
 * `connection` must include `id` and `metadata` (with `access_token`, `expires_at`).
 * `supabaseClient` is any Supabase client able to invoke the `gmail-oauth-refresh`
 * edge function (anon client for user-triggered sends, service-role client for
 * background/cron jobs).
 */
export async function getValidGmailAccessToken(
  supabaseClient: any,
  connection: { id: string; metadata: any },
  opts: { bufferSeconds?: number; force?: boolean } = {},
): Promise<string> {
  const bufferSeconds = opts.bufferSeconds ?? 300;
  const metadata = (connection?.metadata as any) || {};
  const currentToken: string | undefined = metadata.access_token;
  const expiresAt: string | undefined = metadata.expires_at;

  const expiresSoon = (() => {
    if (opts.force) return true;
    if (!currentToken) return true;
    if (!expiresAt) return false; // no expiry recorded — trust current token
    const expiryMs = new Date(expiresAt).getTime();
    if (Number.isNaN(expiryMs)) return false;
    return expiryMs - Date.now() <= bufferSeconds * 1000;
  })();

  if (!expiresSoon && currentToken) {
    return currentToken;
  }

  console.log(
    `[gmail-utils] Refreshing Gmail token for connection ${connection.id}`,
    { reason: opts.force ? 'forced' : (!currentToken ? 'missing' : 'within-buffer'), expiresAt },
  );

  const refreshResponse = await supabaseClient.functions.invoke('gmail-oauth-refresh', {
    body: { connection_id: connection.id },
  });

  const refreshed = refreshResponse?.data?.access_token;
  if (refreshResponse?.error || !refreshed) {
    throw new Error('Failed to refresh Gmail token. Please reconnect your Gmail account.');
  }

  // Keep caller's connection object in sync so subsequent reads see new values.
  try {
    connection.metadata = {
      ...metadata,
      access_token: refreshed,
      expires_at: refreshResponse.data.expires_at ?? metadata.expires_at,
    };
  } catch { /* ignore if frozen */ }

  return refreshed;
}

/**
 * Send a raw (RFC 2822, base64url) Gmail message with automatic pre-emptive
 * token refresh and a single 401 retry (in case the access token was revoked
 * server-side between refresh and send).
 *
 * Returns the parsed Gmail API response (`{ id, threadId, ... }`).
 */
export async function sendGmailMessage(
  supabaseClient: any,
  connection: { id: string; metadata: any },
  rawBase64Url: string,
): Promise<any> {
  const doSend = async (token: string) => fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: rawBase64Url }),
    },
  );

  let token = await getValidGmailAccessToken(supabaseClient, connection);
  let res = await doSend(token);

  if (res.status === 401) {
    console.warn('[gmail-utils] Gmail returned 401 — forcing token refresh and retrying once');
    token = await getValidGmailAccessToken(supabaseClient, connection, { force: true });
    res = await doSend(token);
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gmail send failed (${res.status}): ${errText}`);
  }

  return await res.json();
}
