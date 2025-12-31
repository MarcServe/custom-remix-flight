import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createTrace, createSpan, endSpan } from '../_shared/langfuse.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Helper: Deduplication by URL and normalized company name
function deduplicateResults(results: any[]): any[] {
  const seen = new Map<string, any>();
  
  return results.filter(result => {
    if (!result.url && !result.title) return false;
    
    let key = '';
    if (result.url) {
      try {
        const url = new URL(result.url);
        key = url.hostname.replace('www.', '') + url.pathname.replace(/\/$/, '');
      } catch {
        key = result.url.toLowerCase();
      }
    } else if (result.title) {
      key = result.title
        .toLowerCase()
        .replace(/\b(inc|llc|ltd|corp|corporation|limited|company|co)\b\.?/g, '')
        .replace(/[^\w\s]/g, '')
        .trim();
    }
    
    if (seen.has(key)) {
      const existing = seen.get(key);
      const existingLength = (existing.text || '').length;
      const currentLength = (result.text || '').length;
      
      if (currentLength > existingLength) {
        seen.set(key, result);
        return false;
      }
      return false;
    }
    
    seen.set(key, result);
    return true;
  });
}

// Helper: Calculate data completeness score
const calculateDataCompleteness = (lead: any) => {
  let score = 0;
  if (lead.website) score += 3;
  if (lead.linkedinUrl) score += 2;
  if (lead.description && lead.description.length > 50) score += 2;
  if (lead.companyPhone) score += 1;
  if (lead.generalEmail) score += 1;
  if (lead.keyExecutives && lead.keyExecutives.length > 0) score += 2;
  return score;
};

// Helper: Calculate final quality score
const calculateFinalQualityScore = (lead: any) => {
  let score = 0;
  
  // Core data (max 35)
  if (lead.website) score += 15;
  if (lead.linkedinUrl) score += 10;
  if (lead.description && lead.description.length > 50) score += 10;
  
  // Direct contact info - HIGHLY VALUABLE (max 30)
  if (lead.companyPhone) score += 15; // Increased - direct phone is valuable
  if (lead.generalEmail) score += 10; // Increased - direct email is valuable
  if (lead.address) score += 5; // Physical address
  
  // Contacts (max 20)
  if (lead.contacts && lead.contacts.length > 0) {
    score += 10;
    if (lead.contacts.some((c: any) => c.emailVerified)) score += 5;
    if (lead.contacts.length > 1) score += 5;
  }
  
  // Enrichment (max 15)
  if (lead.keyExecutives && lead.keyExecutives.length > 0) score += 3;
  if (lead.recentNews) score += 2;
  if (lead.fundingInfo) score += 2;
  if (lead.socialProfiles && Object.keys(lead.socialProfiles).length > 0) score += 3;
  if (lead.products) score += 2;
  if (lead.technologies) score += 3;
  
  return Math.min(score, 100);
};

// Helper: Deduplicate leads by name/domain
const deduplicateLeads = (leads: any[]) => {
  const seen = new Map();
  
  return leads.filter(lead => {
    if (!lead.name) return false;
    
    const normalizedName = lead.name.toLowerCase()
      .replace(/\b(inc|llc|ltd|corp|corporation|limited|company|co)\b\.?/g, '')
      .replace(/[^\w\s]/g, '')
      .trim();
    
    let domain = null;
    if (lead.website) {
      try {
        const url = new URL(lead.website.startsWith('http') ? lead.website : `https://${lead.website}`);
        domain = url.hostname.replace('www.', '');
      } catch {}
    }
    
    const key = domain || normalizedName;
    
    if (seen.has(key)) {
      const existing = seen.get(key);
      const existingScore = calculateDataCompleteness(existing);
      const currentScore = calculateDataCompleteness(lead);
      
      if (currentScore > existingScore) {
        seen.set(key, lead);
        return false;
      }
      return false;
    }
    
    seen.set(key, lead);
    return true;
  });
};

// Helper: Enrich batch with Perplexity (original synchronous version)
async function enrichBatch(leads: any[], supabaseUrl: string, supabaseAnonKey: string, traceId: string) {
  const needsBasic = leads.filter(l => !l.website || !l.description || l.description.length < 30);
  const needsDeep = leads.filter(l => l.qualityScore >= 50 && !needsBasic.includes(l));

  for (const lead of needsBasic) {
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/ai-provider`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${supabaseAnonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'perplexity',
          model: 'sonar-small',
          messages: [
            { role: 'system', content: 'Return only valid JSON, no markdown.' },
            { role: 'user', content: `Quick facts about ${lead.name}${lead.website ? ` (${lead.website})` : ''}: Return JSON with: website, description, employeeCount, generalEmail, socialProfiles (object with linkedin, twitter, facebook, instagram, youtube, tiktok URLs - check website footer and about page)` },
          ],
          temperature: 0.2,
          traceId,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        try {
          const cleaned = result.content.trim().replace(/```json\n?/g, "").replace(/```\n?/g, "");
          const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const enrichedData = JSON.parse(jsonMatch[0]);
            lead.website = enrichedData.website || lead.website;
            lead.description = enrichedData.description || lead.description;
            lead.employeeCount = enrichedData.employeeCount || lead.employeeCount;
            lead.generalEmail = enrichedData.generalEmail || lead.generalEmail;
            // Merge social profiles from basic enrichment
            if (enrichedData.socialProfiles) {
              lead.socialProfiles = { ...lead.socialProfiles, ...enrichedData.socialProfiles };
            }
            lead.enrichmentTier = 'basic';
          }
        } catch {}
      }
    } catch (error) {
      console.error("Basic enrichment error:", lead.name);
    }
  }

  for (const lead of needsDeep.slice(0, 3)) { // Limit deep enrichment to 3 per batch
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/ai-provider`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${supabaseAnonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'perplexity',
          model: 'sonar',
          messages: [
            { role: 'system', content: 'Return only valid JSON, no markdown.' },
            { role: 'user', content: `Detailed research on ${lead.name}${lead.website ? ` (${lead.website})` : ''}: Return JSON with: description, products, recentNews, fundingInfo, employeeCount, companyPhone, generalEmail, keyExecutives, technologies, and socialProfiles object containing ALL social media URLs (linkedin, twitter/x.com, facebook, instagram, youtube, tiktok) - search the company website footer, contact page, and about page for these links` },
          ],
          temperature: 0.2,
          traceId,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        try {
          const cleaned = result.content.trim().replace(/```json\n?/g, "").replace(/```\n?/g, "");
          const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const enrichedData = JSON.parse(jsonMatch[0]);
            Object.assign(lead, {
              description: enrichedData.description || lead.description,
              products: enrichedData.products || lead.products,
              recentNews: enrichedData.recentNews || lead.recentNews,
              fundingInfo: enrichedData.fundingInfo || lead.fundingInfo,
              enrichmentTier: 'deep',
            });
          }
        } catch {}
      }
    } catch (error) {
      console.error("Deep enrichment error:", lead.name);
    }
  }
}

