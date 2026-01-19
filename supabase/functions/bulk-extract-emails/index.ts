import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.46.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Clean API key - removes any non-ASCII characters that cause ByteString errors
 */
function cleanApiKey(key: string | undefined): string | null {
  if (!key) return null;
  return key.trim().replace(/[^\x00-\x7F]/g, '');
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OPENAI_API_KEY = cleanApiKey(Deno.env.get('OPENAI_API_KEY'));

// Regex patterns for email extraction
const EMAIL_PATTERNS = [
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  /mailto:([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,})/gi,
];

// Common spam/generic emails to filter out
const SPAM_PATTERNS = [
  /noreply/i, /no-reply/i, /donotreply/i, /do-not-reply/i,
  /^admin@/, /^webmaster@/, /^hostmaster@/, /^postmaster@/,
  /example\.com$/, /test\.com$/, /localhost/,
];

// User agents for rotation
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
];

function isValidBusinessEmail(email: string): boolean {
  if (!email || email.length > 100) return false;
  
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(email)) return false;
  }
  
  const parts = email.split('@');
  if (parts.length !== 2) return false;
  
  const domain = parts[1];
  if (!domain.includes('.')) return false;
  
  return true;
}

async function fetchWebsiteContent(url: string): Promise<string | null> {
  const randomAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': randomAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      return null;
    }
    
    return await response.text();
  } catch (error) {
    console.log(`[bulk-extract] Error fetching ${url}:`, error);
    return null;
  }
}

function extractEmailsFromHtml(html: string): string[] {
  const emails = new Set<string>();
  
  for (const pattern of EMAIL_PATTERNS) {
    const matches = html.match(pattern);
    if (matches) {
      for (let match of matches) {
        match = match.replace(/^mailto:/i, '');
        if (isValidBusinessEmail(match)) {
          emails.add(match.toLowerCase());
        }
      }
    }
  }
  
  return Array.from(emails);
}

