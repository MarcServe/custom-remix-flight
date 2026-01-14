import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface DiscoverySummaryRequest {
  userId: string;
  discoveryRunId: string;
  stats: {
    totalLeads: number;
    autoApproved: number;
    pending: number;
    bySource: Record<string, number>;
    campaignsCreated: number;
  };
}

/**
 * Send AI-analyzed discovery summary email to user
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    
    if (!RESEND_API_KEY) {
      console.log("[send-discovery-summary] RESEND_API_KEY not configured");
      return new Response(JSON.stringify({ success: false, error: "Email not configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const resend = new Resend(RESEND_API_KEY);

    const body: DiscoverySummaryRequest = await req.json();
    const { userId, discoveryRunId, stats } = body;

    console.log(`[send-discovery-summary] Generating summary for user ${userId}, run ${discoveryRunId}`);

    // Get user email
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId);
    if (userError || !user?.email) {
      console.error("[send-discovery-summary] Could not get user email:", userError);
      return new Response(JSON.stringify({ success: false, error: "User not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's business profile for personalization
    const { data: businessProfile } = await supabase
      .from('business_profiles')
      .select('company_name')
      .eq('user_id', userId)
      .single();

    // Get discovered leads from this run
    const { data: leads } = await supabase
      .from('autonomous_leads')
      .select('company_name, industry, geography, quality_score, status, source, sources_used')
      .eq('discovery_run_id', discoveryRunId)
      .order('quality_score', { ascending: false })
      .limit(20);

    // Get persona breakdown
    const { data: personaLeads } = await supabase
      .from('autonomous_leads')
      .select('persona_id, discovery_personas(name)')
      .eq('discovery_run_id', discoveryRunId);

    const personaBreakdown: Record<string, number> = {};
    for (const lead of (personaLeads || [])) {
      const personaName = (lead.discovery_personas as any)?.name || 'General';
      personaBreakdown[personaName] = (personaBreakdown[personaName] || 0) + 1;
    }

    // Generate AI summary
    let aiSummary = '';
    if (OPENAI_API_KEY && leads && leads.length > 0) {
      try {
        const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{
              role: 'system',
              content: 'You are a helpful sales assistant summarizing daily lead discoveries. Be concise, enthusiastic, and actionable. Use bullet points. Max 150 words.'
            }, {
              role: 'user',
              content: `Summarize these discovered leads for a sales team:
              
Total: ${stats.totalLeads} leads
Auto-approved (high quality): ${stats.autoApproved}
Pending review: ${stats.pending}
Sources: ${Object.entries(stats.bySource).map(([s, c]) => `${s}: ${c}`).join(', ')}

Top leads by quality score:
${leads.slice(0, 10).map(l => `- ${l.company_name} (${l.industry || 'Unknown'}, ${l.geography || 'Unknown'}) - Score: ${l.quality_score}`).join('\n')}

Industry breakdown:
${Object.entries(leads.reduce((acc: any, l) => { acc[l.industry || 'Unknown'] = (acc[l.industry || 'Unknown'] || 0) + 1; return acc; }, {})).map(([i, c]) => `- ${i}: ${c}`).join('\n')}

Provide:
1. Key insight about today's leads
2. Recommended priority action
3. Best opportunity highlight`
            }],
            max_tokens: 300,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          aiSummary = aiData.choices?.[0]?.message?.content || '';
        }
      } catch (error) {
        console.error('[send-discovery-summary] AI summary error:', error);
      }
    }

    // Build email content
    const topLeads = (leads || []).slice(0, 5);
    const sourceList = Object.entries(stats.bySource)
      .map(([source, count]) => `${source.replace('-', ' ').toUpperCase()}: ${count}`)
      .join(' | ');

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Daily Lead Discovery Summary</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 30px; margin-bottom: 24px;">
    <h1 style="color: white; margin: 0 0 8px 0; font-size: 24px;">🚀 Your Leads Are Ready!</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 14px;">
      Discovery completed at ${new Date().toLocaleString('en-US', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' })} UTC
    </p>
  </div>

  <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
    <h2 style="margin: 0 0 16px 0; font-size: 18px; color: #1e293b;">📊 Today's Numbers</h2>
    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
      <div style="background: white; border-radius: 8px; padding: 16px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <div style="font-size: 28px; font-weight: bold; color: #667eea;">${stats.totalLeads}</div>
        <div style="font-size: 12px; color: #64748b; text-transform: uppercase;">Total Leads</div>
      </div>
      <div style="background: white; border-radius: 8px; padding: 16px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <div style="font-size: 28px; font-weight: bold; color: #22c55e;">${stats.autoApproved}</div>
        <div style="font-size: 12px; color: #64748b; text-transform: uppercase;">Auto-Approved</div>
      </div>
      <div style="background: white; border-radius: 8px; padding: 16px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <div style="font-size: 28px; font-weight: bold; color: #f59e0b;">${stats.pending}</div>
        <div style="font-size: 12px; color: #64748b; text-transform: uppercase;">Pending Review</div>
      </div>
      <div style="background: white; border-radius: 8px; padding: 16px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <div style="font-size: 28px; font-weight: bold; color: #8b5cf6;">${stats.campaignsCreated}</div>
        <div style="font-size: 12px; color: #64748b; text-transform: uppercase;">Campaigns Ready</div>
      </div>
    </div>
    <p style="margin: 16px 0 0 0; font-size: 12px; color: #64748b; text-align: center;">
      ${sourceList}
    </p>
  </div>

  ${aiSummary ? `
  <div style="background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 0 8px 8px 0; padding: 16px; margin-bottom: 24px;">
    <h3 style="margin: 0 0 8px 0; font-size: 14px; color: #92400e;">🤖 AI Insights</h3>
    <div style="font-size: 14px; color: #78350f; white-space: pre-line;">${aiSummary}</div>
  </div>
  ` : ''}

  ${topLeads.length > 0 ? `
  <div style="margin-bottom: 24px;">
    <h2 style="margin: 0 0 16px 0; font-size: 18px; color: #1e293b;">⭐ Top Leads</h2>
    ${topLeads.map((lead: any) => `
      <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 8px;">
        <div style="font-weight: 600; color: #1e293b;">${lead.company_name}</div>
        <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
          ${lead.industry || 'Unknown industry'} • ${lead.geography || 'Unknown location'} • 
          <span style="color: ${lead.quality_score >= 70 ? '#22c55e' : lead.quality_score >= 50 ? '#f59e0b' : '#64748b'};">
            Score: ${lead.quality_score}
          </span>
        </div>
      </div>
    `).join('')}
  </div>
  ` : ''}

  ${Object.keys(personaBreakdown).length > 1 ? `
  <div style="margin-bottom: 24px;">
    <h2 style="margin: 0 0 16px 0; font-size: 18px; color: #1e293b;">🎯 By Persona</h2>
    ${Object.entries(personaBreakdown).map(([name, count]) => `
      <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
        <span style="color: #475569;">${name}</span>
        <span style="font-weight: 600; color: #1e293b;">${count} leads</span>
      </div>
    `).join('')}
  </div>
  ` : ''}

  <div style="text-align: center; margin-top: 32px;">
    <a href="${Deno.env.get('APP_URL') || 'https://custom-remix-flight.lovable.app'}/lead-inbox" 
       style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">
      Review Your Leads →
    </a>
  </div>

  <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8;">
    <p>Lead Genie by ${businessProfile?.company_name || 'Your Company'}</p>
    <p>Automated lead discovery powered by AI</p>
  </div>
</body>
</html>
    `;

    // Send the email
    const emailResponse = await resend.emails.send({
      from: "Lead Genie <notifications@resend.dev>",
      to: [user.email],
      subject: `🚀 ${stats.totalLeads} new leads discovered today!`,
      html: emailHtml,
    });

    console.log("[send-discovery-summary] Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailId: emailResponse.data?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("[send-discovery-summary] Error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});