// PHASE 2: Progressive enrichment with streaming updates
async function enrichBatchProgressively(
  leads: any[],
  supabaseUrl: string,
  supabaseAnonKey: string,
  traceId: string,
  batchNumber: number,
  sendEvent: (data: any) => Promise<void>,
  supabase: any,
  searchId: string
) {
  const needsBasic = leads.filter(l => !l.website || !l.description || l.description.length < 30);
  const needsDeep = leads.filter(l => l.qualityScore >= 50 && !needsBasic.includes(l));

  // Enrich leads that need basic enrichment
  for (let i = 0; i < needsBasic.length; i++) {
    const lead = needsBasic[i];
    
    try {
      lead.enrichmentStatus = 'enriching';
      await sendEvent({
        type: 'enrichment-status',
        leadName: lead.name,
        leadIndex: i,
        totalLeads: needsBasic.length,
        batchNumber,
        status: 'enriching',
        message: `Enriching ${lead.name} (${i + 1}/${needsBasic.length})...`
      });

      const response = await fetch(`${supabaseUrl}/functions/v1/ai-provider`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${supabaseAnonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'perplexity',
          model: 'sonar-small',
          messages: [
            { role: 'system', content: 'Return only valid JSON with company information, no markdown or explanations.' },
            { role: 'user', content: `Quick research on ${lead.name}${lead.website ? ` (${lead.website})` : ''}. Return JSON with: website, description (100+ chars), employeeCount, foundingYear, revenue, generalEmail, companyPhone, socialProfiles (object with linkedin, twitter, facebook, instagram, youtube, tiktok URLs - check website footer and about page for social links)` },
          ],
          temperature: 0.2,
          traceId,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        try {
          const cleaned = result.content.trim().replace(/```json\n?/g, "").replace(/```\n?/g, "");
          const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const enrichedData = JSON.parse(jsonMatch[0]);
            lead.website = enrichedData.website || lead.website;
            lead.description = enrichedData.description || lead.description;
            lead.employeeCount = enrichedData.employeeCount || lead.employeeCount;
            lead.foundingYear = enrichedData.foundingYear || lead.foundingYear;
            lead.revenue = enrichedData.revenue || lead.revenue;
            lead.generalEmail = enrichedData.generalEmail || lead.generalEmail;
            lead.companyPhone = enrichedData.companyPhone || lead.companyPhone;
            // Merge social profiles from basic enrichment
            if (enrichedData.socialProfiles) {
              lead.socialProfiles = { ...lead.socialProfiles, ...enrichedData.socialProfiles };
            }
            lead.enrichmentTier = 'basic';
            lead.wasEnriched = true;
          }
        } catch {}
      }

      // Recalculate scores after enrichment
      lead.qualityScore = calculateFinalQualityScore(lead);
      lead.dataCompleteness = calculateDataCompleteness(lead);
      lead.enrichmentStatus = 'completed';

      // Update lead in database
      await supabase
        .from('lead_finder_leads')
        .update({
          company_data: lead,
          enrichment_status: 'enriched'
        })
        .eq('search_id', searchId)
        .eq('company_data->>name', lead.name);

      // Stream the enriched lead update
      await sendEvent({
        type: 'lead-update',
        lead: lead,
        updateType: 'enrichment',
        batchNumber
      });
    } catch (error) {
      console.error(`Basic enrichment error for ${lead.name}:`, error);
      lead.enrichmentStatus = 'completed';
    }
  }

  // Deep enrichment for high-quality leads
  const deepEnrichmentLeads = needsDeep.slice(0, 3); // Limit to 3 per batch
  for (let i = 0; i < deepEnrichmentLeads.length; i++) {
    const lead = deepEnrichmentLeads[i];
    
    try {
      lead.enrichmentStatus = 'enriching';
      await sendEvent({
        type: 'enrichment-status',
        leadName: lead.name,
        leadIndex: i,
        totalLeads: deepEnrichmentLeads.length,
        batchNumber,
        status: 'deep-enriching',
        message: `Deep enriching ${lead.name} (${i + 1}/${deepEnrichmentLeads.length})...`
      });

      const response = await fetch(`${supabaseUrl}/functions/v1/ai-provider`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${supabaseAnonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'perplexity',
          model: 'sonar',
          messages: [
            { role: 'system', content: 'You are a business intelligence researcher. Return only valid JSON with comprehensive company data, no markdown or explanations.' },
            { role: 'user', content: `Deep research on ${lead.name}${lead.website ? ` (${lead.website})` : ''}:

Extract ALL available information and return as JSON with these fields:
- description: Comprehensive company overview (200+ characters)
- products: Detailed list of main products and services
- recentNews: Latest news, product launches, funding announcements (2024-2025)
- fundingInfo: Total funding raised, recent rounds, investors, valuation
- employeeCount: Current number of employees
- foundingYear: Year company was established
- revenue: Annual revenue or revenue range
- companyPhone: Main contact phone number
- generalEmail: General inquiry email address
- socialProfiles: Object with ALL 6 social media URLs - IMPORTANT, search thoroughly:
  * linkedin: Company LinkedIn page (linkedin.com/company/...)
  * twitter: X/Twitter profile (twitter.com/... or x.com/...)
  * facebook: Facebook business page (facebook.com/...)
  * instagram: Instagram profile (instagram.com/...)
  * youtube: YouTube channel (youtube.com/...)
  * tiktok: TikTok profile (tiktok.com/@...)
  Check company website footer, about page, contact page, and press releases for social links.
- keyExecutives: Array of executives with {name, title} for C-suite and VPs
- technologies: Array of key technologies, platforms, or tools the company uses or builds

Be thorough and accurate. Extract from recent sources.` },
          ],
          temperature: 0.2,
          traceId,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        try {
          const cleaned = result.content.trim().replace(/```json\n?/g, "").replace(/```\n?/g, "");
          const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const enrichedData = JSON.parse(jsonMatch[0]);
            Object.assign(lead, {
              description: enrichedData.description || lead.description,
              products: enrichedData.products || lead.products,
              recentNews: enrichedData.recentNews || lead.recentNews,
              fundingInfo: enrichedData.fundingInfo || lead.fundingInfo,
              employeeCount: enrichedData.employeeCount || lead.employeeCount,
              foundingYear: enrichedData.foundingYear || lead.foundingYear,
              revenue: enrichedData.revenue || lead.revenue,
              companyPhone: enrichedData.companyPhone || lead.companyPhone,
              generalEmail: enrichedData.generalEmail || lead.generalEmail,
              socialProfiles: enrichedData.socialProfiles || lead.socialProfiles,
              keyExecutives: enrichedData.keyExecutives || lead.keyExecutives,
              technologies: enrichedData.technologies || lead.technologies,
              enrichmentTier: 'deep',
              wasEnriched: true,
            });
          }
        } catch {}
      }

      // Recalculate scores after deep enrichment
      lead.qualityScore = calculateFinalQualityScore(lead);
      lead.dataCompleteness = calculateDataCompleteness(lead);
      lead.enrichmentStatus = 'completed';

      // Update lead in database
      await supabase
        .from('lead_finder_leads')
        .update({
          company_data: lead,
          enrichment_status: 'enriched'
        })
        .eq('search_id', searchId)
        .eq('company_data->>name', lead.name);

      // Stream the deep-enriched lead update
      await sendEvent({
        type: 'lead-update',
        lead: lead,
        updateType: 'deep-enrichment',
        batchNumber
      });
    } catch (error) {
      console.error(`Deep enrichment error for ${lead.name}:`, error);
      lead.enrichmentStatus = 'completed';
    }
  }

  console.log(`Enrichment complete for batch ${batchNumber}`);
}

