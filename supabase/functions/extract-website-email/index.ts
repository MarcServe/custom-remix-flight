import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.46.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

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

function isValidBusinessEmail(email: string): boolean {
  if (!email || email.length > 100) return false;
  
  // Check against spam patterns
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(email)) return false;
  }
  
  // Must have valid TLD
  const parts = email.split('@');
  if (parts.length !== 2) return false;
  
  const domain = parts[1];
  if (!domain.includes('.')) return false;
  
  return true;
}

async function fetchWebsiteContent(url: string): Promise<string | null> {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  ];
  
  const randomAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
  
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
      console.log(`[extract-website-email] Failed to fetch ${url}: ${response.status}`);
      return null;
    }
    
    const html = await response.text();
    return html;
  } catch (error) {
    console.log(`[extract-website-email] Error fetching ${url}:`, error);
    return null;
  }
}

function extractEmailsFromHtml(html: string): string[] {
  const emails = new Set<string>();
  
  for (const pattern of EMAIL_PATTERNS) {
    const matches = html.match(pattern);
    if (matches) {
      for (let match of matches) {
        // Remove mailto: prefix if present
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
  if (!OPENAI_API_KEY) {
    console.log('[extract-website-email] No OpenAI API key configured');
    return null;
  }
  
  // Truncate HTML to avoid token limits - focus on key sections
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
    
    if (!response.ok) {
      console.error('[extract-website-email] OpenAI API error:', response.status);
      return null;
    }
    
    const data = await response.json();
    const result = data.choices?.[0]?.message?.content?.trim();
    
    if (result && result !== 'null' && isValidBusinessEmail(result)) {
      return result.toLowerCase();
    }
    
    return null;
  } catch (error) {
    console.error('[extract-website-email] AI extraction error:', error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[extract-website-email] Starting email extraction');

  try {
    const { companyId, website, companyName } = await req.json();

    if (!companyId || !website) {
      return new Response(
        JSON.stringify({ success: false, error: 'Company ID and website are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[extract-website-email] Extracting email for ${companyName} from ${website}`);

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
      console.log(`[extract-website-email] Trying ${pageUrl}`);
      const html = await fetchWebsiteContent(pageUrl);
      
      if (html) {
        htmlContent = html;
        const emails = extractEmailsFromHtml(html);
        allEmails.push(...emails);
        
        // If we found emails on the main page, might not need others
        if (allEmails.length > 0 && pageUrl === url) {
          break;
        }
      }
    }

    // Remove duplicates
    allEmails = [...new Set(allEmails)];

    console.log(`[extract-website-email] Found ${allEmails.length} emails via regex:`, allEmails);

    let finalEmail: string | null = null;

    if (allEmails.length === 1) {
      // Only one email found, use it
      finalEmail = allEmails[0];
    } else if (allEmails.length > 1) {
      // Multiple emails - prioritize common business patterns
      const priorityPatterns = ['info@', 'contact@', 'hello@', 'sales@', 'enquiry@', 'enquiries@'];
      
      for (const pattern of priorityPatterns) {
        const match = allEmails.find(e => e.startsWith(pattern));
        if (match) {
          finalEmail = match;
          break;
        }
      }
      
      // If no priority match, use AI to pick best one
      if (!finalEmail && OPENAI_API_KEY && htmlContent) {
        finalEmail = await extractEmailWithAI(htmlContent, companyName);
      }
      
      // Fallback to first email if AI didn't help
      if (!finalEmail) {
        finalEmail = allEmails[0];
      }
    } else if (OPENAI_API_KEY && htmlContent) {
      // No regex matches - try AI extraction
      console.log('[extract-website-email] No regex matches, trying AI extraction');
      finalEmail = await extractEmailWithAI(htmlContent, companyName);
    }

    if (!finalEmail) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No business email found on website',
          emailsScanned: allEmails.length,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[extract-website-email] Final email selected: ${finalEmail}`);

    // Update company in database
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const { error: updateError } = await supabase
      .from('companies')
      .update({ 
        general_email: finalEmail,
        updated_at: new Date().toISOString(),
      })
      .eq('id', companyId);

    if (updateError) {
      console.error('[extract-website-email] Database update error:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to update company' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[extract-website-email] Successfully extracted and saved email: ${finalEmail}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        email: finalEmail,
        method: allEmails.includes(finalEmail) ? 'regex' : 'ai',
        alternativeEmails: allEmails.filter(e => e !== finalEmail),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[extract-website-email] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
