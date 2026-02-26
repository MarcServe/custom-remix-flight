import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

function cleanApiKey(key: string | undefined): string | null {
  if (!key) return null;
  return key.trim().replace(/[^\x00-\x7F]/g, '');
}

const OPENAI_API_KEY = cleanApiKey(Deno.env.get('OPENAI_API_KEY'));
const DEAL_STAGES = ["NEW", "QUALIFIED", "CONTACTED", "MEETING", "PROPOSAL", "WON", "LOST"];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { threadIds } = await req.json();
    if (!threadIds || !Array.isArray(threadIds) || threadIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'threadIds array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: threads, error: threadsError } = await supabaseClient
      .from('email_threads')
      .select('id, direction, from_email, to_email, subject, body_text, received_at')
      .in('id', threadIds)
      .order('received_at', { ascending: true });

    if (threadsError || !threads?.length) {
      return new Response(
        JSON.stringify({ error: 'Could not load conversation threads' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const conversationText = threads.map((t) => {
      const dir = t.direction === 'inbound' ? 'IN' : 'OUT';
      const body = (t.body_text || '').slice(0, 2000);
      return `[${dir}] From: ${t.from_email} To: ${t.to_email}\nSubject: ${t.subject || '(none)'}\nDate: ${t.received_at}\n${body}\n---`;
    }).join('\n\n');

    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'OPENAI_API_KEY is not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const prompt = `You are a sales CRM assistant. Analyze this email conversation and extract deal information to create a new deal in the pipeline.

CONVERSATION:
${conversationText}

TASK:
From this conversation, infer:
1. deal_title: A short, specific deal/opportunity title (e.g. "Enterprise license - Acme Corp", "Website accessibility project - [Company]").
2. company_name: The prospect or company name if clearly identifiable from emails/domains; otherwise null.
3. stage: One of exactly: NEW, QUALIFIED, CONTACTED, MEETING, PROPOSAL, WON, LOST. Prefer CONTACTED if there has been email exchange; NEW if only outbound sent.
4. amount: Estimated deal value in GBP (number only), or null if unknown.
5. priority: One of: low, medium, high. Use context (e.g. interested reply = high).
6. notes: 1-2 sentence summary of the conversation and next steps, or null.

Return ONLY a valid JSON object with these exact keys: deal_title, company_name, stage, amount, priority, notes. Use null for unknown. stage must be one of: ${DEAL_STAGES.join(', ')}.`;

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You extract structured deal data from email conversations. Reply only with valid JSON.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 500,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('OpenAI error:', aiResponse.status, errText);
      return new Response(
        JSON.stringify({ error: 'AI analysis failed' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content?.trim() || '';
    const parsed = (() => {
      const stripped = content.replace(/^```json\s*|\s*```$/g, '').trim();
      try {
        return JSON.parse(stripped);
      } catch {
        return null;
      }
    })();

    if (!parsed || typeof parsed.deal_title !== 'string') {
      return new Response(
        JSON.stringify({ error: 'AI did not return valid deal data', raw: content }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const stage = DEAL_STAGES.includes(parsed.stage) ? parsed.stage : 'CONTACTED';
    const result = {
      title: parsed.deal_title,
      company_name: parsed.company_name ?? null,
      stage,
      amount: typeof parsed.amount === 'number' && parsed.amount >= 0 ? parsed.amount : null,
      priority: ['low', 'medium', 'high'].includes(parsed.priority) ? parsed.priority : 'medium',
      notes: parsed.notes ?? null,
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('analyze-conversation-for-deal error:', e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
