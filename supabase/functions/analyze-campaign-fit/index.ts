import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CampaignFitRequest {
  campaignType: string;
  targetIndustries: string[];
  targetSizes: string[];
  targetGeographies: string[];
  productFocus: string;
  idealCustomerProfile: string;
  companyIds?: string[]; // Optional: analyze specific companies
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
      campaignType,
      targetIndustries,
      targetSizes,
      targetGeographies,
      productFocus,
      idealCustomerProfile,
      companyIds,
    } = body;

    console.log(`[analyze-campaign-fit] Analyzing for user ${user.id}, campaign: ${campaignType}`);

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
        message: 'No companies to analyze' 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[analyze-campaign-fit] Analyzing ${companies.length} companies`);

    // Score companies based on criteria
    const results: CompanyFitResult[] = [];

    for (const company of companies) {
      let fitScore = 50; // Base score
      const fitReasons: string[] = [];

      // Industry match
      if (targetIndustries.length > 0) {
        const industryMatch = targetIndustries.some(
          ind => company.industry?.toLowerCase().includes(ind.toLowerCase())
        );
        if (industryMatch) {
          fitScore += 20;
          fitReasons.push(`Industry match: ${company.industry}`);
        } else if (company.industry) {
          fitScore -= 10;
        }
      }

      // Size match
      if (targetSizes.length > 0) {
        const sizeMatch = targetSizes.some(
          s => company.size?.toLowerCase().includes(s.toLowerCase())
        );
        if (sizeMatch) {
          fitScore += 15;
          fitReasons.push(`Size match: ${company.size}`);
        }
      }

      // Geography match
      if (targetGeographies.length > 0) {
        const geoMatch = targetGeographies.some(
          g => company.geography?.toLowerCase().includes(g.toLowerCase())
        );
        if (geoMatch) {
          fitScore += 15;
          fitReasons.push(`Geography match: ${company.geography}`);
        }
      }

      // Temperature boost (hot prospects get priority)
      if (company.temperature === 'hot') {
        fitScore += 15;
        fitReasons.push('Hot prospect - high engagement');
      } else if (company.temperature === 'warm') {
        fitScore += 10;
        fitReasons.push('Warm prospect');
      }

      // Has contacts with email (crucial for campaigns)
      const hasEmailContact = company.contacts?.some((c: any) => c.email);
      if (hasEmailContact) {
        fitScore += 10;
        fitReasons.push('Has email contact');
      } else {
        fitScore -= 15;
        fitReasons.push('No email contact - outreach difficult');
      }

      // Enrichment data bonus
      if (company.enrichment_data) {
        fitScore += 5;
      }

      // Clamp score
      fitScore = Math.max(0, Math.min(100, fitScore));

      // Determine priority
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

    // Sort by fit score
    results.sort((a, b) => b.fitScore - a.fitScore);

    // Use AI to generate campaign-specific insights for top prospects
    let aiInsights = '';
    if (OPENAI_API_KEY && results.length > 0) {
      try {
        const topProspects = results.slice(0, 10);
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
              content: 'You are a sales strategist. Provide brief, actionable campaign insights. Be specific and data-driven.'
            }, {
              role: 'user',
              content: `Analyze these prospects for a ${campaignType} campaign:

Product/Service Focus: ${productFocus}
Ideal Customer Profile: ${idealCustomerProfile}

Top prospects:
${topProspects.map(p => `- ${p.companyName} (Score: ${p.fitScore}, ${p.fitReason})`).join('\n')}

Provide:
1. Campaign approach recommendation (2 sentences)
2. Key message angles for these prospects
3. Suggested campaign sequence timing
Keep it under 100 words total.`
            }],
            max_tokens: 200,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          aiInsights = aiData.choices?.[0]?.message?.content || '';
        }
      } catch (error) {
        console.error('[analyze-campaign-fit] AI insights error:', error);
      }
    }

    // Calculate summary stats
    const summary = {
      totalAnalyzed: companies.length,
      highFit: results.filter(r => r.priority === 'high').length,
      mediumFit: results.filter(r => r.priority === 'medium').length,
      lowFit: results.filter(r => r.priority === 'low').length,
      avgFitScore: Math.round(results.reduce((sum, r) => sum + r.fitScore, 0) / results.length),
      hasContacts: results.filter(r => !r.fitReason.includes('No email')).length,
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