import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Contact {
  name: string;
  email?: string;
  emailVerified?: boolean;
  linkedinUrl?: string;
  title?: string;
  department?: string;
  phone?: string;
}

interface FindContactsRequest {
  companies: Array<{
    name: string;
    website?: string;
    domain?: string;
  }>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { companies } = await req.json() as FindContactsRequest;
    
    if (!companies || companies.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No companies provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const GETPROSPECT_API_KEY = Deno.env.get('GETPROSPECT_API_KEY');
    
    if (!GETPROSPECT_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'GetProspect API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: Record<string, Contact[]> = {};
    let totalFound = 0;

    for (const company of companies) {
      console.log(`Finding contacts for: ${company.name}`);
      
      // Extract domain from website if not provided
      let domain = company.domain;
      if (!domain && company.website) {
        try {
          const url = new URL(company.website.startsWith('http') ? company.website : `https://${company.website}`);
          domain = url.hostname.replace('www.', '');
        } catch (e) {
          console.error(`Failed to parse domain from ${company.website}:`, e);
          continue;
        }
      }

      if (!domain) {
        console.log(`No domain available for ${company.name}`);
        continue;
      }

      try {
        // Search for people at the company domain
        const searchResponse = await fetch(
          `https://api.getprospect.com/public/v1/people/search`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Api-Key': GETPROSPECT_API_KEY,
            },
            body: JSON.stringify({
              domain: domain,
              limit: 10, // Get up to 10 contacts per company
            }),
          }
        );

        if (!searchResponse.ok) {
          console.error(`GetProspect API error for ${company.name}:`, searchResponse.status);
          continue;
        }

        const searchData = await searchResponse.json();
        const contacts: Contact[] = [];

        if (searchData.data && Array.isArray(searchData.data)) {
          for (const person of searchData.data) {
            const contact: Contact = {
              name: `${person.first_name || ''} ${person.last_name || ''}`.trim(),
              email: person.email,
              emailVerified: person.email_status === 'valid',
              linkedinUrl: person.linkedin_url,
              title: person.title,
              phone: person.phone_number,
            };

            // Only add if we have at least a name
            if (contact.name) {
              contacts.push(contact);
            }
          }
        }

        results[company.name] = contacts;
        totalFound += contacts.length;
        
        console.log(`Found ${contacts.length} contacts for ${company.name}`);
      } catch (error) {
        console.error(`Error finding contacts for ${company.name}:`, error);
      }

      // Rate limiting - wait 100ms between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`Total contacts found: ${totalFound} across ${Object.keys(results).length} companies`);

    return new Response(
      JSON.stringify({
        results,
        totalCompanies: companies.length,
        companiesWithContacts: Object.keys(results).length,
        totalContactsFound: totalFound,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('Error in find-additional-contacts:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
