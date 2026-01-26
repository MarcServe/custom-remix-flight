import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface EnrichmentRequest {
  leads: Array<{
    name: string;
    website?: string;
    industry?: string;
    geography?: string;
  }>;
  provider?: 'perplexity' | 'eva';
}

/**
 * Enrich leads with full information using Perplexity or Eva AI
 * This function enriches leads with description, tags, overview, and other details
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[enrich-leads] Starting enrichment');

  try {
    const { leads, provider = 'perplexity' }: EnrichmentRequest = await req.json();

    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Leads array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
    const EVA_API_KEY = Deno.env.get("EVA_API_KEY");
    
    if (provider === 'perplexity' && !PERPLEXITY_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'PERPLEXITY_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (provider === 'eva' && !EVA_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'EVA_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[enrich-leads] Processing ${leads.length} leads with ${provider}`);

    // Create SSE response for progress streaming
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        };

        const enrichedLeads: any[] = [];
        let successCount = 0;
        let failedCount = 0;

        // Process leads in batches to avoid rate limits
        const BATCH_SIZE = provider === 'perplexity' ? 3 : 2;
        
        for (let i = 0; i < leads.length; i += BATCH_SIZE) {
          const batch = leads.slice(i, i + BATCH_SIZE);
          
          const batchPromises = batch.map(async (lead, batchIndex) => {
            const globalIndex = i + batchIndex;
            
            // Send progress
            send({
              type: 'progress',
              current: globalIndex + 1,
              total: leads.length,
              companyName: lead.name,
            });

            try {
              const enrichedData = provider === 'perplexity'
                ? await enrichLeadWithPerplexity(lead, PERPLEXITY_API_KEY!)
                : await enrichLeadWithEva(lead, EVA_API_KEY!);

              if (enrichedData) {
                successCount++;
                send({
                  type: 'enriched',
                  companyName: lead.name,
                  hasDescription: !!enrichedData.description,
                  hasTags: (enrichedData.suggestedTags || []).length > 0,
                  hasSocials: Object.keys(enrichedData.socialProfiles || {}).length > 0,
                });

                enrichedLeads.push({
                  ...lead,
                  ...enrichedData,
                });
              } else {
                failedCount++;
                send({
                  type: 'failed',
                  companyName: lead.name,
                  error: 'No enrichment data returned',
                });
                enrichedLeads.push(lead);
              }
            } catch (error) {
              failedCount++;
              const errorMsg = error instanceof Error ? error.message : 'Unknown error';
              send({
                type: 'failed',
                companyName: lead.name,
                error: errorMsg,
              });
              enrichedLeads.push(lead);
            }
          });

          await Promise.all(batchPromises);

          // Small delay between batches to avoid rate limits
          if (i + BATCH_SIZE < leads.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }

        // Send completion
        send({
          type: 'complete',
          success: successCount,
          failed: failedCount,
          total: leads.length,
          enrichedLeads,
        });

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('[enrich-leads] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Enrich a single lead with Perplexity AI
 */
