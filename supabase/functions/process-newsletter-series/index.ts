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

/** Image models to try, newest first. Older ones (dall-e-3) have been retired by OpenAI. */
const IMAGE_MODELS = ["gpt-image-2", "gpt-image-1.5", "gpt-image-1-mini"];

/** The editor's "insert an image here" slot that generate-email-with-ai leaves between sections. */
const IMAGE_SLOT_RE = /<div class="newsletter-image-slot"[^>]*>[\s\S]*?<\/div>/g;

/** Generate one image and return its bytes, or null if every model fails. */
async function generateImageBytes(openaiKey: string, prompt: string): Promise<Uint8Array | null> {
  for (const model of IMAGE_MODELS) {
    // Try compact JPEG output first; fall back to the model's defaults if it rejects the options.
    const bodies = [
      { model, prompt, n: 1, size: "1536x1024", quality: "medium", output_format: "jpeg", output_compression: 82 },
      { model, prompt, n: 1, size: "1536x1024" },
    ];
    for (const body of bodies) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 85_000);
      try {
        const res = await fetch("https://api.openai.com/v1/images/generations", {
          method: "POST",
          headers: { "Authorization": `Bearer ${openaiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });
        if (!res.ok) {
          console.warn(`[process-newsletter-series] image model ${model} failed:`, res.status, (await res.text().catch(() => "")).slice(0, 300));
          continue;
        }
        const json = await res.json() as { data?: { b64_json?: string; url?: string }[] };
        const first = json?.data?.[0];
        if (first?.b64_json) return Uint8Array.from(atob(first.b64_json), (c) => c.charCodeAt(0));
        if (first?.url) {
          const img = await fetch(first.url);
          if (img.ok) return new Uint8Array(await img.arrayBuffer());
        }
      } catch (e) {
        console.warn(`[process-newsletter-series] image model ${model} error:`, e instanceof Error ? e.message : e);
      } finally {
        clearTimeout(timer);
      }
    }
  }
  return null;
}

/**
 * Store image bytes in the public email-branding bucket and return a permanent URL.
 * (Provider URLs expire within the hour, which would break the image for later opens.)
 */
async function storeImage(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  bytes: Uint8Array,
  basePath: string
): Promise<string | null> {
  try {
    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
    const path = `${basePath}.${isJpeg ? "jpg" : "png"}`;
    const { error } = await supabase.storage
      .from("email-branding")
      .upload(path, bytes, { contentType: isJpeg ? "image/jpeg" : "image/png", upsert: true });
    if (error) {
      console.warn("[process-newsletter-series] image upload failed:", error.message);
      return null;
    }
    const { data } = supabase.storage.from("email-branding").getPublicUrl(path);
    return data?.publicUrl || null;
  } catch (e) {
    console.warn("[process-newsletter-series] image store error:", e);
    return null;
  }
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
      // Last send day is start + (duration - 1): a 7-day series sends on 7 days, not 8.
      const end = new Date(start);
      end.setDate(end.getDate() + Math.max(1, Number(series.duration_days) || 1) - 1);
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

        // Images for this edition, grounded in the sender's business:
        //   header  → user-supplied URLs if given, otherwise AI-generated
        //   in-body → one AI illustration placed in the first image slot
        // If generation fails we fall back to the sender's normal branding header (no random stock photo).
        let headerImageUrl: string | null = headerUrls.length > 0 ? headerUrls[dayIndex0 % headerUrls.length] : null;
        let inlineImageUrl: string | null = null;
        const openaiKey = (Deno.env.get("OPENAI_API_KEY") || "").trim().replace(/[^\x21-\x7E]/g, "");
        if (openaiKey) {
          const { data: biz } = await supabase
            .from("business_profiles")
            .select("company_name, industry, services_description, email_brand_color")
            .eq("user_id", series.user_id)
            .maybeSingle();
          const bz = (biz || {}) as { company_name?: string; industry?: string; services_description?: string; email_brand_color?: string };
          const bizLine = [
            bz.industry ? `The sender is a ${bz.industry} business` : "",
            bz.services_description ? `that offers: ${String(bz.services_description).replace(/\s+/g, " ").slice(0, 220)}` : "",
          ].filter(Boolean).join(" ");
          const topicLine = topicTemplate.replace(/\{day\}/g, String(dayNum)).replace(/\{total\}/g, String(total)).slice(0, 200);
          const shared =
            (bizLine ? `${bizLine}. The scene should visibly relate to that line of work. ` : "") +
            (bz.email_brand_color ? `Use ${bz.email_brand_color} as the accent colour. ` : "") +
            `Suitable for a ${series.ai_tone || "professional"} ${series.ai_target_audience || "business"} audience. ` +
            `No people's faces, no logos, no words or lettering anywhere in the image. High quality editorial style.`;
          const base = `${series.user_id}/series/${series.id}-${seriesToday}`;
          const wantsInline = IMAGE_SLOT_RE.test(bodyHtml);
          IMAGE_SLOT_RE.lastIndex = 0;

          const [headerBytes, inlineBytes] = await Promise.all([
            headerImageUrl
              ? Promise.resolve(null)
              : generateImageBytes(openaiKey, `A clean, wide newsletter header banner for the series "${series.name}", today's edition about: ${topicLine}. Modern, uncluttered composition. ${shared}`),
            wantsInline
              ? generateImageBytes(openaiKey, `An illustration to sit inside a newsletter article about: ${topicLine}. Show one clear, concrete scene that explains the idea. ${shared}`)
              : Promise.resolve(null),
          ]);
          if (headerBytes) headerImageUrl = await storeImage(supabase, headerBytes, `${base}-header`);
          if (inlineBytes) inlineImageUrl = await storeImage(supabase, inlineBytes, `${base}-inline`);
        }

        // Fill the first image slot with the illustration and remove every leftover slot, so the
        // editor hint ("Click Insert Image…") can never be emailed to subscribers.
        let slotFilled = false;
        const finalBodyHtml = String(bodyHtml).replace(IMAGE_SLOT_RE, () => {
          if (inlineImageUrl && !slotFilled) {
            slotFilled = true;
            return `<img src="${inlineImageUrl}" alt="" style="display:block;width:100%;max-width:100%;height:auto;border-radius:8px;margin:16px 0;" />`;
          }
          return "";
        });

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
            body_html: finalBodyHtml,
            sender_profile_id: series.sender_profile_id || null,
            template_style: templateStyle,
            // Always start as a draft; it only becomes "scheduled" once today's edition is claimed.
            status: "draft",
            scheduled_at: new Date().toISOString(),
            scheduled_send_options: newsletterSendOptions,
            ...(headerImageUrl && { header_image_url: headerImageUrl }),
          })
          .select("id")
          .single();

        if (insertErr || !nl) throw new Error(insertErr?.message || "Failed to create newsletter");

        // Claim today's edition BEFORE sending. UNIQUE(series_id, edition_date) makes this an
        // atomic lock: an overlapping run loses the insert and backs out, and a failed send can
        // no longer cause a fresh newsletter (and a fresh send) every 15 minutes.
        const { error: claimErr } = await supabase.from("newsletter_series_editions").insert({
          series_id: series.id,
          edition_date: seriesToday,
          newsletter_id: nl.id,
        });
        if (claimErr) {
          await supabase.from("newsletters").delete().eq("id", nl.id);
          if ((claimErr as { code?: string }).code === "23505") continue; // another run already has today
          throw new Error(`Could not record edition: ${claimErr.message}`);
        }

        if (reviewBeforeSend) {
          results.push({ seriesId: series.id, name: series.name, action: "drafted_for_review" });
          continue;
        }

        await supabase.from("newsletters").update({ status: "scheduled" }).eq("id", nl.id);
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
        if (sendResult.error) {
          // The newsletter stays "scheduled", so the regular scheduled-newsletter cron retries
          // this same newsletter; the series will not generate another one for today.
          results.push({
            seriesId: series.id,
            name: series.name,
            action: "error",
            error: `Edition created but not sent yet (will retry): ${sendResult.error}`,
          });
          continue;
        }

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
