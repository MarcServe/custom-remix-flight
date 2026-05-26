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

const VALID_TEMPLATE_STYLES = new Set([
  "professional",
  "minimal",
  "modern",
  "creative",
  "corporate",
  "bold",
  "elegant",
]);

function normalizeTemplateStyles(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    const s = String(item ?? "").toLowerCase().trim();
    if (VALID_TEMPLATE_STYLES.has(s)) out.push(s);
  }
  return out;
}

function pickTemplateStyle(
  seriesStyles: string[],
  dayIndex0: number,
  senderFallback: string | null
): string {
  if (seriesStyles.length > 0) return seriesStyles[dayIndex0 % seriesStyles.length];
  const fb = (senderFallback || "").toLowerCase().trim();
  if (fb && VALID_TEMPLATE_STYLES.has(fb)) return fb;
  return "professional";
}

const CONTENT_ANGLES = [
  "Focus on one actionable tip readers can use today.",
  "Lead with a short industry insight or trend, then explain why it matters.",
  "Use a mini case-style narrative: challenge → approach → outcome (hypothetical is fine).",
  "Structure as a tight listicle of 3–5 best practices with short explanations.",
  "Open with a common mistake, then correct it with clear guidance.",
  "Highlight a checklist readers can skim and apply.",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const authHeader = req.headers.get("Authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    /** Cron / internal: service role, all series (optional filterUserId for ops). Logged-in user: JWT, own series only. */
    let filterUserId: string | null = null;
    if (authHeader === `Bearer ${supabaseServiceKey}`) {
      const raw = body.filterUserId ?? body.filter_user_id;
      filterUserId = typeof raw === "string" && raw.trim() ? raw.trim() : null;
    } else {
      const anon = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: authErr } = await anon.auth.getUser();
      if (authErr || !user?.id) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      filterUserId = user.id;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Default timezone label for logs (each series uses its own timezone for send window)
    const defaultTz = "Europe/London";
    const { dateStr: todayDefault } = getTodayAndTimeInTimezone(defaultTz);

    // Fetch active series where start_date <= today <= start_date + duration_days
    let seriesQuery = supabase.from("newsletter_series").select("*").eq("status", "active");
    if (filterUserId) {
      seriesQuery = seriesQuery.eq("user_id", filterUserId);
    }
    const { data: allActive, error: fetchError } = await seriesQuery;

    if (fetchError) {
      console.error("[process-newsletter-series] Fetch series error:", fetchError);
      return new Response(
        JSON.stringify({ success: false, error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: { seriesId: string; name: string; action: string; error?: string }[] = [];

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
        const dayIndex0 = dayNum - 1;
        const seriesStyles = normalizeTemplateStyles(series.template_styles);
        let senderTemplateStyle: string | null = null;
        if (series.sender_profile_id) {
          const { data: sp } = await supabase
            .from("sender_profiles")
            .select("template_style")
            .eq("id", series.sender_profile_id)
            .maybeSingle();
          senderTemplateStyle = (sp as { template_style?: string } | null)?.template_style ?? null;
        }
        const templateStyle = pickTemplateStyle(seriesStyles, dayIndex0, senderTemplateStyle);
        const contentAngle = CONTENT_ANGLES[dayIndex0 % CONTENT_ANGLES.length];

        // If series has a topics array, rotate through topics by edition number instead of using the same template each day
        let promptText = series.ai_topic_template || "Daily newsletter content for our subscribers.";
        if (Array.isArray(series.topics) && series.topics.length > 0) {
          // Count existing editions to pick the right topic
          const { count: editionCount } = await supabase
            .from('newsletter_series_editions')
            .select('id', { count: 'exact', head: true })
            .eq('series_id', series.id);
          const topicIndex = (editionCount || 0) % series.topics.length;
          promptText = series.topics[topicIndex] as string;
        }
        const topicTemplate = promptText;
        promptText = promptText
          .replace(/\{day\}/g, String(dayNum))
          .replace(/\{total\}/g, String(total));
        const prompt = `Write a marketing newsletter email about: ${promptText}
Day ${dayNum} of ${total} in this series.
Target audience: ${series.ai_target_audience || "subscribers"}.
Tone: ${series.ai_tone || "professional"}.
Today's editorial angle: ${contentAngle}
Email wrapper design for this send: "${templateStyle}" (match the writing to this vibe; body is still HTML for email).

The newsletter should:
- Have an engaging opening that differs from a generic "welcome"
- Include 2-3 key points or tips (or follow today's editorial angle)
- Be roughly 200-450 words
- Use semantic HTML: <h2> for sections, <p>, <strong>, <ul>/<li> as appropriate
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
            templateStyle,
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

        // Try to generate a relevant header image
        // Use Unsplash Source for topic-based images (free, no API key needed)
        let headerImageUrl: string | null = null;
        if (headerUrls.length > 0) {
          headerImageUrl = headerUrls[Math.floor(Math.random() * headerUrls.length)];
        } else {
          // Extract a keyword from the topic for image search
          const topicWords = (series.ai_topic_template || topicTemplate || 'business')
            .split(' ')
            .filter((w: string) => w.length > 4)
            .slice(0, 2)
            .join(',');
          const keyword = encodeURIComponent(topicWords || 'business technology');
          // Unsplash Source gives a random relevant image — deterministic per topic+date
          const seed = `${series.id}-${new Date().toISOString().slice(0, 10)}`;
          headerImageUrl = `https://source.unsplash.com/featured/1200x400/?${keyword}&sig=${encodeURIComponent(seed)}`;
        }
        // When the series owner wants to review each edition before it goes out,
        // create the newsletter as a draft and skip the send step entirely.
        const reviewBeforeSend =
          series.scheduled_send_options &&
          typeof series.scheduled_send_options === "object" &&
          (series.scheduled_send_options as Record<string, unknown>).reviewBeforeSend === true;

        // Strip the reviewBeforeSend flag from the options we persist on the newsletter
        // so that the send-newsletter function doesn't see an unexpected field.
        let newsletterSendOptions: Record<string, unknown> | null = null;
        if (series.scheduled_send_options && typeof series.scheduled_send_options === "object") {
          const { reviewBeforeSend: _drop, ...rest } = series.scheduled_send_options as Record<string, unknown>;
          newsletterSendOptions = Object.keys(rest).length ? rest : null;
        }

        const { data: nl, error: insertErr } = await supabase
          .from("newsletters")
          .insert({
            user_id: series.user_id,
            title: `${series.name} – Day ${dayNum}`,
            subject,
            body_html: bodyHtml,
            sender_profile_id: series.sender_profile_id || null,
            template_style: templateStyle,
            status: reviewBeforeSend ? "draft" : "scheduled",
            scheduled_at: new Date().toISOString(),
            scheduled_send_options: newsletterSendOptions,
            ...(headerImageUrl && { header_image_url: headerImageUrl }),
          })
          .select("id")
          .single();

        if (insertErr || !nl) throw new Error(insertErr?.message || "Failed to create newsletter");

        if (!reviewBeforeSend) {
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
        }

        await supabase.from("newsletter_series_editions").insert({
          series_id: series.id,
          edition_date: seriesToday,
          newsletter_id: nl.id,
        });

        results.push({
          seriesId: series.id,
          name: series.name,
          action: reviewBeforeSend ? "drafted_for_review" : "sent",
        });
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
        scope: filterUserId ? "user" : "all",
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
