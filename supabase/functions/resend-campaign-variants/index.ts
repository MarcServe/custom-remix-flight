import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function personalize(template: string, first_name: string, last_name: string): string {
  if (!template) return "";
  const fullName = `${(first_name || "").trim()} ${(last_name || "").trim()}`.trim();
  return template
    .replace(/\{\{firstName\}\}/gi, first_name || "")
    .replace(/\{\{lastName\}\}/gi, last_name || "")
    .replace(/\{\{fullName\}\}/gi, fullName || "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isServiceRole = authHeader.includes(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "invalid");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      isServiceRole ? (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "") : (Deno.env.get("SUPABASE_ANON_KEY") ?? ""),
      isServiceRole ? {} : { global: { headers: { Authorization: authHeader } } }
    );

    const body = await req.json().catch(() => ({}));
    const { campaignId, action } = body;
    if (!campaignId || action !== "swap") {
      return new Response(
        JSON.stringify({ error: "campaignId and action: 'swap' are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: campaign, error: campaignError } = await supabase
      .from("email_campaigns")
      .select("id, user_id, subject_template, body_html_template, body_text_template, ab_subject_b, ab_body_html_b, ab_body_text_b")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      return new Response(
        JSON.stringify({ error: "Campaign not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!isServiceRole) {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user || campaign.user_id !== user.id) {
        return new Response(
          JSON.stringify({ error: "Campaign not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const { data: recipients, error: recError } = await supabase
      .from("email_campaign_recipients")
      .select("id, person_id, ab_variant")
      .eq("campaign_id", campaignId)
      .in("status", ["sent", "opened", "clicked"])
      .in("ab_variant", ["A", "B"]);

    if (recError || !recipients?.length) {
      return new Response(
        JSON.stringify({
          success: true,
          updated: 0,
          message: "No sent recipients with A/B variant to swap",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const recipientIds = (recipients as { id: string }[]).map((r) => r.id);
    const { data: historyRows } = await supabase
      .from("email_campaign_send_history")
      .select("recipient_id, variant_sent")
      .eq("campaign_id", campaignId)
      .in("recipient_id", recipientIds);

    const receivedByRecipient = new Map<string, Set<string>>();
    for (const h of historyRows || []) {
      const rid = (h as { recipient_id: string; variant_sent: string }).recipient_id;
      const v = (h as { recipient_id: string; variant_sent: string }).variant_sent;
      if (!receivedByRecipient.has(rid)) receivedByRecipient.set(rid, new Set());
      receivedByRecipient.get(rid)!.add(v);
    }

    const variantToSend = (rec: { ab_variant: string }) => (rec.ab_variant === "A" ? "B" : "A");
    const alreadyReceived = (rec: { id: string; ab_variant: string }) =>
      receivedByRecipient.get(rec.id)?.has(variantToSend(rec)) ?? false;
    const toSwap = (recipients as { id: string; person_id: string | null; ab_variant: string }[]).filter(
      (rec) => !alreadyReceived(rec)
    );

    if (toSwap.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          updated: 0,
          message: "No recipients to swap: everyone has already received the other variant. No duplicate sends.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const personIds = [...new Set(toSwap.map((r) => r.person_id).filter(Boolean))] as string[];
    const { data: people, error: peopleError } = await supabase
      .from("people")
      .select("id, first_name, last_name")
      .in("id", personIds);

    if (peopleError) {
      return new Response(
        JSON.stringify({ error: "Failed to load people" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const peopleMap = new Map((people || []).map((p: { id: string; first_name?: string; last_name?: string }) => [p.id, p]));

    const subjA = campaign.subject_template || "";
    const htmlA = campaign.body_html_template || "";
    const textA = campaign.body_text_template || "";
    const subjB = campaign.ab_subject_b || "";
    const htmlB = campaign.ab_body_html_b || "";
    const textB = campaign.ab_body_text_b || "";

    let updated = 0;
    for (const rec of toSwap) {
      const person = rec.person_id ? peopleMap.get(rec.person_id) : null;
      const first = (person as { first_name?: string } | undefined)?.first_name ?? "";
      const last = (person as { last_name?: string } | undefined)?.last_name ?? "";

      if (rec.ab_variant === "A") {
        const personalizedSubject = personalize(subjB, first, last);
        const personalizedBodyHtml = htmlB ? personalize(htmlB, first, last) : "";
        const personalizedBodyText = personalize(textB, first, last);
        const { error: upErr } = await supabase
          .from("email_campaign_recipients")
          .update({
            personalized_subject: personalizedSubject,
            personalized_body_html: personalizedBodyHtml,
            personalized_body_text: personalizedBodyText,
            ab_variant: "B",
            status: "pending",
          })
          .eq("id", rec.id);
        if (!upErr) updated++;
      } else {
        const personalizedSubject = personalize(subjA, first, last);
        const personalizedBodyHtml = personalize(htmlA, first, last);
        const personalizedBodyText = personalize(textA, first, last);
        const { error: upErr } = await supabase
          .from("email_campaign_recipients")
          .update({
            personalized_subject: personalizedSubject,
            personalized_body_html: personalizedBodyHtml,
            personalized_body_text: personalizedBodyText,
            ab_variant: "A",
            status: "pending",
          })
          .eq("id", rec.id);
        if (!upErr) updated++;
      }
    }

    await supabase
      .from("email_campaigns")
      .update({ status: "sending" })
      .eq("id", campaignId);

    return new Response(
      JSON.stringify({ success: true, updated }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("resend-campaign-variants error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
