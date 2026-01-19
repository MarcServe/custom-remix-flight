import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface EnrichmentResult {
  leadId: string;
  companyName: string;
  success: boolean;
  error?: string;
}

/**
 * Enrich autonomous leads with Perplexity AI research
 * This function is specifically for Google Maps Scraper / Apify leads that come with minimal data
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[enrich-autonomous-leads] Starting enrichment');

  try {
    const { leadIds, mode = 'deep' } = await req.json();

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Lead IDs are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
    if (!PERPLEXITY_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'PERPLEXITY_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[enrich-autonomous-leads] Processing ${leadIds.length} leads in ${mode} mode`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch leads
    const { data: leads, error: fetchError } = await supabase
      .from('autonomous_leads')
      .select('id, company_name, company_website, company_data, industry, geography')
      .in('id', leadIds);

    if (fetchError) {
      throw new Error(`Failed to fetch leads: ${fetchError.message}`);
    }

    if (!leads || leads.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No leads found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create SSE response for progress streaming
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        };

        const results: EnrichmentResult[] = [];
        let successCount = 0;
        let failedCount = 0;

        // Process leads in batches to avoid rate limits
        const BATCH_SIZE = 3;
        
        for (let i = 0; i < leads.length; i += BATCH_SIZE) {
          const batch = leads.slice(i, i + BATCH_SIZE);
          
          const batchPromises = batch.map(async (lead, batchIndex) => {
            const globalIndex = i + batchIndex;
            
            // Send progress
            send({
              type: 'progress',
              current: globalIndex + 1,
              total: leads.length,
              companyName: lead.company_name,
            });

            try {
              const enrichedData = await enrichLeadWithPerplexity(
                lead,
                PERPLEXITY_API_KEY,
                mode
              );

              if (enrichedData) {
                // Merge enriched data with existing company_data
                const existingData = (lead.company_data || {}) as Record<string, any>;
                const mergedData = {
                  ...existingData,
                  ...enrichedData,
                  wasEnriched: true,
                  enrichmentTier: mode,
                  enrichedAt: new Date().toISOString(),
                };

                // Update the lead
                const { error: updateError } = await supabase
                  .from('autonomous_leads')
                  .update({
                    company_data: mergedData,
                    enrichment_data: enrichedData.enrichment_data || mergedData,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', lead.id);

                if (updateError) {
                  throw updateError;
                }

                successCount++;
                send({
                  type: 'enriched',
                  leadId: lead.id,
                  companyName: lead.company_name,
                  hasDescription: !!enrichedData.description,
                  hasSocials: Object.keys(enrichedData.socialProfiles || {}).length > 0,
                  hasContacts: (enrichedData.keyExecutives || []).length > 0,
                });

                results.push({
                  leadId: lead.id,
                  companyName: lead.company_name,
                  success: true,
                });
              } else {
                failedCount++;
                send({
                  type: 'failed',
                  leadId: lead.id,
                  companyName: lead.company_name,
                  error: 'No enrichment data returned',
                });
                results.push({
                  leadId: lead.id,
                  companyName: lead.company_name,
                  success: false,
                  error: 'No enrichment data returned',
                });
              }
            } catch (error) {
              failedCount++;
              const errorMsg = error instanceof Error ? error.message : 'Unknown error';
              send({
                type: 'failed',
                leadId: lead.id,
                companyName: lead.company_name,
                error: errorMsg,
              });
              results.push({
                leadId: lead.id,
                companyName: lead.company_name,
                success: false,
                error: errorMsg,
              });
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
          results,
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
    console.error('[enrich-autonomous-leads] Error:', error);
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
  apiKey: string,
  mode: string
): Promise<any> {
  const companyIdentifier = lead.company_website
    ? `${lead.company_name} (${lead.company_website})`
    : lead.company_name;

  const structuredPrompt = `Research the company "${companyIdentifier}" and return ONLY a valid JSON object with the following structure. Do not include any text before or after the JSON.

{
  "description": "Detailed company description (200+ characters). What they do, their mission, main business.",
  "products": "Main products or services offered, separated by commas",
  "recentNews": "Any recent news, funding, or announcements from 2024-2025. Say 'No recent news found' if none.",
  "fundingInfo": "Funding stage, amount raised, or investors if known. Say 'Not available' if unknown.",
  "employeeCount": 0,
  "companyPhone": "Main phone number or null",
  "generalEmail": "General contact email or null",
  "suggestedTags": ["industry tag", "category tag", "specialty tag"],
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
  "technologies": "Key technologies used, separated by commas"
}

Important: 
- Return ONLY valid JSON, no markdown code blocks
- Use null for unknown fields, not empty strings
- Include 3-5 relevant industry/category tags in suggestedTags
- Find at least 2-3 key executives if possible (CEO, Founder, etc.)
- Search thoroughly for social media profiles`;

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
            content: 'You are a business research assistant. Return only valid JSON, no explanations or markdown. Search thoroughly for company information.'
          },
          {
            role: 'user',
            content: structuredPrompt
          }
        ],
      }),
    });

    if (!response.ok) {
      console.error(`[enrich-autonomous-leads] Perplexity API error for ${lead.company_name}: ${response.status}`);
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
      console.error(`[enrich-autonomous-leads] Failed to parse JSON for ${lead.company_name}:`, parseError);
      return {
        enrichment_data: {
          perplexity_summary: content,
          enriched_at: new Date().toISOString(),
          citations: data.citations,
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
      employeeCount: parsed.employeeCount,
      companyPhone: parsed.companyPhone,
      generalEmail: parsed.generalEmail,
      technologies: parsed.technologies,
      suggestedTags: parsed.suggestedTags || [],
      socialProfiles: cleanedSocials,
      keyExecutives: parsed.keyExecutives || [],
      enrichment_data: {
        ...parsed,
        perplexity_summary: parsed.description,
        enriched_at: new Date().toISOString(),
        citations: data.citations,
        model: 'sonar',
      },
    };
  } catch (error) {
    console.error(`[enrich-autonomous-leads] Error enriching ${lead.company_name}:`, error);
    return null;
  }
}