async function enrichLeadWithPerplexity(
  lead: any,
  apiKey: string
): Promise<any> {
  const companyIdentifier = lead.website
    ? `${lead.name} (${lead.website})`
    : lead.name;

  const structuredPrompt = `Research the company "${companyIdentifier}"${lead.industry ? ` in the ${lead.industry} industry` : ''}${lead.geography ? ` located in ${lead.geography}` : ''} and return ONLY a valid JSON object with the following structure. Do not include any text before or after the JSON.

{
  "description": "Detailed company description (200+ characters). What they do, their mission, main business, target market, and value proposition.",
  "products": "Main products or services offered, separated by commas",
  "recentNews": "Any recent news, funding, or announcements from 2024-2025. Say 'No recent news found' if none.",
  "fundingInfo": "Funding stage, amount raised, or investors if known. Say 'Not available' if unknown.",
  "employeeCount": 0,
  "companyPhone": "Main phone number or null",
  "generalEmail": "General contact email or null",
  "suggestedTags": ["industry tag", "category tag", "specialty tag", "business model tag"],
  "socialProfiles": {
    "linkedin": "LinkedIn company URL or null",
    "twitter": "Twitter/X URL or null",
    "facebook": "Facebook URL or null",
    "instagram": "Instagram URL or null",
    "youtube": "YouTube channel URL or null",
    "tiktok": "TikTok URL or null"
  },
  "keyExecutives": [
    {"name": "Full Name", "title": "Job Title", "email": null, "linkedin": null}
  ],
  "technologies": "Key technologies used, separated by commas",
  "revenue": "Annual revenue estimate or null",
  "foundingYear": 0,
  "headquarters": "Headquarters location or null"
}

Important: 
- Return ONLY valid JSON, no markdown code blocks
- Use null for unknown fields, not empty strings
- Include 4-6 relevant industry/category/business model tags in suggestedTags
- Find at least 2-3 key executives if possible (CEO, Founder, CTO, etc.)
- Search thoroughly for social media profiles
- Provide comprehensive description that helps understand what the business does`;

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: 'You are a business research assistant. Return only valid JSON, no explanations or markdown. Search thoroughly for comprehensive company information including business model, target market, and value proposition.'
          },
          {
            role: 'user',
            content: structuredPrompt
          }
        ],
      }),
    });

    if (!response.ok) {
      console.error(`[enrich-leads] Perplexity API error for ${lead.name}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Parse JSON response
    let parsed: any = {};
    try {
      let jsonStr = content.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.slice(7);
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.slice(3);
      }
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.slice(0, -3);
      }
      jsonStr = jsonStr.trim();

      parsed = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error(`[enrich-leads] Failed to parse JSON for ${lead.name}:`, parseError);
      return {
        description: content.substring(0, 500),
        enrichment_data: {
          perplexity_summary: content,
          enriched_at: new Date().toISOString(),
          parseError: true,
        },
      };
    }

    // Clean social profiles
    const cleanedSocials: any = {};
    const platforms = ['linkedin', 'twitter', 'facebook', 'instagram', 'youtube', 'tiktok'];
    for (const platform of platforms) {
      const url = parsed.socialProfiles?.[platform];
      if (url && typeof url === 'string' && url.startsWith('http')) {
        cleanedSocials[platform] = url;
      }
    }

    return {
      description: parsed.description,
      products: parsed.products,
      recentNews: parsed.recentNews,
      fundingInfo: parsed.fundingInfo,
      employeeCount: parsed.employeeCount || null,
      companyPhone: parsed.companyPhone || null,
      generalEmail: parsed.generalEmail || null,
      technologies: parsed.technologies || null,
      revenue: parsed.revenue || null,
      foundingYear: parsed.foundingYear || null,
      headquarters: parsed.headquarters || null,
      suggestedTags: parsed.suggestedTags || [],
      socialProfiles: cleanedSocials,
      keyExecutives: parsed.keyExecutives || [],
      wasEnriched: true,
      enrichmentTier: 'deep',
      enrichment_data: {
        ...parsed,
        perplexity_summary: parsed.description,
        enriched_at: new Date().toISOString(),
        citations: data.citations,
        model: 'sonar',
      },
    };
  } catch (error) {
    console.error(`[enrich-leads] Error enriching ${lead.name}:`, error);
    return null;
  }
}

/**
 * Enrich a single lead with Eva AI
 */
async function enrichLeadWithEva(
  lead: any,
  apiKey: string
): Promise<any> {
  // Eva AI implementation would go here
  // For now, fallback to Perplexity-like structure
  // This is a placeholder - actual Eva API integration would need their specific API format
  
  const companyIdentifier = lead.website
    ? `${lead.name} (${lead.website})`
    : lead.name;

  try {
    // Placeholder for Eva AI API call
    // Replace with actual Eva AI API integration when available
    const response = await fetch('https://api.eva.ai/v1/enrich', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        company: companyIdentifier,
        industry: lead.industry,
        geography: lead.geography,
      }),
    });

    if (!response.ok) {
      console.error(`[enrich-leads] Eva API error for ${lead.name}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    // Map Eva response to our format
    return {
      description: data.description || data.overview,
      products: data.products || data.services,
      recentNews: data.recentNews || null,
      fundingInfo: data.fundingInfo || null,
      employeeCount: data.employeeCount || null,
      companyPhone: data.phone || null,
      generalEmail: data.email || null,
      technologies: data.technologies || null,
      revenue: data.revenue || null,
      foundingYear: data.foundedYear || null,
      headquarters: data.headquarters || data.location || null,
      suggestedTags: data.tags || data.categories || [],
      socialProfiles: data.socialProfiles || {},
      keyExecutives: data.executives || data.team || [],
      wasEnriched: true,
      enrichmentTier: 'deep',
      enrichment_data: {
        ...data,
        enriched_at: new Date().toISOString(),
        model: 'eva',
      },
    };
  } catch (error) {
    console.error(`[enrich-leads] Error enriching ${lead.name} with Eva:`, error);
    return null;
  }
}
