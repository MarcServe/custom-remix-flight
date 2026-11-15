// Caller checks for edge functions deployed with verify_jwt=false.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SERVICE_KEY = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";

export function isServiceRoleCall(req: Request): boolean {
  const auth = req.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  return !!SERVICE_KEY && token === SERVICE_KEY;
}

/** Returns the signed-in user's id, "service" for the service role, or null. */
export async function callerIdentity(req: Request): Promise<{ kind: "service" } | { kind: "user"; userId: string } | null> {
  if (isServiceRoleCall(req)) return { kind: "service" };
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  try {
    const client = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await client.auth.getUser();
    return user ? { kind: "user", userId: user.id } : null;
  } catch { return null; }
}

export const unauthorized = (msg = "Unauthorized", headers: Record<string, string> = {}) =>
  new Response(JSON.stringify({ success: false, error: msg }), { status: 401, headers: { ...headers, "Content-Type": "application/json" } });

/** Standard Webhooks / Svix signature (Resend). Returns true when valid, false when invalid. */
export async function verifySvix(secret: string, rawBody: string, headers: Headers, toleranceSec = 300): Promise<boolean> {
  const id = headers.get("svix-id") || headers.get("webhook-id");
  const ts = headers.get("svix-timestamp") || headers.get("webhook-timestamp");
  const sigHeader = headers.get("svix-signature") || headers.get("webhook-signature");
  if (!id || !ts || !sigHeader) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > toleranceSec) return false;
  const keyB64 = secret.replace(/^whsec_/, "");
  const keyBytes = Uint8Array.from(atob(keyB64), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${ts}.${rawBody}`));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  return sigHeader.split(" ").some((part) => { const [, v] = part.split(","); return v === expected; });
}

/** Nango: X-Nango-Signature = sha256(secretKey + rawBody) hex. */
export async function verifyNango(secret: string, rawBody: string, headers: Headers): Promise<boolean> {
  const given = (headers.get("x-nango-signature") || "").trim().toLowerCase();
  if (!given) return false;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret + rawBody));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex === given;
}
