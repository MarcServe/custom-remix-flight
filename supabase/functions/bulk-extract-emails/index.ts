import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { isProspectableEmail } from "../_shared/email-quality.ts";
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
import { promoteLeadToCompany, bumpRunCounters } from '../_shared/lead-promote.ts';
const background = (p: Promise<unknown>) => { const rt = (globalThis as any).EdgeRuntime; if (rt?.waitUntil) rt.waitUntil(p.catch(() => {})); else p.catch(() => {}); };

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
  // Shared junk filter: image names (logo@2x.png), placeholders, non-sales inboxes.
  if (!isProspectableEmail(email)) return false;
  
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


const NON_SALES_MAILBOX = /^(privacy|dpo|gdpr|legal|abuse|noreply|no-reply|donotreply|unsubscribe|press|media|careers|jobs|recruit(ment|ing)?|hr|security|postmaster|webmaster|billing|accounts|invoices?|complaints|whistleblow\w*|compliance)@/i;
const GENERIC_MAIL_HOSTS = /gmail\.com|yahoo\.|hotmail\.|outlook\.com|icloud\.com|example\.com|sentry\.io|wixpress\.com/i;
async function findEmailWithPerplexity(companyName: string, websiteUrl: string): Promise<string | null> {
  const key = (Deno.env.get('PERPLEXITY_API_KEY') || '').trim();
  if (!key) return null;
  let domain = '';
  try { domain = new URL(websiteUrl).hostname.replace(/^www\./, '').toLowerCase(); } catch { /* ignore */ }
  try {
    const r = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'sonar', temperature: 0, max_tokens: 120,
        messages: [
          { role: 'system', content: 'You find public business contact email addresses. Answer with JSON only.' },
          { role: 'user', content: `What is the general/public contact email address of "${companyName}" (website ${websiteUrl})? Return the general enquiries, hello/info or sales address published by the company itself (on its website, Google listing or official directory entry) — never a privacy, legal, careers or no-reply address${domain ? `, preferably at @${domain}` : ''}. If you cannot find one, return null. JSON: {"email": string|null}` },
        ],
        response_format: { type: 'json_schema', json_schema: { schema: { type: 'object', properties: { email: { type: ['string', 'null'] } }, required: ['email'] } } },
      }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    const content = String(d.choices?.[0]?.message?.content || '');
    const m = content.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    if (!m) return null;
    const email = m[0].toLowerCase();
    if (GENERIC_MAIL_HOSTS.test(email) || NON_SALES_MAILBOX.test(email) || !isProspectableEmail(email)) return null;
    // Only trust it when it is on the company's own domain (or a close parent/child of it)
    const host = email.split('@')[1];
    if (domain && !(host === domain || host.endsWith('.' + domain) || domain.endsWith('.' + host))) return null;
    return email;
  } catch { return null; }
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
  
  // Remove duplicates and addresses nobody should prospect to
  allEmails = [...new Set(allEmails)].filter(e => !NON_SALES_MAILBOX.test(e));
  
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

  // Last resort: ask Perplexity (web-grounded) for the company's public contact email.
  if (!finalEmail) {
    const viaSearch = await findEmailWithPerplexity(lead.company_name, url);
    if (viaSearch) { finalEmail = viaSearch; method = 'perplexity'; }
  }
  
  return { email: finalEmail, method };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[bulk-extract-emails] Starting bulk email extraction');

  try {
    const { leadIds, createContact = true, stream: useStream = true, promote = false, chain = false, chunk = 12 } = await req.json();

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Lead IDs are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[bulk-extract-emails] Processing ${leadIds.length} leads, stream: ${useStream}`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch all leads
    const { data: leads, error: fetchError } = await supabase
      .from('autonomous_leads')
      .select('id, user_id, company_name, company_website, company_data, company_id, status, discovery_run_id, persona_id, contacts, industry, geography, company_size, enrichment_data, reviewed_at')
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
    
    // If useStream=false, return JSON response for backend callers (like autonomous-lead-discovery)
    if (!useStream) {
      // Server callers: work in bounded chunks and hand the rest to a fresh invocation so a
      // long list never hits the function's wall-clock limit.
      const size = Math.max(3, Math.min(25, Number(chunk) || 12));
      const now = chain ? leadsToProcess.slice(0, size) : leadsToProcess;
      const rest = chain ? leadsToProcess.slice(size) : [];
      const res = await processLeadsAndReturnJson(supabase, now, createContact, promote === true);
      if (rest.length) {
        console.log(`[bulk-extract-emails] Chaining ${rest.length} remaining leads`);
        background(fetch(`${SUPABASE_URL}/functions/v1/bulk-extract-emails`, { method: 'POST', headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ leadIds: rest.map((l: any) => l.id), createContact, stream: false, promote, chain: true, chunk: size }) }));
      } else if (promote) {
        // End of the chain: every lead that could get an email has one, so the Autopilot run can
        // build its campaign and send the summary now (it claims the run, so a repeat is harmless).
        const runs = new Map<string, string>();
        for (const l of leads) if (l.discovery_run_id && l.user_id && !runs.has(l.discovery_run_id)) runs.set(l.discovery_run_id, l.user_id);
        for (const [discoveryRunId, userId] of runs) {
          console.log(`[bulk-extract-emails] Chain complete → post phase for run ${discoveryRunId}`);
          background(fetch(`${SUPABASE_URL}/functions/v1/autonomous-lead-discovery`, { method: 'POST', headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ phase: 'post', userId, discoveryRunId }) }));
        }
      }
      return res;
    }

    // Create SSE response for frontend callers
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

/**
 * Process leads and return JSON response (for backend callers)
 */
async function processLeadsAndReturnJson(
  supabase: any,
  leadsToProcess: any[],
  createContact: boolean,
  promote = false
): Promise<Response> {
  let successCount = 0;
  let failedCount = 0;
  let contactsCreated = 0;
  let promoted = 0;
  const settingsCache = new Map<string, any>();
  const runDeltas = new Map<string, { emails_extracted: number; contacts_created: number }>();
  const bump = (runId: string | null, k: 'emails_extracted' | 'contacts_created') => { if (!runId) return; const d = runDeltas.get(runId) || { emails_extracted: 0, contacts_created: 0 }; d[k]++; runDeltas.set(runId, d); };

  for (let i = 0; i < leadsToProcess.length; i++) {
    const lead = leadsToProcess[i];
    
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

            if (!contactError) {
              contactsCreated++;
              console.log(`[bulk-extract] Created contact for ${lead.company_name}`);
            }
          }
        }

        successCount++;
        bump(lead.discovery_run_id, 'emails_extracted');

        // Autopilot: an approved lead that now has an email becomes a CRM company (+ contact, + sequence)
        if (promote && !lead.company_id && (lead.status === 'auto_approved' || lead.status === 'approved') && lead.user_id) {
          if (!settingsCache.has(lead.user_id)) {
            const { data: st } = await supabase.from('autonomous_discovery_settings').select('auto_enroll_enabled, auto_enroll_sequence_id').eq('user_id', lead.user_id).maybeSingle();
            settingsCache.set(lead.user_id, st || null);
          }
          let personaSeq: string | null = null;
          if (lead.persona_id) { const { data: pr } = await supabase.from('discovery_personas').select('auto_enroll_sequence_id').eq('id', lead.persona_id).maybeSingle(); personaSeq = pr?.auto_enroll_sequence_id || null; }
          const companyId = await promoteLeadToCompany(supabase, lead.user_id, { ...lead, company_data: { ...(lead.company_data || {}), generalEmail: email } }, settingsCache.get(lead.user_id), personaSeq);
          if (companyId) { promoted++; bump(lead.discovery_run_id, 'contacts_created'); }
        }
      } else {
        failedCount++;
      }
    } catch (error) {
      failedCount++;
      console.error(`[bulk-extract] Error for ${lead.company_name}:`, error);
    }
  }
  for (const [runId, d] of runDeltas) await bumpRunCounters(supabase, runId, d);

  return new Response(
    JSON.stringify({
      success: true,
      emailsFound: successCount,
      contactsCreated: contactsCreated + promoted,
      promoted,
      failed: failedCount,
      total: leadsToProcess.length,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
