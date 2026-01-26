import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface BatchEnrichRequest {
  itemIds: string[];
  provider?: 'perplexity' | 'exa';
}

/**
 * Batch enrich leads from enrichment_queue using Perplexity or Exa
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { itemIds, provider = 'perplexity' }: BatchEnrichRequest = await req.json();

    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'itemIds array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
    const EXA_API_KEY = Deno.env.get("EXA_API_KEY");

    if (provider === 'perplexity' && !PERPLEXITY_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'PERPLEXITY_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch items from queue
    const { data: items, error: fetchError } = await supabase
      .from('enrichment_queue')
      .select('*')
      .in('id', itemIds);

    if (fetchError) throw fetchError;
    if (!items || items.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No items found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update status to enriching
    await supabase
      .from('enrichment_queue')
      .update({ enrichment_status: 'enriching', enrichment_provider: provider })
      .in('id', itemIds);

    const enrichedResults: any[] = [];
    const errors: string[] = [];

    // Process each item
    for (const item of items) {
      try {
        // Call existing enrich-leads function for each item
        const enrichResponse = await fetch(`${SUPABASE_URL}/functions/v1/enrich-leads`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            leads: [{
              name: item.name,
              website: item.website,
              industry: item.industry,
              geography: item.geography,
            }],
            provider,
          }),
        });

        if (!enrichResponse.ok) {
          throw new Error(`Enrichment failed: ${enrichResponse.statusText}`);
        }

        const enrichData = await enrichResponse.json();
        
        if (enrichData.success && enrichData.enriched && enrichData.enriched.length > 0) {
          const enriched = enrichData.enriched[0];
          
          // Update item with enrichment data
          const { error: updateError } = await supabase
            .from('enrichment_queue')
            .update({
              enrichment_status: 'enriched',
              enrichment_data: enriched.enrichment_data || enriched,
              description: enriched.description || item.description,
              industry: enriched.industry || item.industry,
              geography: enriched.geography || item.geography,
              linkedin_url: enriched.linkedin_url || enriched.socialProfiles?.linkedin || item.linkedin_url,
              phone: enriched.phone || item.phone,
              enriched_at: new Date().toISOString(),
              enrichment_errors: null,
            })
            .eq('id', item.id);

          if (updateError) throw updateError;
          enrichedResults.push({ id: item.id, name: item.name });
        } else {
          throw new Error(enrichData.error || 'Enrichment returned no data');
        }
      } catch (error: any) {
        console.error(`[batch-enrich] Error enriching ${item.name}:`, error);
        errors.push(`${item.name}: ${error.message}`);
        
        // Update item with error
        await supabase
          .from('enrichment_queue')
          .update({
            enrichment_status: 'failed',
            enrichment_errors: [error.message],
          })
          .eq('id', item.id);
      }

      // Rate limiting: wait between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return new Response(
      JSON.stringify({
        success: true,
        enriched: enrichedResults.length,
        failed: errors.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[batch-enrich] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
