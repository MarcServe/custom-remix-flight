import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeliverabilityRequest {
  domain?: string;
  emailContent?: {
    subject: string;
    body: string;
  };
}

interface DNSRecord {
  type: 'SPF' | 'DKIM' | 'DMARC';
  status: 'valid' | 'invalid' | 'missing';
  value?: string;
  expected?: string;
  message: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { domain, emailContent }: DeliverabilityRequest = await req.json();

    const result: any = {
      timestamp: new Date().toISOString(),
    };

    // Check DNS records if domain provided
    if (domain) {
      console.log(`Checking DNS records for domain: ${domain}`);
      
      const dnsRecords: DNSRecord[] = [];

      // Check SPF
      try {
        const spfResponse = await fetch(`https://dns.google/resolve?name=${domain}&type=TXT`);
        const spfData = await spfResponse.json();
        
        const spfRecord = spfData.Answer?.find((record: any) => 
          record.data.includes('v=spf1')
        );

        if (spfRecord) {
          dnsRecords.push({
            type: 'SPF',
            status: 'valid',
            value: spfRecord.data,
            message: 'SPF record found and configured'
          });
        } else {
          dnsRecords.push({
            type: 'SPF',
            status: 'missing',
            expected: 'v=spf1 include:_spf.resend.com ~all',
            message: 'SPF record not found. Add this TXT record to your DNS.'
          });
        }
      } catch (error) {
        console.error('Error checking SPF:', error);
        dnsRecords.push({
          type: 'SPF',
          status: 'invalid',
          message: 'Unable to verify SPF record'
        });
      }

      // Check DMARC
      try {
        const dmarcDomain = `_dmarc.${domain}`;
        const dmarcResponse = await fetch(`https://dns.google/resolve?name=${dmarcDomain}&type=TXT`);
        const dmarcData = await dmarcResponse.json();
        
        const dmarcRecord = dmarcData.Answer?.find((record: any) => 
          record.data.includes('v=DMARC1')
        );

        if (dmarcRecord) {
          dnsRecords.push({
            type: 'DMARC',
            status: 'valid',
            value: dmarcRecord.data,
            message: 'DMARC record found and configured'
          });
        } else {
          dnsRecords.push({
            type: 'DMARC',
            status: 'missing',
            expected: 'v=DMARC1; p=none; rua=mailto:dmarc@' + domain,
            message: 'DMARC record not found. Add this TXT record to _dmarc.' + domain
          });
        }
      } catch (error) {
        console.error('Error checking DMARC:', error);
        dnsRecords.push({
          type: 'DMARC',
          status: 'invalid',
          message: 'Unable to verify DMARC record'
        });
      }

      // DKIM check - try common selectors for different providers
      let dkimFound = false;
      const dkimSelectors = ['default', 'resend', 'google', 'mailgun', 'sendgrid', 'k1'];
      
      for (const selector of dkimSelectors) {
        try {
          const dkimDomain = `${selector}._domainkey.${domain}`;
          const dkimResponse = await fetch(`https://dns.google/resolve?name=${dkimDomain}&type=TXT`);
          const dkimData = await dkimResponse.json();
          
          const dkimRecord = dkimData.Answer?.find((record: any) => 
            record.data.includes('v=DKIM1') || record.data.includes('k=rsa') || record.data.includes('p=')
          );

          if (dkimRecord) {
            dnsRecords.push({
              type: 'DKIM',
              status: 'valid',
              value: `${selector}._domainkey`,
              message: `DKIM record found using ${selector} selector`
            });
            dkimFound = true;
            break;
          }
        } catch (error) {
          // Continue to next selector
          continue;
        }
      }

      if (!dkimFound) {
        dnsRecords.push({
          type: 'DKIM',
          status: 'missing',
          expected: 'Configure DKIM in your email provider',
          message: 'DKIM record not found. Set up DKIM in your email service provider (Gmail, Resend, etc.)'
        });
      }

      // Check MX records
      let mxValid = false;
      try {
        const mxResponse = await fetch(`https://dns.google/resolve?name=${domain}&type=MX`);
        const mxData = await mxResponse.json();
        mxValid = mxData.Answer && mxData.Answer.length > 0;
      } catch (error) {
        console.error('Error checking MX:', error);
      }

      // Check blacklists (check against common DNS-based blacklists)
      const blacklistStatus = await checkBlacklists(domain);
      const isBlacklisted = blacklistStatus.blacklisted;
      const blacklistProviders = blacklistStatus.providers;

      result.dnsRecords = dnsRecords;
      result.domainScore = calculateDomainScore(dnsRecords);

      // Get SPF, DKIM, DMARC validity from records
      const spfValid = dnsRecords.find(r => r.type === 'SPF')?.status === 'valid';
      const dkimValid = dnsRecords.find(r => r.type === 'DKIM')?.status === 'valid';
      const dmarcValid = dnsRecords.find(r => r.type === 'DMARC')?.status === 'valid';

      // Calculate sender reputation (simplified for now)
      const reputationScore = Math.round((result.domainScore + 20) * 0.9);

      // Detect email provider
      const emailProvider = detectEmailProvider(domain, dnsRecords);
      
      // Save metrics to database
      const { error: insertError } = await supabaseClient
        .from('email_deliverability_metrics')
        .insert({
          user_id: user.id,
          domain,
          overall_score: result.domainScore,
          sender_reputation: reputationScore,
          spf_valid: spfValid,
          dkim_valid: dkimValid,
          dmarc_valid: dmarcValid,
          mx_records_valid: mxValid,
          blacklisted: isBlacklisted,
          blacklist_providers: blacklistProviders,
          metadata: {
            dns_records: dnsRecords,
            email_provider: emailProvider,
            last_checked: new Date().toISOString(),
          },
        });

      if (insertError) {
        console.error('Error saving deliverability metrics:', insertError);
      } else {
        console.log('Deliverability metrics saved successfully');
      }
    }

