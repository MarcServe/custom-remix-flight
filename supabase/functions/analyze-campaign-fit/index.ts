import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CampaignFitRequest {
  /** Primary: category or campaign in plain English (e.g. "Mental Health and Learning Disability"). Drives AI relevance scoring. */
  categoryOrCampaign?: string;
  campaignType?: string;
  targetIndustries?: string[];
  targetSizes?: string[];
  targetGeographies?: string[];
  productFocus?: string;
  idealCustomerProfile?: string;
  companyIds?: string[];
}

interface CompanyFitResult {
  companyId: string;
  companyName: string;
  fitScore: number;
  fitReason: string;
  recommendedApproach: string;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Analyze companies for campaign fit using AI
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: CampaignFitRequest = await req.json();
    const {
      categoryOrCampaign,
      campaignType = '',
      targetIndustries = [],
      targetSizes = [],
      targetGeographies = [],
      productFocus = '',
      idealCustomerProfile = '',
      companyIds,
    } = body;

    const categoryForScoring = (categoryOrCampaign || '').trim();
    console.log(`[analyze-campaign-fit] Analyzing for user ${user.id}, category: ${categoryForScoring || campaignType}`);

    // Fetch companies to analyze
    let query = supabase
      .from('companies')
      .select('id, name, industry, size, geography, description, temperature, enrichment_data, contacts(email, name)')
      .eq('user_id', user.id);

    if (companyIds && companyIds.length > 0) {
      query = query.in('id', companyIds);
    }

    const { data: companies, error: companiesError } = await query.limit(100);

    if (companiesError) {
      console.error('[analyze-campaign-fit] Error fetching companies:', companiesError);
      throw companiesError;
    }