// PHASE 3: Progressive contact finding with streaming updates
async function findContactsProgressively(
  leads: any[],
  getProspectKey: string,
  supabaseUrl: string,
  supabaseAnonKey: string,
  traceId: string,
  batchNumber: number,
  sendEvent: (data: any) => Promise<void>,
  supabase: any,
  searchId: string
) {
  const targetRoles = ['CEO', 'CTO', 'CMO', 'Founder', 'Co-Founder'];

  for (let leadIndex = 0; leadIndex < leads.length; leadIndex++) {
    const lead = leads[leadIndex];
    const contacts: any[] = [];
    
    try {
      lead.contactSearchStatus = 'searching';
      await sendEvent({
        type: 'contact-status',
        leadName: lead.name,
        leadIndex,
        totalLeads: leads.length,
        batchNumber,
        status: 'searching',
        message: `Finding contacts for ${lead.name} (${leadIndex + 1}/${leads.length})...`
      });

      // Try GetProspect LinkedIn
      if (lead.linkedinUrl && contacts.length < 2) {
        try {
          const response = await fetch(
            `https://api.getprospect.com/public/v1/insights/contact?linkedinUrl=${encodeURIComponent(lead.linkedinUrl)}&apiKey=${getProspectKey}`,
            { signal: AbortSignal.timeout(4000) }
          );
          
          if (response.ok) {
            const data = await response.json();
            if (data.contacts) {
              contacts.push(...data.contacts.slice(0, 2).map((c: any) => ({
                name: c.name,
                email: c.email,
                emailVerified: c.emailStatus === 'valid',
                title: c.title,
                companyName: lead.name,
                source: 'getprospect'
              })));
            }
          }
        } catch {}
      }

      // Try GetProspect by role
      if (contacts.length < 2) {
        for (const role of targetRoles.slice(0, 3)) {
          if (contacts.length >= 2) break;
          try {
            const response = await fetch(
              `https://api.getprospect.com/public/v1/email/find?name=${encodeURIComponent(role)}&company=${encodeURIComponent(lead.name)}&apiKey=${getProspectKey}`,
              { signal: AbortSignal.timeout(3000) }
            );
            if (response.ok) {
              const data = await response.json();
              if (data.email) {
                contacts.push({
                  name: data.name || role,
                  email: data.email,
                  emailVerified: false,
                  title: role,
                  companyName: lead.name,
                  source: 'getprospect'
                });
              }
            }
          } catch {}
        }
      }

      // Pattern-based fallback
      if (contacts.length === 0 && lead.website && lead.keyExecutives?.length > 0) {
        const exec = lead.keyExecutives[0];
        const nameParts = exec.name.split(' ');
        if (nameParts.length >= 2) {
          try {
            const url = new URL(lead.website.startsWith('http') ? lead.website : `https://${lead.website}`);
            const domain = url.hostname.replace('www.', '');
            const email = `${nameParts[0]}.${nameParts[nameParts.length - 1]}@${domain}`.toLowerCase();
            contacts.push({
              name: exec.name,
              email,
              emailVerified: false,
              title: exec.title,
              companyName: lead.name,
              source: 'pattern-guess',
              note: 'Email pattern generated - not verified'
            });
          } catch {}
        }
      }
    } catch (error) {
      console.error(`Contact error for ${lead.name}:`, error);
    }

    lead.contacts = contacts;
    lead.primaryContact = contacts.find(c => c.emailVerified) || contacts[0] || null;
    lead.contactCount = contacts.length;
    lead.contactSearchStatus = contacts.length > 0 ? 'completed' : 'no-contacts';

    // Recalculate quality score with contacts
    lead.qualityScore = calculateFinalQualityScore(lead);

    // Update lead in database
    await supabase
      .from('lead_finder_leads')
      .update({
        company_data: lead,
        contact_status: contacts.length > 0 ? 'found' : 'none'
      })
      .eq('search_id', searchId)
      .eq('company_data->>name', lead.name);

    // Stream the contact update
    await sendEvent({
      type: 'lead-update',
      lead: lead,
      updateType: 'contacts',
      batchNumber
    });
  }

  console.log(`Contact finding complete for batch ${batchNumber}`);
}