    // Analyze email content if provided
    if (emailContent) {
      console.log('Analyzing email content for deliverability');
      
      const contentAnalysis = analyzeEmailContent(emailContent);
      result.contentAnalysis = contentAnalysis;
      result.contentScore = contentAnalysis.score;
    }

    // Overall deliverability score
    if (result.domainScore !== undefined && result.contentScore !== undefined) {
      result.overallScore = Math.round((result.domainScore + result.contentScore) / 2);
    } else if (result.domainScore !== undefined) {
      result.overallScore = result.domainScore;
    } else if (result.contentScore !== undefined) {
      result.overallScore = result.contentScore;
    }

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error in check-email-deliverability:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'An error occurred while checking deliverability',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

function calculateDomainScore(records: DNSRecord[]): number {
  let score = 0;
  const weights = { SPF: 40, DKIM: 35, DMARC: 25 };

  records.forEach(record => {
    if (record.status === 'valid') {
      score += weights[record.type];
    } else if (record.status === 'invalid') {
      score += weights[record.type] * 0.3;
    }
  });

  return Math.round(score);
}

async function checkBlacklists(domain: string): Promise<{ blacklisted: boolean; providers: string[] }> {
  const blacklists = [
    'zen.spamhaus.org',
    'bl.spamcop.net',
    'dnsbl.sorbs.net',
    'b.barracudacentral.org',
  ];
  
  const blacklistedProviders: string[] = [];
  
  // Get the domain's IP addresses from DNS
  try {
    const aResponse = await fetch(`https://dns.google/resolve?name=${domain}&type=A`);
    const aData = await aResponse.json();
    
    if (!aData.Answer || aData.Answer.length === 0) {
      return { blacklisted: false, providers: [] };
    }
    
    const ipAddress = aData.Answer[0].data;
    
    // Reverse the IP for blacklist lookup
    const reversedIp = ipAddress.split('.').reverse().join('.');
    
    // Check each blacklist
    for (const blacklist of blacklists) {
      try {
        const lookupDomain = `${reversedIp}.${blacklist}`;
        const blResponse = await fetch(`https://dns.google/resolve?name=${lookupDomain}&type=A`);
        const blData = await blResponse.json();
        
        // If we get an answer, the IP is blacklisted
        if (blData.Answer && blData.Answer.length > 0) {
          blacklistedProviders.push(blacklist.replace('.org', '').replace('.net', ''));
        }
      } catch (error) {
        // If lookup fails, not blacklisted on this provider
        continue;
      }
    }
  } catch (error) {
    console.error('Error checking blacklists:', error);
  }
  
  return {
    blacklisted: blacklistedProviders.length > 0,
    providers: blacklistedProviders,
  };
}

function detectEmailProvider(domain: string, dnsRecords: DNSRecord[]): string {
  // Check SPF record for provider hints
  const spfRecord = dnsRecords.find(r => r.type === 'SPF');
  if (spfRecord?.value) {
    if (spfRecord.value.includes('_spf.google.com')) return 'Gmail';
    if (spfRecord.value.includes('resend.com')) return 'Resend';
    if (spfRecord.value.includes('spf.protection.outlook.com')) return 'Outlook';
    if (spfRecord.value.includes('sendgrid.net')) return 'SendGrid';
    if (spfRecord.value.includes('mailgun.org')) return 'Mailgun';
  }
  
  // Check DKIM selector for provider hints
  const dkimRecord = dnsRecords.find(r => r.type === 'DKIM');
  if (dkimRecord?.value) {
    if (dkimRecord.value.includes('google')) return 'Gmail';
    if (dkimRecord.value.includes('resend')) return 'Resend';
  }
  
  return 'Custom SMTP';
}

function analyzeEmailContent(content: { subject: string; body: string }) {
  const issues: string[] = [];
  let score = 100;

  const { subject, body } = content;
  const fullText = `${subject} ${body}`.toLowerCase();

  // Spam trigger words
  const spamWords = [
    'free', 'guarantee', 'click here', 'urgent', 'act now', 'limited time',
    'buy now', 'order now', '100%', 'winner', 'congratulations', 'cash',
    'bonus', 'prize', 'claim', 'risk-free', 'no obligation', '$$$'
  ];

  const foundSpamWords = spamWords.filter(word => fullText.includes(word));
  if (foundSpamWords.length > 0) {
    score -= foundSpamWords.length * 5;
    issues.push(`Contains spam trigger words: ${foundSpamWords.slice(0, 3).join(', ')}${foundSpamWords.length > 3 ? '...' : ''}`);
  }

  // All caps in subject
  if (subject.toUpperCase() === subject && subject.length > 5) {
    score -= 15;
    issues.push('Subject line is in all caps');
  }

  // Excessive punctuation
  const exclamationCount = (subject + body).split('!').length - 1;
  if (exclamationCount > 3) {
    score -= 10;
    issues.push('Excessive exclamation marks');
  }

  // Too many links
  const linkCount = (body.match(/https?:\/\//g) || []).length;
  if (linkCount > 5) {
    score -= 10;
    issues.push('Too many links in email body');
  }

  // Subject line length
  if (subject.length < 10) {
    score -= 5;
    issues.push('Subject line is too short');
  } else if (subject.length > 70) {
    score -= 10;
    issues.push('Subject line is too long (may get cut off)');
  }

  // Body length
  if (body.length < 50) {
    score -= 10;
    issues.push('Email body is very short');
  }

  // Positive signals
  const recommendations: string[] = [];
  if (body.includes('unsubscribe')) {
    score += 5;
    recommendations.push('✓ Includes unsubscribe option');
  }
  if (fullText.includes('{{firstname}}') || fullText.includes('{{name}}')) {
    recommendations.push('✓ Uses personalization');
  }
  if (subject.length >= 30 && subject.length <= 50) {
    recommendations.push('✓ Subject line is optimal length');
  }

  score = Math.max(0, Math.min(100, score));

  return {
    score,
    issues,
    recommendations,
    spamRisk: score < 60 ? 'high' : score < 80 ? 'medium' : 'low'
  };
}