async function extractEmailWithAI(html: string, companyName: string): Promise<string | null> {
  if (!OPENAI_API_KEY) return null;
  
  const truncatedHtml = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .substring(0, 15000);
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an email extraction specialist. Extract the main business contact email from website content. 
Rules:
- Return ONLY the most relevant business/contact email (e.g., info@, contact@, hello@, sales@)
- Do NOT return personal emails, noreply emails, or support-only emails
- If no suitable email is found, return "null"
- Return ONLY the email address, nothing else`
          },
          {
            role: 'user',
            content: `Company: ${companyName}\n\nWebsite content:\n${truncatedHtml}`
          }
        ],
        max_tokens: 50,
        temperature: 0,
      }),
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const result = data.choices?.[0]?.message?.content?.trim();
    
    if (result && result !== 'null' && isValidBusinessEmail(result)) {
      return result.toLowerCase();
    }
    
    return null;
  } catch (error) {
    console.error('[bulk-extract] AI extraction error:', error);
    return null;
  }
}

async function extractEmailForLead(lead: any): Promise<{ email: string | null; method: string }> {
  const website = lead.company_website;
  if (!website) {
    return { email: null, method: 'no_website' };
  }
  
  // Normalize URL
  let url = website.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }
  
  // Try multiple pages
  const pagesToTry = [
    url,
    `${url}/contact`,
    `${url}/contact-us`,
    `${url}/about`,
    `${url}/about-us`,
  ];
  
  let allEmails: string[] = [];
  let htmlContent = '';
  
  for (const pageUrl of pagesToTry) {
    const html = await fetchWebsiteContent(pageUrl);
    
    if (html) {
      htmlContent = html;
      const emails = extractEmailsFromHtml(html);
      allEmails.push(...emails);
      
      if (allEmails.length > 0 && pageUrl === url) {
        break;
      }
    }
  }
  
  // Remove duplicates
  allEmails = [...new Set(allEmails)];
  
  let finalEmail: string | null = null;
  let method = 'not_found';
  
  if (allEmails.length === 1) {
    finalEmail = allEmails[0];
    method = 'regex';
  } else if (allEmails.length > 1) {
    const priorityPatterns = ['info@', 'contact@', 'hello@', 'sales@', 'enquiry@', 'enquiries@'];
    
    for (const pattern of priorityPatterns) {
      const match = allEmails.find(e => e.startsWith(pattern));
      if (match) {
        finalEmail = match;
        method = 'regex_priority';
        break;
      }
    }
    
    if (!finalEmail && OPENAI_API_KEY && htmlContent) {
      finalEmail = await extractEmailWithAI(htmlContent, lead.company_name);
      method = finalEmail ? 'ai' : 'not_found';
    }
    
    if (!finalEmail) {
      finalEmail = allEmails[0];
      method = 'regex_first';
    }
  } else if (OPENAI_API_KEY && htmlContent) {
    finalEmail = await extractEmailWithAI(htmlContent, lead.company_name);
    method = finalEmail ? 'ai' : 'not_found';
  }
  
  return { email: finalEmail, method };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[bulk-extract-emails] Starting bulk email extraction');

  try {
    const { leadIds, createContact = true } = await req.json();

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Lead IDs are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[bulk-extract-emails] Processing ${leadIds.length} leads`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch all leads
    const { data: leads, error: fetchError } = await supabase
      .from('autonomous_leads')
      .select('id, company_name, company_website, company_data, company_id')
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

    // Filter leads that need email extraction
    const leadsToProcess = leads.filter(lead => {
      const companyData = (lead.company_data || {}) as Record<string, any>;
      const hasWebsite = lead.company_website && 
        !lead.company_website.includes('no-website') && 
        lead.company_website.trim() !== '';
      const hasEmail = companyData.generalEmail && companyData.generalEmail.trim() !== '';
      return hasWebsite && !hasEmail;
    });

    console.log(`[bulk-extract-emails] ${leadsToProcess.length} leads need email extraction`);

    // Create SSE response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        };

        let successCount = 0;
        let failedCount = 0;

        for (let i = 0; i < leadsToProcess.length; i++) {
          const lead = leadsToProcess[i];
          
          // Send progress update
          send({
            type: 'progress',
            current: i + 1,
            total: leadsToProcess.length,
            companyName: lead.company_name,
          });

          try {
            // Add delay between requests to avoid blocking
            if (i > 0) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }

            const { email, method } = await extractEmailForLead(lead);

            if (email) {
              // Update autonomous_leads company_data
              const companyData = (lead.company_data || {}) as Record<string, any>;
              const updatedCompanyData = {
                ...companyData,
                generalEmail: email,
                emailExtractedAt: new Date().toISOString(),
                emailExtractionMethod: method,
              };

              await supabase
                .from('autonomous_leads')
                .update({ 
                  company_data: updatedCompanyData,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', lead.id);

              // Also update linked company if exists
              if (lead.company_id) {
                await supabase
                  .from('companies')
                  .update({ 
                    general_email: email,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', lead.company_id);

                // Create contact if createContact flag is true
                if (createContact) {
                  // Check if primary contact already exists
                  const { data: existingPrimary } = await supabase
                    .from('contacts')
                    .select('id')
                    .eq('company_id', lead.company_id)
                    .eq('is_primary_contact', true)
                    .maybeSingle();

                  // Get company name for the contact
                  const { data: company } = await supabase
                    .from('companies')
                    .select('name')
                    .eq('id', lead.company_id)
                    .single();

                  // Create or update contact
                  const { error: contactError } = await supabase
                    .from('contacts')
                    .upsert({
                      company_id: lead.company_id,
                      name: company?.name ? `${company.name} Contact` : 'General Contact',
                      email: email,
                      email_verified: true,
                      is_primary_contact: !existingPrimary,
                      title: 'General Inquiry',
                    }, {
                      onConflict: 'company_id,email',
                      ignoreDuplicates: false,
                    });

                  if (contactError) {
                    console.log(`[bulk-extract] Note: Could not create contact for ${lead.company_name}:`, contactError.message);
                  } else {
                    console.log(`[bulk-extract] Created contact for ${lead.company_name}`);
                  }
                }
              }

              successCount++;
              send({
                type: 'extracted',
                leadId: lead.id,
                companyName: lead.company_name,
                email,
                method,
                contactCreated: createContact && !!lead.company_id,
              });
            } else {
              failedCount++;
              send({
                type: 'failed',
                leadId: lead.id,
                companyName: lead.company_name,
                error: 'No email found',
              });
            }
          } catch (error) {
            failedCount++;
            send({
              type: 'failed',
              leadId: lead.id,
              companyName: lead.company_name,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }

        // Send completion
        send({
          type: 'complete',
          success: successCount,
          failed: failedCount,
          total: leadsToProcess.length,
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
    console.error('[bulk-extract-emails] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