// Apify search function for extended local business data
async function searchWithApify(
  query: string,
  geography: string,
  industry: string,
  traceId: string
): Promise<any[]> {
  const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN");
  if (!APIFY_API_TOKEN) {
    console.log("APIFY_API_TOKEN not configured, skipping Apify search");
    return [];
  }

  const results: any[] = [];

  try {
    // Use Apify's Google Maps Scraper actor
    const searchQuery = `${industry} ${geography} ${query}`.trim();
    console.log(`Apify search query: "${searchQuery}"`);

    const actorRunUrl = "https://api.apify.com/v2/acts/nwua9Gu5YrADL7ZDj/run-sync-get-dataset-items";
    
    const response = await fetch(`${actorRunUrl}?token=${APIFY_API_TOKEN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        searchStringsArray: [searchQuery],
        maxCrawledPlacesPerSearch: 50, // Increased from 20 for more results
        language: "en",
        maxImages: 0,
        maxReviews: 0,
        scrapeReviewerName: false,
        scrapeReviewerId: false,
        scrapeReviewerUrl: false,
        scrapeReviewId: false,
        scrapeReviewUrl: false,
        scrapeResponseFromOwnerText: false,
      }),
    });

    if (response.ok) {
      const places = await response.json();
      console.log(`Apify found ${places.length} results`);

      for (const place of places) {
        if (place.title || place.name) {
          results.push({
            url: place.website || place.url,
            title: place.title || place.name,
            text: place.description || place.categoryName || '',
            source: 'apify',
            // Business data from Apify
            address: place.address || place.street,
            phone: place.phone,
            rating: place.totalScore,
            reviews: place.reviewsCount,
            hours: place.openingHours?.join(', '),
            place_id: place.placeId,
            categories: place.categories,
            city: place.city,
            postalCode: place.postalCode,
            countryCode: place.countryCode,
          });
        }
      }
    } else {
      const errorText = await response.text();
      console.error(`Apify API error: ${response.status} - ${errorText}`);
    }
  } catch (error) {
    console.error("Apify search error:", error);
  }

  return results;
}

// ============= PHASE 1: Crawl4AI-Style Website Scraping =============

// Helper: Extract emails from HTML using RFC 5322-like pattern
function extractEmailsFromHtml(html: string): string[] {
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
  const matches = html.match(emailPattern) || [];
  
  // Filter out false positives (image files, CSS, JS assets, common non-emails)
  const excludePatterns = /\.(png|jpg|jpeg|gif|svg|css|js|woff|woff2|ttf|ico|webp)$/i;
  const excludeDomains = /(example\.com|domain\.com|email\.com|yourcompany\.com|test\.com|sentry\.io|cloudflare|w3\.org)/i;
  
  const validEmails = matches
    .filter(email => !excludePatterns.test(email))
    .filter(email => !excludeDomains.test(email))
    .filter(email => email.length < 50) // Reasonable email length
    .map(email => email.toLowerCase());
  
  // Deduplicate and prioritize business emails
  const unique = [...new Set(validEmails)];
  
  // Sort to prioritize contact/info emails
  return unique.sort((a, b) => {
    const priorityPrefixes = ['contact', 'info', 'hello', 'sales', 'support', 'enquiries', 'enquiry', 'admin'];
    const aPrefix = a.split('@')[0];
    const bPrefix = b.split('@')[0];
    const aPriority = priorityPrefixes.findIndex(p => aPrefix.includes(p));
    const bPriority = priorityPrefixes.findIndex(p => bPrefix.includes(p));
    if (aPriority !== -1 && bPriority === -1) return -1;
    if (bPriority !== -1 && aPriority === -1) return 1;
    if (aPriority !== -1 && bPriority !== -1) return aPriority - bPriority;
    return 0;
  });
}

// Helper: Extract phone numbers from HTML
function extractPhonesFromHtml(html: string): string[] {
  const phonePatterns = [
    // US format: (xxx) xxx-xxxx, xxx-xxx-xxxx, xxx.xxx.xxxx
    /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
    // International with +: +1 xxx xxx xxxx, +44 xxxx xxxxxx
    /\+\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g,
    // UK format: 0xxxx xxxxxx
    /0\d{4}[-.\s]?\d{6}/g,
  ];
  
  const allMatches: string[] = [];
  
  for (const pattern of phonePatterns) {
    const matches = html.match(pattern) || [];
    allMatches.push(...matches);
  }
  
  // Clean and deduplicate
  const cleaned = allMatches
    .map(phone => phone.replace(/\s+/g, ' ').trim())
    .filter(phone => phone.length >= 10 && phone.length <= 20);
  
  return [...new Set(cleaned)];
}

// Helper: Extract social media profile URLs from HTML
function extractSocialProfilesFromHtml(html: string): Record<string, string> {
  const socialPatterns: Record<string, RegExp> = {
    linkedin: /https?:\/\/(www\.)?linkedin\.com\/company\/[a-zA-Z0-9_-]+\/?/gi,
    twitter: /https?:\/\/(www\.)?(twitter\.com|x\.com)\/[a-zA-Z0-9_]+\/?/gi,
    facebook: /https?:\/\/(www\.)?(facebook\.com|fb\.com)\/[a-zA-Z0-9._-]+\/?/gi,
    instagram: /https?:\/\/(www\.)?instagram\.com\/[a-zA-Z0-9._]+\/?/gi,
    youtube: /https?:\/\/(www\.)?youtube\.com\/(channel\/|c\/|user\/|@)[a-zA-Z0-9_-]+\/?/gi,
    tiktok: /https?:\/\/(www\.)?tiktok\.com\/@[a-zA-Z0-9._-]+\/?/gi,
  };
  
  const profiles: Record<string, string> = {};
  
  for (const [platform, pattern] of Object.entries(socialPatterns)) {
    const matches = html.match(pattern) || [];
    if (matches.length > 0 && matches[0]) {
      // Take the first match and clean it up
      let url = matches[0].replace(/\/$/, ''); // Remove trailing slash
      
      // Skip generic/non-company pages
      const skipPatterns = [
        /\/(sharer|share|intent|login|signup|help|about)$/i,
        /facebook\.com\/(sharer|plugins|dialog)/i,
        /twitter\.com\/(intent|share)/i,
      ];
      
      if (!skipPatterns.some(p => p.test(url))) {
        profiles[platform] = url;
      }
    }
  }
  
  return profiles;
}

// Interface for scraped website data
interface ScrapedWebsiteData {
  emails: string[];
  phones: string[];
  socialProfiles: Record<string, string>;
  bestEmail: string | null;
  bestPhone: string | null;
}

// Main function: Scrape a website for contact information
async function scrapeWebsiteForContacts(websiteUrl: string): Promise<ScrapedWebsiteData | null> {
  if (!websiteUrl) return null;
  
  // Normalize URL
  let url = websiteUrl;
  if (!url.startsWith('http')) {
    url = `https://${url}`;
  }
  
  try {
    new URL(url); // Validate URL format
  } catch {
    console.log(`Invalid URL for scraping: ${websiteUrl}`);
    return null;
  }
  
  const combinedHtml: string[] = [];
  const pagesToFetch = [
    url,
    `${url.replace(/\/$/, '')}/contact`,
    `${url.replace(/\/$/, '')}/contact-us`,
    `${url.replace(/\/$/, '')}/about`,
    `${url.replace(/\/$/, '')}/about-us`,
  ];
  
  const fetchOptions = {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
  };
  
  // Fetch main page and contact pages with timeout
  for (const pageUrl of pagesToFetch) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(pageUrl, {
        ...fetchOptions,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const html = await response.text();
        combinedHtml.push(html);
        console.log(`Scraped ${pageUrl} successfully (${html.length} chars)`);
      }
    } catch (error) {
      // Silently skip failed pages (404, timeout, blocked, etc.)
      if (pageUrl === url) {
        console.log(`Failed to scrape main page: ${url}`);
      }
    }
    
    // Small delay between requests to be polite
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  if (combinedHtml.length === 0) {
    console.log(`No pages scraped for ${websiteUrl}`);
    return null;
  }
  
  const fullHtml = combinedHtml.join('\n');
  
  // Extract all data
  const emails = extractEmailsFromHtml(fullHtml);
  const phones = extractPhonesFromHtml(fullHtml);
  const socialProfiles = extractSocialProfilesFromHtml(fullHtml);
  
  console.log(`Scraped ${websiteUrl}: ${emails.length} emails, ${phones.length} phones, ${Object.keys(socialProfiles).length} socials`);
  
  return {
    emails,
    phones,
    socialProfiles,
    bestEmail: emails[0] || null, // First email is prioritized (contact/info)
    bestPhone: phones[0] || null,
  };
}

// ============= END PHASE 1: Website Scraping Helpers =============

// ============= PHASE 2: Progressive Website Scraping with Streaming =============

// Safe SSE send that continues even if stream is closed
const safeSendEvent = async (sendEvent: (data: any) => Promise<void>, data: any): Promise<boolean> => {
  try {
    await sendEvent(data);
    return true;
  } catch (error) {
    console.log('SSE stream closed, continuing with database updates only');
    return false;
  }
};

async function scrapeWebsitesProgressively(
  leads: any[],
  sendEvent: (data: any) => Promise<void>,
  supabase: any,
  searchId: string
) {
  // Only scrape leads that have a website URL
  const leadsWithWebsites = leads.filter(lead => lead.website);
  
  if (leadsWithWebsites.length === 0) {
    console.log('No leads with websites to scrape');
    return;
  }
  
  console.log(`Starting website scraping for ${leadsWithWebsites.length} leads`);
  
  // First, get all lead IDs from database for this search to ensure we can update them
  const { data: existingLeads, error: fetchError } = await supabase
    .from('lead_finder_leads')
    .select('id, company_data')
    .eq('search_id', searchId);
  
  if (fetchError) {
    console.error('Error fetching existing leads:', fetchError);
  }
  
  // Create a map of company name -> lead ID for efficient updates
  const leadIdMap = new Map<string, string>();
  if (existingLeads) {
    for (const dbLead of existingLeads) {
      const name = dbLead.company_data?.name?.toLowerCase();
      if (name) {
        leadIdMap.set(name, dbLead.id);
      }
    }
  }
  console.log(`Found ${leadIdMap.size} leads in database to update`);
  
  await safeSendEvent(sendEvent, {
    type: 'website-scraping',
    status: 'started',
    message: `Scraping ${leadsWithWebsites.length} company websites for contact info...`,
    total: leadsWithWebsites.length,
    completed: 0,
    company: ''
  });
  
  let scrapedCount = 0;
  let successCount = 0;
  let sseActive = true; // Track if SSE is still working
  
  for (const lead of leadsWithWebsites) {
    try {
      // Send progress update (non-blocking)
      if (sseActive) {
        sseActive = await safeSendEvent(sendEvent, {
          type: 'website-scraping',
          status: 'scraping',
          message: `Scraping ${lead.name} website (${scrapedCount + 1}/${leadsWithWebsites.length})...`,
          total: leadsWithWebsites.length,
          completed: scrapedCount,
          company: lead.name
        });
      }
      
      // Scrape the website
      const scrapedData = await scrapeWebsiteForContacts(lead.website);
      
      if (scrapedData) {
        let dataUpdated = false;
        
        // Merge scraped email (only if not already set)
        if (!lead.generalEmail && scrapedData.bestEmail) {
          lead.generalEmail = scrapedData.bestEmail;
          dataUpdated = true;
          console.log(`${lead.name}: Added email ${scrapedData.bestEmail}`);
        }
        
        // Merge scraped phone (only if not already set)
        if (!lead.companyPhone && scrapedData.bestPhone) {
          lead.companyPhone = scrapedData.bestPhone;
          dataUpdated = true;
          console.log(`${lead.name}: Added phone ${scrapedData.bestPhone}`);
        }
        
        // Merge social profiles (add missing ones)
        if (scrapedData.socialProfiles && Object.keys(scrapedData.socialProfiles).length > 0) {
          const existingSocials = lead.socialProfiles || {};
          const mergedSocials = { ...existingSocials };
          
          for (const [platform, url] of Object.entries(scrapedData.socialProfiles)) {
            if (!mergedSocials[platform] && url) {
              mergedSocials[platform] = url;
              dataUpdated = true;
              console.log(`${lead.name}: Added ${platform} - ${url}`);
            }
          }
          
          lead.socialProfiles = mergedSocials;
        }
        
        if (dataUpdated) {
          successCount++;
          
          // Recalculate quality score with new data
          lead.qualityScore = calculateFinalQualityScore(lead);
          lead.dataCompleteness = calculateDataCompleteness(lead);
          lead.wasScraped = true;
          
          // Get the database ID for this lead
          const leadId = leadIdMap.get(lead.name?.toLowerCase());
          
          if (leadId) {
            // Update lead in database using the actual ID
            const { error: updateError } = await supabase
              .from('lead_finder_leads')
              .update({
                company_data: lead,
                enrichment_status: 'scraped',
                updated_at: new Date().toISOString()
              })
              .eq('id', leadId);
            
            if (updateError) {
              console.error(`Error updating lead ${lead.name}:`, updateError);
            } else {
              console.log(`Successfully updated ${lead.name} in database`);
            }
          } else {
            console.warn(`No database ID found for lead: ${lead.name}`);
          }
          
          // Stream the updated lead to client (non-blocking)
          if (sseActive) {
            sseActive = await safeSendEvent(sendEvent, {
              type: 'lead-update',
              lead: lead,
              updateType: 'website-scraping',
              scrapedData: {
                emailsFound: scrapedData.emails.length,
                phonesFound: scrapedData.phones.length,
                socialsFound: Object.keys(scrapedData.socialProfiles).length
              }
            });
          }
        }
      }
      
      scrapedCount++;
      
      // Small delay between scrapes to be polite to servers
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      console.error(`Error scraping website for ${lead.name}:`, error);
      scrapedCount++;
    }
  }
  
  // Update search record with final scraping status
  await supabase
    .from('lead_finder_searches')
    .update({ 
      current_status: `Website scraping complete. Found contact info for ${successCount}/${leadsWithWebsites.length} companies.`,
      updated_at: new Date().toISOString()
    })
    .eq('id', searchId);
  
  // Send completion event (non-blocking)
  await safeSendEvent(sendEvent, {
    type: 'website-scraping',
    status: 'complete',
    message: `Website scraping complete. Found contact info for ${successCount}/${leadsWithWebsites.length} companies.`,
    total: leadsWithWebsites.length,
    completed: scrapedCount,
    successCount
  });
  
  console.log(`Website scraping complete: ${successCount}/${leadsWithWebsites.length} leads updated in database`);
}

// ============= END PHASE 2: Progressive Website Scraping =============

// SerpAPI search function for Google Search and Google Maps results
async function searchWithSerpAPI(
  query: string,
  geography: string,
  industry: string,
  traceId: string
): Promise<any[]> {
  const SERPAPI_API_KEY = Deno.env.get("SERPAPI_API_KEY");
  if (!SERPAPI_API_KEY) {
    console.log("SERPAPI_API_KEY not configured, skipping SerpAPI search");
    return [];
  }

  const results: any[] = [];

  try {
    // Google Search for companies
    const searchQuery = `${industry} companies ${geography} ${query}`;
    const googleSearchUrl = new URL("https://serpapi.com/search.json");
    googleSearchUrl.searchParams.set("api_key", SERPAPI_API_KEY);
    googleSearchUrl.searchParams.set("engine", "google");
    googleSearchUrl.searchParams.set("q", searchQuery);
    googleSearchUrl.searchParams.set("num", "50"); // Increased from 20

    const googleResponse = await fetch(googleSearchUrl.toString());
    if (googleResponse.ok) {
      const googleData = await googleResponse.json();
      const organicResults = googleData.organic_results || [];
      
      for (const result of organicResults) {
        if (result.title && result.link) {
          results.push({
            url: result.link,
            title: result.title,
            text: result.snippet || '',
            source: 'serpapi',
          });
        }
      }
      console.log(`SerpAPI Google Search found ${organicResults.length} results`);
    }

    // Google Maps/Places for local businesses
    const mapsQuery = `${industry} ${geography}`;
    const mapsUrl = new URL("https://serpapi.com/search.json");
    mapsUrl.searchParams.set("api_key", SERPAPI_API_KEY);
    mapsUrl.searchParams.set("engine", "google_maps");
    mapsUrl.searchParams.set("q", mapsQuery);
    mapsUrl.searchParams.set("type", "search");

    const mapsResponse = await fetch(mapsUrl.toString());
    if (mapsResponse.ok) {
      const mapsData = await mapsResponse.json();
      const localResults = mapsData.local_results || [];
      
      for (const place of localResults) {
        if (place.title) {
          results.push({
            url: place.website || place.link,
            title: place.title,
            text: place.description || place.type || '',
            source: 'google_maps',
            // Google Maps specific data
            address: place.address,
            phone: place.phone,
            rating: place.rating,
            reviews: place.reviews,
            hours: place.hours,
            place_id: place.place_id,
            gps_coordinates: place.gps_coordinates,
          });
        }
      }
      console.log(`SerpAPI Google Maps found ${localResults.length} results`);
    }
  } catch (error) {
    console.error("SerpAPI search error:", error);
  }

  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const { size, geography, industry, dryRun, provider, model, enrichWithPerplexity, searchId, customSearchText, useSerpApi, useApify } = await req.json();
  console.log("Lead Finder STREAMING:", { size, geography, industry, dryRun, provider, model, enrichWithPerplexity, searchId, customSearchText, useSerpApi, useApify });

  // Initialize Supabase with authenticated user
  const authHeader = req.headers.get('Authorization')!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  // Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Create SSE stream
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();

  const sendEvent = async (data: any) => {
    try {
      await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
    } catch (error) {
      console.error("SSE send error:", error);
    }
  };

  // Process in background and stream results
  (async () => {
    let currentSearchId = searchId;
    let searchRecord: any = null;

    try {
      await sendEvent({ type: 'status', message: 'Initializing search...', progress: 5 });

      // Create or resume search record
      if (currentSearchId) {
        // Try to resume existing search
        const { data: existing } = await supabase
          .from('lead_finder_searches')
          .select('*')
          .eq('id', currentSearchId)
          .eq('user_id', user.id)
          .single();
        
        if (existing && existing.status !== 'complete') {
          searchRecord = existing;
          console.log('Resuming search:', currentSearchId);
        }
      }

      // Create new search if not resuming
      if (!searchRecord) {
        const { data: newSearch, error: searchError } = await supabase
          .from('lead_finder_searches')
          .insert({
            user_id: user.id,
            search_params: { size, geography, industry, provider, model, enrichWithPerplexity, customSearchText, useSerpApi, useApify },
            status: 'running',
            progress: 5,
            current_status: 'Initializing search...'
          })
          .select()
          .single();

        if (searchError) throw searchError;
        searchRecord = newSearch;
        currentSearchId = newSearch.id;
        console.log('Created new search:', currentSearchId);
      }

      // Send search ID to frontend
      await sendEvent({ type: 'search-created', searchId: currentSearchId });

      const trace = createTrace('lead-finder', undefined, { size, geography, industry, customSearchText, searchId: currentSearchId });
      const EXA_API_KEY = Deno.env.get("EXA_API_KEY");
      if (!EXA_API_KEY) throw new Error("Missing EXA_API_KEY");

      // PHASE 1: Search with Exa AI and optionally SerpAPI/Apify in parallel
      const searchSourcesList = ['Exa AI'];
      if (useSerpApi) searchSourcesList.push('SerpAPI');
      if (useApify) searchSourcesList.push('Apify');
      const searchSources = searchSourcesList.join(' + ');
      await sendEvent({ type: 'status', message: `Searching with ${searchSources}...`, progress: 10 });
      await supabase
        .from('lead_finder_searches')
        .update({ progress: 10, current_status: `Searching with ${searchSources}...` })
        .eq('id', currentSearchId);
      
      const exaSpan = createSpan(trace, 'exa-search');

      let industryContext = industry;
      let mainCategory = '';
      if (industry.includes('(') && industry.includes(')')) {
        const match = industry.match(/^(.+?)\s*\((.+?)\)$/);
        if (match) {
          industryContext = match[1].trim();
          mainCategory = match[2].trim();
        }
      }

      // Build Exa queries with custom search text if provided
      const customContext = customSearchText ? ` ${customSearchText}` : '';
      const exaQueries = [
        `${industryContext} companies in ${geography} with approximately ${size} employees${customContext}`,
        `site:linkedin.com/company ${industryContext} ${geography} ${size}${customContext}`,
        `${industryContext} company directory ${geography} industry list${customContext}`,
        `${industryContext} company news ${geography} 2024 2025${customContext}`
      ];

      const exaPromises = exaQueries.map(query =>
        fetch("https://api.exa.ai/search", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": String(EXA_API_KEY).trim() },
          body: JSON.stringify({
            query,
            numResults: 20,
            useAutoprompt: true,
            type: "keyword",
            includeDomains: ["linkedin.com", "crunchbase.com"],
            contents: { text: { maxCharacters: 2000, includeHtmlTags: false } }
          }),
        }).then(r => r.ok ? r.json() : { results: [] }).catch(() => ({ results: [] }))
      );

      // Run Exa, SerpAPI, and Apify searches in parallel
      const searchPromises: Promise<any>[] = [Promise.all(exaPromises)];
      
      if (useSerpApi) {
        searchPromises.push(searchWithSerpAPI(customContext, geography, industryContext, trace.id));
      }
      
      if (useApify) {
        searchPromises.push(searchWithApify(customContext, geography, industryContext, trace.id));
      }

      const searchResults = await Promise.all(searchPromises);
      
      // Process Exa results
      const exaResponses = searchResults[0] as any[];
      let allResults: any[] = [];
      exaResponses.forEach(r => { 
        if (r.results) {
          // Mark Exa results with source
          const markedResults = r.results.map((result: any) => ({ ...result, source: 'exa' }));
          allResults.push(...markedResults);
        }
      });

      // Process SerpAPI results if enabled
      let serpApiResultCount = 0;
      let googleMapsResultCount = 0;
      let apifyResultCount = 0;
      let searchResultIndex = 1;
      
      if (useSerpApi && searchResults[searchResultIndex]) {
        const serpResults = searchResults[searchResultIndex] as any[];
        serpApiResultCount = serpResults.filter(r => r.source === 'serpapi').length;
        googleMapsResultCount = serpResults.filter(r => r.source === 'google_maps').length;
        allResults.push(...serpResults);
        console.log(`SerpAPI added ${serpApiResultCount} Google Search + ${googleMapsResultCount} Google Maps results`);
        searchResultIndex++;
      }
      
      // Process Apify results if enabled
      if (useApify && searchResults[searchResultIndex]) {
        const apifyResults = searchResults[searchResultIndex] as any[];
        apifyResultCount = apifyResults.length;
        allResults.push(...apifyResults);
        console.log(`Apify added ${apifyResultCount} results`);
      }

      const deduplicatedResults = deduplicateResults(allResults);
      const exaCount = deduplicatedResults.filter((r: any) => r.source === 'exa' || !r.source).length;
      console.log(`Found ${deduplicatedResults.length} unique companies (Exa: ${exaCount}, SerpAPI: ${serpApiResultCount}, Maps: ${googleMapsResultCount}, Apify: ${apifyResultCount})`);
      await endSpan(exaSpan, { totalResults: allResults.length, uniqueResults: deduplicatedResults.length, serpApiResults: serpApiResultCount, googleMapsResults: googleMapsResultCount, apifyResults: apifyResultCount });

      await sendEvent({ type: 'status', message: `Found ${deduplicatedResults.length} companies. Processing...`, progress: 20, sources: { exa: exaCount, serpapi: serpApiResultCount, googleMaps: googleMapsResultCount, apify: apifyResultCount } });
      await supabase
        .from('lead_finder_searches')
        .update({ progress: 20, current_status: `Found ${deduplicatedResults.length} companies. Processing...` })
        .eq('id', currentSearchId);

      // PHASE 2: Batch Processing (10 at a time)
      const GETPROSPECT_API_KEY = Deno.env.get("GETPROSPECT_API_KEY");
      
      const batchSize = 10;
      const batches: any[][] = [];
      for (let i = 0; i < deduplicatedResults.length; i += batchSize) {
        batches.push(deduplicatedResults.slice(i, i + batchSize));
      }

      const industryGuidance = mainCategory 
        ? `Focus on companies in the ${industryContext} sector within ${mainCategory}.`
        : `Focus on companies in ${industryContext}.`;

      const customSearchGuidance = customSearchText 
        ? `\n\nADDITIONAL REQUIREMENTS: ${customSearchText}\nPrioritize companies that match these specific requirements.`
        : '';

      const createPrompt = (batch: any[]) => `Extract comprehensive company information from these search results. ${industryGuidance}${customSearchGuidance}

CRITICAL INSTRUCTIONS:
1. Extract ALL companies found, even if data is incomplete
2. Deduplicate by company name
3. Extract as much information as possible from the provided content
4. PRESERVE the "source" field from input data (exa, serpapi, or google_maps)

REQUIRED FIELDS (must attempt to extract):
- name: Company name
- website: Official website URL
- description: Detailed company description (minimum 50 characters if available)
- industry: "${industryContext}"
- size: "${size}"
- geography: "${geography}"
- linkedinUrl: LinkedIn company profile URL
- source: PRESERVE from input data - one of "exa", "serpapi", "google_maps", or "apify"

CRITICAL - PRESERVE CONTACT DATA FROM INPUT:
- companyPhone: MUST preserve phone number from input data if present (check "phone" field in input)
- generalEmail: Preserve email if found in input or content
- address: MUST preserve address from input data if present

MATCH INTELLIGENCE (REQUIRED - explain why each company was chosen):
- matchReason: 1-3 sentences explaining WHY this company matches the search criteria. Reference specific evidence from the content that indicates a match for industry "${industryContext}", geography "${geography}"${customSearchText ? `, and requirements "${customSearchText}"` : ''}. Be specific and cite evidence.
- matchSignals: Array of 2-5 short bullet points (strings) highlighting key matching indicators. Examples: "Based in ${geography}", "Provides ${industryContext} services", "Matches company size ${size}"${customSearchText ? `, "Aligns with: ${customSearchText}"` : ''}

HIGHLY VALUABLE FIELDS (extract if available in content):
- foundingYear: Year company was founded
- revenue: Annual revenue or revenue range
- employeeCount: Number of employees
- fundingStage: Funding stage (e.g., Seed, Series A, B, C, IPO, etc.)
- fundingInfo: Funding details, total raised, recent rounds
- products: Main products or services offered
- recentNews: Recent company news, launches, or announcements
- technologies: Tech stack or technologies used (as array)
- keyExecutives: Array of key executives with name and title
- socialProfiles: IMPORTANT - Extract ALL social media URLs as object with these 6 platforms:
  * linkedin: Company LinkedIn page URL (linkedin.com/company/...)
  * twitter: Twitter/X profile URL (twitter.com/... or x.com/...)
  * facebook: Facebook page URL (facebook.com/...)
  * instagram: Instagram profile URL (instagram.com/...)
  * youtube: YouTube channel URL (youtube.com/...)
  * tiktok: TikTok profile URL (tiktok.com/@...)
  Search website footer, about page, contact page for social icons and links.

GOOGLE MAPS / APIFY SPECIFIC FIELDS (MUST preserve from input if source is google_maps or apify):
- address: Business address - COPY DIRECTLY from input "address" field
- companyPhone: Phone number - COPY DIRECTLY from input "phone" field  
- googleRating: Rating out of 5 from Google (input "rating" field)
- googleReviewCount: Number of Google reviews (input "reviews" field)
- googleMapsUrl: Direct Google Maps URL
- placeId: Google Place ID (input "place_id" field)
- businessHours: Operating hours (input "hours" field)

DATA QUALITY TIPS:
- For descriptions, aim for 100+ characters when content allows
- Extract LinkedIn URLs from linkedin.com/company/ pages
- Parse funding information from crunchbase or news mentions
- Identify executives from "leadership", "team", "about" sections
- Extract technologies from job postings or company descriptions
- For matchReason, always cite specific evidence from the source content

Return ONLY a valid JSON array with no markdown formatting:
${JSON.stringify(batch, null, 2)}`;

      let allLeads: any[] = [];
      let totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCost: 0 };
      let extractionProvider = provider || 'lovable';
      let extractionModel = model || 'unknown';
      const backgroundTasks: Promise<void>[] = []; // Track background enrichment tasks

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        try {
          const progressPercent = 20 + Math.floor((batchIndex / batches.length) * 60);
          const statusMessage = `Processing batch ${batchIndex + 1}/${batches.length}...`;
          await sendEvent({ type: 'status', message: statusMessage, progress: progressPercent });
          await supabase
            .from('lead_finder_searches')
            .update({ progress: progressPercent, current_status: statusMessage })
            .eq('id', currentSearchId);

          // Extract
          const aiResponse = await fetch(`${supabaseUrl}/functions/v1/ai-provider`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${supabaseAnonKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              provider: provider || 'lovable',
              model,
              messages: [
                { role: 'system', content: 'Return only valid JSON arrays, no markdown.' },
                { role: 'user', content: createPrompt(batches[batchIndex]) }
              ],
              temperature: 0.3,
              traceId: trace.id,
            }),
          });

          if (!aiResponse.ok) continue;

          const aiResult = await aiResponse.json();
          let cleanedText = aiResult.content.trim().replace(/```json\n?/g, "").replace(/```\n?/g, "");
          
          let batchLeads: any[] = [];
          try {
            batchLeads = JSON.parse(cleanedText);
            if (!Array.isArray(batchLeads)) batchLeads = [];
          } catch {
            continue;
          }

          // POST-PROCESSING: Merge back original data from SerpAPI/Apify that AI might have missed
          const originalBatch = batches[batchIndex];
          batchLeads.forEach(lead => {
            // Find matching original result by name or URL
            const originalResult = originalBatch.find((orig: any) => {
              const origName = (orig.title || '').toLowerCase().trim();
              const leadName = (lead.name || '').toLowerCase().trim();
              const origUrl = (orig.url || '').toLowerCase();
              const leadUrl = (lead.website || '').toLowerCase();
              return origName === leadName || 
                     (origUrl && leadUrl && (origUrl.includes(leadUrl) || leadUrl.includes(origUrl)));
            });

            if (originalResult) {
              // Preserve phone if AI missed it
              if (!lead.companyPhone && originalResult.phone) {
                lead.companyPhone = originalResult.phone;
              }
              // Preserve address if AI missed it
              if (!lead.address && originalResult.address) {
                lead.address = originalResult.address;
              }
              // Preserve Google Maps data
              if (originalResult.source === 'google_maps' || originalResult.source === 'apify') {
                if (!lead.googleRating && originalResult.rating) lead.googleRating = originalResult.rating;
                if (!lead.googleReviewCount && originalResult.reviews) lead.googleReviewCount = originalResult.reviews;
                if (!lead.placeId && originalResult.place_id) lead.placeId = originalResult.place_id;
                if (!lead.businessHours && originalResult.hours) lead.businessHours = originalResult.hours;
              }
              // Ensure source is preserved
              if (!lead.source && originalResult.source) {
                lead.source = originalResult.source;
              }
            }
          });

          if (batchIndex === 0) {
            extractionProvider = aiResult.provider || provider || 'lovable';
            extractionModel = aiResult.model || model || 'unknown';
          }

          if (aiResult.usage) {
            totalUsage.promptTokens += aiResult.usage.promptTokens || 0;
            totalUsage.completionTokens += aiResult.usage.completionTokens || 0;
            totalUsage.totalTokens += aiResult.usage.totalTokens || 0;
            totalUsage.estimatedCost += aiResult.usage.estimatedCost || 0;
          }

          // PHASE 1: Calculate basic scores immediately (NO enrichment status)
          batchLeads.forEach(lead => {
            lead.qualityScore = calculateFinalQualityScore(lead);
            lead.dataCompleteness = calculateDataCompleteness(lead);
          });

          const qualifiedLeads = batchLeads.filter(l => l.qualityScore >= 25);
          allLeads.push(...qualifiedLeads);

          // Save leads to database immediately (batch insert)
          if (qualifiedLeads.length > 0 && !dryRun) {
            const leadInserts = qualifiedLeads.map(lead => ({
              search_id: currentSearchId,
              user_id: user.id,
              company_data: lead,
              enrichment_status: 'pending',
              contact_status: 'pending',
              quality_score: lead.qualityScore
            }));

            await supabase
              .from('lead_finder_leads')
              .insert(leadInserts)
              .select();
          }

          // PHASE 1: STREAM BATCH IMMEDIATELY
          if (qualifiedLeads.length > 0) {
            await sendEvent({
              type: 'batch',
              leads: qualifiedLeads,
              batchNumber: batchIndex + 1,
              totalBatches: batches.length
            });
          }
        } catch (error) {
          console.error(`Batch ${batchIndex + 1} error:`, error);
        }
      }

      // Notify that extraction is complete
      await sendEvent({
        type: 'extraction-complete',
        message: 'All companies extracted. Starting background enrichment...',
        progress: 80
      });
      await supabase
        .from('lead_finder_searches')
        .update({ progress: 80, current_status: 'All companies extracted. Starting background enrichment...' })
        .eq('id', currentSearchId);

      // Final deduplication BEFORE background tasks
      const leads = deduplicateLeads(allLeads);
      console.log(`Final: ${leads.length} unique leads`);

      // PHASE 2 & 3: Start background enrichment and contact finding
      // Setup keepalive ping to prevent connection timeout during long operations
      let keepaliveActive = true;
      const keepaliveInterval = setInterval(async () => {
        if (!keepaliveActive) return;
        try {
          await sendEvent({ type: 'keepalive', timestamp: Date.now() });
        } catch (e) {
          console.log('Keepalive failed, stream may be closed');
          keepaliveActive = false;
        }
      }, 10000); // Ping every 10 seconds

      const backgroundPromise = (async () => {
        try {
          // Step 0: Website Scraping (NEW - extract emails, phones, socials directly from websites)
          const leadsWithWebsites = leads.filter(l => l.website);
          if (leadsWithWebsites.length > 0) {
            await safeSendEvent(sendEvent, {
              type: 'website-scraping',
              status: 'started',
              message: `Scraping ${leadsWithWebsites.length} company websites for contact info...`,
              total: leadsWithWebsites.length,
              completed: 0,
              progress: 82
            });
            await supabase
              .from('lead_finder_searches')
              .update({ progress: 82, current_status: `Scraping ${leadsWithWebsites.length} company websites...` })
              .eq('id', currentSearchId);

            await scrapeWebsitesProgressively(
              leads,
              sendEvent,
              supabase,
              currentSearchId
            );
          }

          // Step 1: Enrichment with Perplexity (only if enabled)
          if (enrichWithPerplexity && leads.length > 0) {
            const enrichmentLeads = leads.filter(l => l.qualityScore >= 25);
            if (enrichmentLeads.length > 0) {
              await sendEvent({
                type: 'enrichment-status',
                message: `Starting enrichment for ${enrichmentLeads.length} companies...`,
                progress: 88
              });
              await supabase
                .from('lead_finder_searches')
                .update({ progress: 88, current_status: `Enriching ${enrichmentLeads.length} companies...` })
                .eq('id', currentSearchId);

              await enrichBatchProgressively(
                enrichmentLeads,
                supabaseUrl,
                supabaseAnonKey,
                trace.id,
                0,
                sendEvent,
                supabase,
                currentSearchId
              );
            }
          }

          // Step 2: Contact finding (only if GetProspect key exists)
          if (GETPROSPECT_API_KEY && leads.length > 0) {
            const contactLeads = leads.filter(l => l.linkedinUrl || l.website);
            if (contactLeads.length > 0) {
              await sendEvent({
                type: 'contact-status',
                message: `Finding contacts for ${contactLeads.length} companies...`,
                progress: 92
              });
              await supabase
                .from('lead_finder_searches')
                .update({ progress: 92, current_status: `Finding contacts for ${contactLeads.length} companies...` })
                .eq('id', currentSearchId);

              await findContactsProgressively(
                contactLeads,
                GETPROSPECT_API_KEY,
                supabaseUrl,
                supabaseAnonKey,
                trace.id,
                0,
                sendEvent,
                supabase,
                currentSearchId
              );
            }
          }

          console.log('All background tasks completed');
        } catch (error) {
          console.error('Background tasks error:', error);
        } finally {
          // Stop keepalive pings when background tasks complete
          keepaliveActive = false;
          clearInterval(keepaliveInterval);
          console.log('Keepalive stopped');
        }
      })();

      // Let background tasks run without blocking the response
      backgroundPromise.catch(console.error);

      // Stats
      const stats = {
        totalFound: leads.length,
        returned: leads.length,
        filtered: allLeads.length - leads.length,
        withContacts: leads.filter(l => l.contacts?.length > 0).length,
        withLinkedIn: leads.filter(l => l.linkedinUrl).length,
        highQuality: leads.filter(l => l.qualityScore >= 70).length,
        averageScore: leads.reduce((sum, l) => sum + l.qualityScore, 0) / leads.length || 0
      };

      // Database insertion in background (non-blocking)
      // Note: We send insertedCount as 0 initially, DB insertion happens asynchronously
      // Helper functions to parse funding info
      const extractFundingStage = (fundingInfo: string): string | null => {
        const stageMatch = fundingInfo.match(/(Seed|Pre-Seed|Series [A-Z]|IPO|Private|Bootstrapped)/i);
        return stageMatch ? stageMatch[0] : null;
      };

      const extractFundingTotal = (fundingInfo: string): string | null => {
        const amountMatch = fundingInfo.match(/\$[\d.]+[KMB]/i);
        return amountMatch ? amountMatch[0] : null;
      };

      const insertPromise = !dryRun && leads.length > 0 ? (async () => {
        let count = 0;
        try {
          const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
          const supabase = createClient(supabaseUrl, supabaseServiceKey);

          for (const lead of leads) {
            try {
              const { data, error } = await supabase.from("companies").upsert({
                name: lead.name,
                website: lead.website || null,
                description: lead.description || null,
                industry: lead.industry || null,
                size: lead.size || null,
                geography: lead.geography || null,
                linkedin_url: lead.linkedinUrl || null,
                company_phone: lead.companyPhone || null,
                general_email: lead.generalEmail || null,
                social_profiles: lead.socialProfiles || null,
                key_executives: lead.keyExecutives || null,
                employee_count: lead.employeeCount || null,
                recent_news: lead.recentNews || null,
                tech_stack: lead.technologies || lead.techStack || null,
                funding_stage: lead.fundingInfo ? extractFundingStage(lead.fundingInfo) : null,
                funding_total: lead.fundingInfo ? extractFundingTotal(lead.fundingInfo) : null,
                enrichment_data: (lead.products || lead.fundingInfo || lead.technologies || lead.recentNews) ? {
                  products: lead.products || null,
                  fundingInfo: lead.fundingInfo || null,
                  recentNews: lead.recentNews || null,
                  technologies: lead.technologies || lead.techStack || null,
                  enrichmentTier: lead.enrichmentTier || null,
                } : null,
                status: "NEW",
                enriched_at: new Date().toISOString(),
                enrichment_status: (lead.wasEnriched || lead.enrichmentTier) ? 'completed' : 'pending',
                enrichment_provider: extractionProvider,
                enrichment_model: extractionModel,
                langfuse_trace_id: trace.id,
              }, { onConflict: "website", ignoreDuplicates: false }).select();

              if (!error && data && data.length > 0) {
                count++;
                const companyId = data[0].id;
                
                if (lead.contacts?.length > 0) {
                  for (const contact of lead.contacts) {
                    await supabase.from("contacts").insert({
                      company_id: companyId,
                      name: contact.name,
                      email: contact.email || null,
                      email_verified: contact.emailVerified || false,
                      linkedin_url: contact.linkedinUrl || null,
                      title: contact.title || null,
                      department: contact.department || null,
                      phone: contact.phone || null,
                      is_primary_contact: contact === lead.primaryContact
                    });
                  }
                }
              }
            } catch {}
          }
          console.log(`Inserted ${count} companies in background`);
        } catch (error) {
          console.error("Background DB insertion error:", error);
        }
      })() : null;
      
      // Don't await - let it run in background
      if (insertPromise) insertPromise.catch(console.error);

      // Update search record as complete
      await supabase
        .from('lead_finder_searches')
        .update({
          status: 'complete',
          progress: 100,
          current_status: 'Search completed',
          stats,
          usage: totalUsage,
          trace_url: `https://cloud.langfuse.com/trace/${trace.id}`
        })
        .eq('id', currentSearchId);

      // Send complete event
      await sendEvent({
        type: 'complete',
        searchId: currentSearchId,
        stats,
        inserted: 0, // DB insertion happens asynchronously in background
        dryRun,
        provider: extractionProvider,
        model: extractionModel,
        usage: totalUsage,
        wasEnriched: enrichWithPerplexity,
        traceUrl: `https://cloud.langfuse.com/trace/${trace.id}`
      });

      await writer.close();
    } catch (error) {
      console.error("Stream processing error:", error);
      
      // Update search record as error
      if (currentSearchId) {
        await supabase
          .from('lead_finder_searches')
          .update({
            status: 'error',
            current_status: 'Error occurred',
            error_message: error instanceof Error ? error.message : 'Unknown error'
          })
          .eq('id', currentSearchId);
      }

      await sendEvent({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
      await writer.close();
    }
  })();

  // Return streaming response
  return new Response(stream.readable, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
});
