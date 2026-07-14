import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authErr } = await anon.auth.getUser();
    if (authErr || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { action, name, id } = await req.json().catch(() => ({}));

    if (action === "create") {
      // Generate a random key: lb_live_<40 hex>
      const rand = crypto.getRandomValues(new Uint8Array(20));
      const secret = [...rand].map((b) => b.toString(16).padStart(2, "0")).join("");
      const key = `lb_live_${secret}`;
      const prefix = key.slice(0, 16); // lb_live_ + 8 chars, safe to display
      const keyHash = await sha256Hex(key);
      const { data, error } = await db.from("api_keys").insert({
        user_id: user.id,
        name: (name && String(name).trim()) || "API key",
        key_prefix: prefix,
        key_hash: keyHash,
      }).select("id, name, key_prefix, created_at").single();
      if (error) throw new Error(error.message);
      // Return the full key ONCE — it is never retrievable again.
      return new Response(JSON.stringify({ ...data, key }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "list") {
      const { data, error } = await db.from("api_keys")
        .select("id, name, key_prefix, last_used_at, revoked_at, created_at")
        .eq("user_id", user.id).order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return new Response(JSON.stringify({ keys: data || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "revoke") {
      if (!id) throw new Error("id required");
      const { error } = await db.from("api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id);
      if (error) throw new Error(error.message);
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
