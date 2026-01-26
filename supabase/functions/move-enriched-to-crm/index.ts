import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface MoveToCRMRequest {
  itemIds: string[];
}

/**
 * Move enriched leads from enrichment_queue to CRM (companies and people tables)
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { itemIds }: MoveToCRMRequest = await req.json();

    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'itemIds array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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

    // Get user_id from first item
    const userId = items[0].user_id;

    const movedCompanies: string[] = [];
    const movedPeople: string[] = [];
    const errors: string[] = [];

    for (const item of items) {
      try {
        // Create company
        const companyData: any = {
          user_id: userId,
          name: item.name,
          website: item.website || null,
          industry: item.industry || null,
          description: item.description || null,
          general_email: item.email || item.extracted_email || null,
          company_phone: item.phone || null,
          linkedin_url: item.linkedin_url || null,
          enrichment_data: item.enrichment_data || {},
          source: item.source || 'enrichment_queue',
        };

        const { data: company, error: companyError } = await supabase
          .from('companies')
          .insert(companyData)
          .select()
          .single();

        if (companyError) {
          // If company already exists (duplicate), skip or update
          if (companyError.code === '23505') { // Unique violation
            // Try to find existing company
            const { data: existingCompany } = await supabase
              .from('companies')
              .select('id')
              .eq('user_id', userId)
              .eq('name', item.name)
              .single();

            if (existingCompany) {
              movedCompanies.push(existingCompany.id);
              // Update existing company with enrichment data if needed
              await supabase
                .from('companies')
                .update({
                  enrichment_data: item.enrichment_data || {},
                  description: item.description || null,
                })
                .eq('id', existingCompany.id);
            } else {
              throw companyError;
            }
          } else {
            throw companyError;
          }
        } else {
          movedCompanies.push(company.id);
        }

        // If there's an email, create a person/contact
        const email = item.email || item.extracted_email;
        if (email && company) {
          const personData: any = {
            user_id: userId,
            first_name: item.name.split(' ')[0] || 'Contact',
            last_name: item.name.split(' ').slice(1).join(' ') || '',
            email: email,
            company_id: company.id,
            phone: item.phone || null,
            linkedin_url: item.linkedin_url || null,
          };

          const { data: person, error: personError } = await supabase
            .from('people')
            .insert(personData)
            .select()
            .single();

          if (personError) {
            // If person already exists, that's okay
            if (personError.code !== '23505') {
              console.error(`[move-to-crm] Error creating person for ${item.name}:`, personError);
            }
          } else {
            movedPeople.push(person.id);
          }
        }

        // Mark item as moved
        await supabase
          .from('enrichment_queue')
          .update({
            moved_to_crm_at: new Date().toISOString(),
          })
          .eq('id', item.id);

        // Delete from queue (or you can keep it for history)
        await supabase
          .from('enrichment_queue')
          .delete()
          .eq('id', item.id);

      } catch (error: any) {
        console.error(`[move-to-crm] Error moving ${item.name}:`, error);
        errors.push(`${item.name}: ${error.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        moved: movedCompanies.length,
        companiesCreated: movedCompanies.length,
        peopleCreated: movedPeople.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[move-to-crm] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
