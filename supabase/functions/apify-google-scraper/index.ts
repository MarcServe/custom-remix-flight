import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ScraperRequest {
  query: string;
  location: string;
  maxResults?: number;
  scrapeEmails?: boolean;
}

interface ScrapedLead {
  name: string;
  website?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  rating?: number;
  reviews?: number;
  category?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify auth
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

    const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN");
    if (!APIFY_API_TOKEN) {
      return new Response(
        JSON.stringify({ error: "APIFY_API_TOKEN not configured. Please add it in Supabase secrets." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: ScraperRequest = await req.json();
    const { query, location, maxResults = 100, scrapeEmails = true } = body;

    if (!query || !location) {
      return new Response(
        JSON.stringify({ error: "Query and location are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Starting Apify scrape: "${query}" in "${location}", max ${maxResults} results`);

    // Use Google Maps Scraper actor
    const actorId = "nwua9Gu5YrADL7ZDj"; // Google Maps Scraper
    const actorRunUrl = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items`;

    const searchString = `${query} in ${location}`;
    
    const apifyResponse = await fetch(`${actorRunUrl}?token=${APIFY_API_TOKEN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        searchStringsArray: [searchString],
        maxCrawledPlacesPerSearch: Math.min(maxResults, 300),
        language: "en",
        maxImages: 0,
        maxReviews: 0,
        scrapeReviewerName: false,
        scrapeReviewerId: false,
        scrapeReviewerUrl: false,
        scrapeReviewId: false,
        scrapeReviewUrl: false,
        scrapeResponseFromOwnerText: false,
        // Extended scraping for more data
        includeWebResults: false,
        includeHistogram: false,
        includeOpeningHours: false,
        includePeopleAlsoSearch: false,
      }),
    });

    if (!apifyResponse.ok) {
      const errorText = await apifyResponse.text();
      console.error("Apify API error:", errorText);
      return new Response(
        JSON.stringify({ error: `Apify API error: ${apifyResponse.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const places = await apifyResponse.json();
    console.log(`Apify returned ${places.length} results`);

    // Transform to our lead format
    const leads: ScrapedLead[] = [];

    for (const place of places) {
      const lead: ScrapedLead = {
        name: place.title || place.name || "",
        website: place.website || place.url || undefined,
        phone: place.phone || undefined,
        address: place.address || place.street || undefined,
        city: place.city || undefined,
        rating: place.totalScore || undefined,
        reviews: place.reviewsCount || undefined,
        category: place.categoryName || (place.categories?.[0]) || undefined,
      };

      // Try to extract email from website if enabled
      if (scrapeEmails && lead.website && !lead.email) {
        try {
          const emailResult = await extractEmailFromWebsite(lead.website);
          if (emailResult) {
            lead.email = emailResult;
          }
        } catch (e) {
          // Ignore email extraction errors
        }
      }

      if (lead.name) {
        leads.push(lead);
      }
    }

    console.log(`Processed ${leads.length} leads, ${leads.filter(l => l.email).length} with emails`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        leads,
        stats: {
          total: leads.length,
          withEmail: leads.filter(l => l.email).length,
          withPhone: leads.filter(l => l.phone).length,
          withWebsite: leads.filter(l => l.website).length,
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Scraper error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Extract email from website by fetching and parsing HTML
 */
async function extractEmailFromWebsite(websiteUrl: string): Promise<string | null> {
  try {
    const url = websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`;
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    clearTimeout(timeout);

    if (!response.ok) return null;

    const html = await response.text();
    
    // Email regex patterns
    const emailPatterns = [
      /mailto:([^\s"'>]+@[^\s"'>]+\.[^\s"'>]+)/gi,
      /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g,
    ];

    const foundEmails = new Set<string>();

    for (const pattern of emailPatterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        const email = match[1].toLowerCase().replace(/[<>"']/g, "");
        // Filter out common non-business emails
        if (
          !email.includes("example.com") &&
          !email.includes("wixpress.com") &&
          !email.includes("sentry.io") &&
          !email.endsWith(".png") &&
          !email.endsWith(".jpg") &&
          email.length < 100
        ) {
          foundEmails.add(email);
        }
      }
    }

    // Prioritize info@, contact@, hello@, etc.
    const priorityPrefixes = ["info", "contact", "hello", "sales", "support", "admin"];
    for (const prefix of priorityPrefixes) {
      for (const email of foundEmails) {
        if (email.startsWith(prefix + "@")) {
          return email;
        }
      }
    }

    // Return first found email
    return foundEmails.size > 0 ? Array.from(foundEmails)[0] : null;
  } catch {
    return null;
  }
}
