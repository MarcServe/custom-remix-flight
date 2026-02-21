import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');

  const htmlResponse = (title: string, message: string, success: boolean) => {
    const color = success ? '#22c55e' : '#ef4444';
    return new Response(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
    .card { background: #fff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); padding: 48px 40px; max-width: 460px; text-align: center; }
    .icon { width: 64px; height: 64px; border-radius: 50%; background: ${color}15; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; }
    .icon svg { width: 32px; height: 32px; color: ${color}; }
    h1 { font-size: 22px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
    p { font-size: 15px; color: #64748b; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">
      ${success
        ? '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>'
        : '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"/></svg>'
      }
    </div>
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      status: success ? 200 : 400,
    });
  };

  if (!token) {
    return htmlResponse('Invalid Link', 'This unsubscribe link is invalid or has expired.', false);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: subscriber, error } = await supabase
      .from('newsletter_subscribers')
      .select('id, email, status')
      .eq('unsubscribe_token', token)
      .maybeSingle();

    if (error || !subscriber) {
      return htmlResponse('Not Found', 'This unsubscribe link is invalid or the subscription was already removed.', false);
    }

    if (subscriber.status === 'unsubscribed') {
      return htmlResponse('Already Unsubscribed', `You've already been unsubscribed. You won't receive any more emails from us.`, true);
    }

    const { error: updateError } = await supabase
      .from('newsletter_subscribers')
      .update({
        status: 'unsubscribed',
        unsubscribed_at: new Date().toISOString(),
      })
      .eq('id', subscriber.id);

    if (updateError) {
      return htmlResponse('Error', 'Something went wrong. Please try again later.', false);
    }

    return htmlResponse(
      'Unsubscribed Successfully',
      `You've been unsubscribed and will no longer receive newsletter emails. We're sorry to see you go!`,
      true
    );
  } catch (err: any) {
    console.error('Unsubscribe error:', err);
    return htmlResponse('Error', 'Something went wrong processing your request. Please try again.', false);
  }
});
