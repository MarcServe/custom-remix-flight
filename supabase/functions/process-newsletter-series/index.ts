import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getTodayAndTimeInTimezone(tz: string): { dateStr: string; timeStr: string } {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-CA", { timeZone: tz }); // YYYY-MM-DD
  const timeStr = now.toLocaleTimeString("en-GB", {
    timeZone: tz,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: undefined,
  });
  return { dateStr, timeStr };
}

function parseSendTime(sendTime: string): { hour: number; minute: number } {
  const match = String(sendTime || "09:00").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return { hour: 9, minute: 0 };
  return { hour: parseInt(match[1], 10), minute: parseInt(match[2], 10) };
}

function isTimeAtOrAfter(current: string, sendTime: string): boolean {
  const [ch, cm] = current.split(":").map((n) => parseInt(n, 10));
  const { hour: sh, minute: sm } = parseSendTime(sendTime);
  if (ch > sh) return true;
  if (ch < sh) return false;
  return cm >= sm;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const authHeader = req.headers.get("Authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (authHeader !== `Bearer ${supabaseServiceKey}`) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get current date and time in Europe/London (default; series can override)
    const defaultTz = "Europe/London";
    const { dateStr: todayDefault, timeStr: currentTimeDefault } = getTodayAndTimeInTimezone(defaultTz);

    // Fetch active series where start_date <= today <= start_date + duration_days
    const { data: allActive, error: fetchError } = await supabase
      .from("newsletter_series")
      .select("*")
      .eq("status", "active");

    if (fetchError) {
      console.error("[process-newsletter-series] Fetch series error:", fetchError);
      return new Response(
        JSON.stringify({ success: false, error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: { seriesId: string; name: string; action: string; error?: string }[] = [];
    const tz = defaultTz;
    const { dateStr: today, timeStr: currentTime } = getTodayAndTimeInTimezone(tz);

    for (const series of allActive || []) {
      const seriesTz = series.timezone || defaultTz;
      const { dateStr: seriesToday } = getTodayAndTimeInTimezone(seriesTz);
      const { timeStr: seriesCurrentTime } = getTodayAndTimeInTimezone(seriesTz);

      const start = new Date(series.start_date);
      const end = new Date(start);
      end.setDate(end.getDate() + series.duration_days);
      const todayDate = new Date(seriesToday);
      if (todayDate < start || todayDate > end) {
        if (todayDate > end) {
          await supabase
            .from("newsletter_series")
            .update({ status: "completed", updated_at: new Date().toISOString() })
            .eq("id", series.id);
        }
        continue;
      }

      const { data: existing } = await supabase
        .from("newsletter_series_editions")
        .select("id")
        .eq("series_id", series.id)
        .eq("edition_date", seriesToday)
        .maybeSingle();

      if (existing) continue;

      if (!isTimeAtOrAfter(seriesCurrentTime, series.send_time)) continue;

      try {
        const dayNum = Math.floor((todayDate.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
        const total = series.duration_days;
        const topicTemplate = series.ai_topic_template || "Daily newsletter content for our subscribers.";
        const promptText = topicTemplate
          .replace(/\{day\}/g, String(dayNum))
          .replace(/\{total\}/g, String(total));
        const companyName = ""; // will be filled by generate-email-with-ai from business profile
        const prompt = `Write a marketing newsletter email about: ${promptText}
Day ${dayNum} of ${total} in this series.
Target audience: ${series.ai_target_audience || "subscribers"}.
Tone: ${series.ai_tone || "professional"}.
Company: ${companyName || "our company"}.

The newsletter should:
- Have an engaging opening
- Include 2-3 key points or tips
- Be 200-400 words
- Use HTML with <p>, <h3>, <strong>, <ul>/<li>
- Do NOT include subject line or signature

Return ONLY the HTML body content.`;

        const genRes = await fetch(`${supabaseUrl}/functions/v1/generate-email-with-ai`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${supabaseServiceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            context: "newsletter",
            prompt,
            triggeredByCron: true,
            user_id: series.user_id,
          }),
        });
        const genData = await genRes.json().catch(() => ({}));
        const bodyHtml = genData.generatedEmail;
        if (!bodyHtml) {
          throw new Error(genData.error || "AI generation failed");
        }

        const subject = `${series.name} – Day ${dayNum}`;
        const headerUrls = Array.isArray(series.header_image_urls) ? series.header_image_urls.filter((u: unknown) => u && String(u).trim()) : [];
        const headerImageUrl = headerUrls.length ? String(headerUrls[(dayNum - 1) % headerUrls.length]).trim() : null;
        const { data: nl, error: insertErr } = await supabase
          .from("newsletters")
          .insert({
            user_id: series.user_id,
            title: `${series.name} – Day ${dayNum}`,
            subject,
            body_html: bodyHtml,
            sender_profile_id: series.sender_profile_id || null,
            template_style: "professional",
            status: "scheduled",
            scheduled_at: new Date().toISOString(),
            scheduled_send_options: series.scheduled_send_options || null,
            ...(headerImageUrl && { header_image_url: headerImageUrl }),
          })
          .select("id")
          .single();

        if (insertErr || !nl) throw new Error(insertErr?.message || "Failed to create newsletter");

        const sendRes = await fetch(`${supabaseUrl}/functions/v1/send-newsletter`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${supabaseServiceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            newsletterId: nl.id,
            triggeredByCron: true,
          }),
        });
        const sendResult = await sendRes.json().catch(() => ({}));
        if (sendResult.error) throw new Error(sendResult.error);

        await supabase.from("newsletter_series_editions").insert({
          series_id: series.id,
          edition_date: seriesToday,
          newsletter_id: nl.id,
        });

        results.push({ seriesId: series.id, name: series.name, action: "sent" });
      } catch (err) {
        console.error("[process-newsletter-series] Series error:", series.id, err);
        results.push({
          seriesId: series.id,
          name: series.name,
          action: "error",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        action: "process-newsletter-series",
        today: todayDefault,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[process-newsletter-series] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
