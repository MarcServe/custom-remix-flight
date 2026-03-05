import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: "Missing Authorization header" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
  const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(jwt);
  if (userError || !user) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data: newsletters, error: fetchError } = await supabase
    .from("newsletters")
    .select("id, title")
    .eq("user_id", user.id)
    .eq("status", "sending")
    .eq("batch_send", true);

  if (fetchError) {
    return new Response(
      JSON.stringify({ error: fetchError.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  if (!newsletters?.length) {
    return new Response(
      JSON.stringify({ success: true, message: "No batch newsletters in progress", results: [] }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const results: { newsletterId: string; title: string; result: unknown }[] = [];
  for (const nl of newsletters) {
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/send-newsletter`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          newsletterId: nl.id,
          triggeredByCron: true,
          continueBatch: true,
          batchSize: 50,
        }),
      });
      const result = await response.json().catch(() => ({}));
      results.push({ newsletterId: nl.id, title: nl.title ?? "", result });
    } catch (err) {
      results.push({
        newsletterId: nl.id,
        title: nl.title ?? "",
        result: { error: err instanceof Error ? err.message : "Unknown error" },
      });
    }
  }

  return new Response(
    JSON.stringify({ success: true, results }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