    if (!companies || companies.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        results: [],
        summary: { totalAnalyzed: 0, highFit: 0, mediumFit: 0, lowFit: 0, avgFitScore: 0, hasContacts: 0 },
        aiInsights: '',
        message: 'No companies to analyze',
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[analyze-campaign-fit] Analyzing ${companies.length} companies`);

    let results: CompanyFitResult[];

    // When user provides a plain-English category and we have OpenAI, use AI to score relevance so only aligned companies rank high
    if (categoryForScoring && OPENAI_API_KEY) {
      const aiScored = await scoreCompaniesWithAI(
        companies,
        categoryForScoring,
        { campaignType, productFocus, idealCustomerProfile, targetIndustries, targetSizes, targetGeographies },
      );
      results = aiScored;
    } else {
      // Fallback: rule-based scoring (original logic)
      results = scoreCompaniesRuleBased(companies, {
        campaignType,
        targetIndustries,
        targetSizes,
        targetGeographies,
        productFocus,
        idealCustomerProfile,
      });
    }

    // Sort by fit score descending
    results.sort((a, b) => b.fitScore - a.fitScore);

    // AI strategy insights for top prospects (when we have results)
    let aiInsights = '';
    if (OPENAI_API_KEY && results.length > 0) {
      try {
        const topProspects = results.slice(0, 10);
        const categoryLabel = categoryForScoring || campaignType || productFocus || 'this campaign';
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
              content: 'You are a sales strategist. Use plain English. Be brief and actionable.',
            }, {
              role: 'user',
              content: `Category/campaign: ${categoryLabel}.

Top aligned companies:
${topProspects.map(p => `- ${p.companyName} (${p.priority}, ${p.fitScore}): ${p.fitReason}`).join('\n')}

In 2–3 short sentences, suggest how to approach this audience and what message angles to use. Plain English only.`,
            }],
            max_tokens: 200,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          aiInsights = aiData.choices?.[0]?.message?.content?.trim() || '';
        }
      } catch (error) {
        console.error('[analyze-campaign-fit] AI insights error:', error);
      }
    }

    // Summary: hasContacts = count that have email (we infer from fitReason for AI path, or from data in rule-based)
    const hasContactsCount = results.filter(r => !r.fitReason.toLowerCase().includes('no email')).length;
    const summary = {
      totalAnalyzed: companies.length,
      highFit: results.filter(r => r.priority === 'high').length,
      mediumFit: results.filter(r => r.priority === 'medium').length,
      lowFit: results.filter(r => r.priority === 'low').length,
      avgFitScore: results.length ? Math.round(results.reduce((sum, r) => sum + r.fitScore, 0) / results.length) : 0,
      hasContacts: hasContactsCount,
    };

    console.log(`[analyze-campaign-fit] Analysis complete. High: ${summary.highFit}, Medium: ${summary.mediumFit}, Low: ${summary.lowFit}`);

    return new Response(JSON.stringify({
      success: true,
      results,
      summary,
      aiInsights,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error('[analyze-campaign-fit] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function getRecommendedApproach(company: any, campaignType: string, fitScore: number): string {
  if (fitScore >= 80) {
    if (company.temperature === 'hot') {
      return 'Priority outreach - personalized email with direct value prop';
    }
    return 'High-touch approach - custom messaging highlighting specific fit';
  } else if (fitScore >= 60) {
    return 'Standard sequence - industry-specific value proposition';
  } else if (fitScore >= 40) {
    return 'Nurture sequence - educational content first';
  } else {
    return 'Low priority - consider excluding or long-term nurture only';
  }
}

type RuleBasedOptions = {
  campaignType: string;
  targetIndustries: string[];
  targetSizes: string[];
  targetGeographies: string[];
  productFocus: string;
  idealCustomerProfile: string;
};

function scoreCompaniesRuleBased(companies: any[], opts: RuleBasedOptions): CompanyFitResult[] {
  const { campaignType, targetIndustries, targetSizes, targetGeographies } = opts;
  const results: CompanyFitResult[] = [];

  for (const company of companies) {
    let fitScore = 50;
    const fitReasons: string[] = [];

    if (targetIndustries.length > 0) {
      const industryMatch = targetIndustries.some(
        (ind: string) => company.industry?.toLowerCase().includes(ind.toLowerCase())
      );
      if (industryMatch) {
        fitScore += 20;
        fitReasons.push(`Industry match: ${company.industry}`);
      } else if (company.industry) {
        fitScore -= 10;
      }
    }
    if (targetSizes.length > 0) {
      const sizeMatch = targetSizes.some(
        (s: string) => company.size?.toLowerCase().includes(s.toLowerCase())
      );
      if (sizeMatch) {
        fitScore += 15;
        fitReasons.push(`Size match: ${company.size}`);
      }
    }
    if (targetGeographies.length > 0) {
      const geoMatch = targetGeographies.some(
        (g: string) => company.geography?.toLowerCase().includes(g.toLowerCase())
      );
      if (geoMatch) {
        fitScore += 15;
        fitReasons.push(`Geography match: ${company.geography}`);
      }
    }
    if (company.temperature === 'hot') {
      fitScore += 15;
      fitReasons.push('Hot prospect - high engagement');
    } else if (company.temperature === 'warm') {
      fitScore += 10;
      fitReasons.push('Warm prospect');
    }
    const hasEmailContact = company.contacts?.some((c: any) => c.email);
    if (hasEmailContact) {
      fitScore += 10;
      fitReasons.push('Has email contact');
    } else {
      fitScore -= 15;
      fitReasons.push('No email contact - outreach difficult');
    }
    if (company.enrichment_data) fitScore += 5;
    fitScore = Math.max(0, Math.min(100, fitScore));

    let priority: 'high' | 'medium' | 'low';
    if (fitScore >= 75) priority = 'high';
    else if (fitScore >= 50) priority = 'medium';
    else priority = 'low';

    results.push({
      companyId: company.id,
      companyName: company.name,
      fitScore,
      fitReason: fitReasons.join('. ') || 'General prospect',
      recommendedApproach: getRecommendedApproach(company, campaignType, fitScore),
      priority,
    });
  }
  return results;
}

function buildCompanySummary(company: any): string {
  const desc = company.description || (company.enrichment_data?.description as string) || '';
  const snippet = typeof desc === 'string' ? desc.slice(0, 300) : '';
  const parts = [
    `Name: ${company.name}`,
    company.industry ? `Industry: ${company.industry}` : '',
    company.geography ? `Geography: ${company.geography}` : '',
    company.size ? `Size: ${company.size}` : '',
    snippet ? `About: ${snippet}` : '',
  ].filter(Boolean);
  return parts.join('. ');
}

async function scoreCompaniesWithAI(
  companies: any[],
  categoryOrCampaign: string,
  context: {
    campaignType: string;
    productFocus: string;
    idealCustomerProfile: string;
    targetIndustries: string[];
    targetSizes: string[];
    targetGeographies: string[];
  },
): Promise<CompanyFitResult[]> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) return scoreCompaniesRuleBased(companies, { ...context, campaignType: categoryOrCampaign });

  const companySummaries = companies.map((c) => ({
    id: c.id,
    name: c.name,
    summary: buildCompanySummary(c),
    hasEmail: c.contacts?.some((cc: any) => cc.email),
  }));

  const systemPrompt = `You are a B2B campaign analyst. The user will give you a TARGET CATEGORY in plain English (e.g. "Mental Health and Learning Disability", "B2B SaaS", "Sustainable Packaging").

Your job: For each company listed, decide how well it ALIGNS with that category.

- Only companies that OPERATE IN, SERVE, or are MEANINGFULLY RELATED to the category should get high (75–100) or medium (50–74) scores.
- Companies that are NOT related (e.g. a retail supermarket when the category is Mental Health and Learning Disability) must get a LOW score (0–39) and a clear plain-English reason, e.g. "Not aligned: [company] is a [what they do], not related to [category]."
- Use plain English for every "fitReason" and "recommendedApproach".
- Respond with a valid JSON array only, no markdown or extra text. Each object must have: companyId (string), fitScore (0-100 number), fitReason (string), recommendedApproach (string), priority ("high"|"medium"|"low"). priority: high if fitScore>=75, medium if 50-74, low if 0-49.`;

  const userContent = `TARGET CATEGORY (only companies that match this should score high or medium):
${categoryOrCampaign}
${context.productFocus ? `Product/focus: ${context.productFocus}` : ''}
${context.idealCustomerProfile ? `Ideal customer: ${context.idealCustomerProfile}` : ''}

Companies (one per line, format: ID|NAME|SUMMARY):
${companySummaries.map((c) => `${c.id}|${c.name}|${c.summary}`).join('\n')}

Return a JSON array of objects with keys: companyId, fitScore, fitReason, recommendedApproach, priority. One object per company. Use the exact companyId from the list.`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        max_tokens: 4000,
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      console.error('[analyze-campaign-fit] OpenAI API error:', await res.text());
      return scoreCompaniesRuleBased(companies, { ...context, campaignType: categoryOrCampaign });
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim() || '';
    // Parse JSON (may be wrapped in markdown code block)
    let jsonStr = content;
    const codeMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeMatch) jsonStr = codeMatch[1].trim();
    const parsed = JSON.parse(jsonStr) as Array<{
      companyId: string;
      fitScore: number;
      fitReason: string;
      recommendedApproach: string;
      priority: 'high' | 'medium' | 'low';
    }>;

    const byId = new Map(companies.map((c) => [c.id, c]));
    const hasEmail = (company: any) => company.contacts?.some((c: any) => c.email);
    const scoredIds = new Set(parsed.map((p) => p.companyId));

    const resultsList: CompanyFitResult[] = parsed
      .filter((p) => byId.has(p.companyId))
      .map((p) => {
        const company = byId.get(p.companyId)!;
        let reason = p.fitReason;
        if (!hasEmail(company) && !reason.toLowerCase().includes('no email')) {
          reason = `${reason}. No email contact - outreach difficult.`;
        } else if (hasEmail(company) && !reason.toLowerCase().includes('email')) {
          reason = `${reason}. Has email contact.`;
        }
        return {
          companyId: p.companyId,
          companyName: company.name,
          fitScore: Math.max(0, Math.min(100, Number(p.fitScore) || 0)),
          fitReason: reason,
          recommendedApproach: p.recommendedApproach || getRecommendedApproach(company, categoryOrCampaign, p.fitScore),
          priority: ['high', 'medium', 'low'].includes(p.priority) ? p.priority : (p.fitScore >= 75 ? 'high' : p.fitScore >= 50 ? 'medium' : 'low'),
        };
      });

    // Ensure every company appears: add any missing with low priority
    for (const company of companies) {
      if (scoredIds.has(company.id)) continue;
      const noEmail = !hasEmail(company);
      resultsList.push({
        companyId: company.id,
        companyName: company.name,
        fitScore: 20,
        fitReason: `Not aligned with "${categoryOrCampaign}". ${noEmail ? 'No email contact.' : ''}`.trim(),
        recommendedApproach: 'Exclude from this campaign or use for a different category.',
        priority: 'low',
      });
    }
    return resultsList;
  } catch (e) {
    console.error('[analyze-campaign-fit] AI scoring error:', e);
    return scoreCompaniesRuleBased(companies, { ...context, campaignType: categoryOrCampaign });
  }
}