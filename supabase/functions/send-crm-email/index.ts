import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { renderEmailTemplate } from "../_shared/professional-template.ts";
import { encodeRfc2047 } from "../_shared/gmail-utils.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Resend inbound email for receiving replies
const RESEND_INBOUND_EMAIL = 'leadgenie@eldapgraaa.resend.app';

function parseResendError(status: number, bodyText: string): string {
  try {
    const j = JSON.parse(bodyText);
    const msg = j?.message || j?.error || bodyText;
    if (status === 403 && typeof msg === 'string' && (msg.includes('not verified') || msg.includes('domain'))) {
      return `${msg} Add and verify your domain at https://resend.com/domains and use an email from that domain as "Send from" in Settings → Email Providers.`;
    }
    return typeof msg === 'string' ? msg : bodyText;
  } catch {
    return bodyText;
  }
}

interface EmailRequest {
  toEmail: string;
  toName: string;
  subject: string;
  body?: string; // Plain text (legacy)
  bodyHtml?: string; // HTML content
  bodyText?: string; // Plain text version
  companyId?: string;
  contactId?: string;
  sender?: 'gmail' | 'gmail_direct' | 'resend' | 'smtp' | 'sendgrid';
  senderConnectionId?: string; // Specific connection ID to use (optional, will query if not provided)
  testConnection?: boolean; // Test SMTP connection without sending
  enableAutoResponder?: boolean; // Enable AI auto-responder for replies
  templateStyle?: string; // Email template style (professional, modern, minimal, etc.)
  invoiceHtml?: string; // Invoice/Quotation HTML to attach
  invoiceNumber?: string; // Invoice/Quotation number
  attachInvoice?: boolean; // Whether to attach the invoice
  useInboundReplyTo?: boolean; // Use Resend inbound email as Reply-To for tracking replies
  sender_profile_id?: string | null; // Optional sender profile (name/logo) for this email
  attachments?: Array<{ // File attachments
    id?: string;
    file_name: string;
    file_type: string;
    file_size: number;
    storage_path: string;
  }>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting send-crm-email function');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      console.error('Auth error:', authError);
      throw new Error('Unauthorized');
    }

    console.log('User authenticated:', user.id);

    let emailRequest: EmailRequest;
    try {
      emailRequest = await req.json();
      console.log('Request parsed successfully. Fields:', {
        toEmail: emailRequest.toEmail,
        subject: emailRequest.subject,
        hasBodyHtml: !!emailRequest.bodyHtml,
        hasBodyText: !!emailRequest.bodyText,
        hasBody: !!emailRequest.body,
        sender: emailRequest.sender,
        senderConnectionId: emailRequest.senderConnectionId,
      });
    } catch (jsonError) {
      console.error('JSON parse error:', jsonError);
      throw new Error('Invalid JSON in request body');
    }
    
    let { toEmail, toName, subject, body, bodyHtml, bodyText, companyId, contactId, senderConnectionId, sender_profile_id: requestSenderProfileId, testConnection = false, enableAutoResponder = false, templateStyle = 'professional', invoiceHtml, invoiceNumber, attachInvoice = false, useInboundReplyTo = false, attachments = [] } = emailRequest;
    
    // Fetch user profile for signature and business email
    const { data: userProfile } = await supabaseClient
      .from('profiles')
      .select('full_name, job_title, email, avatar_url')
      .eq('id', user.id)
      .single();

    // Fetch business profile for company name, email provider preference, and branding settings
    const { data: businessProfile } = await supabaseClient
      .from('business_profiles')
      .select('company_name, email_header_name, email_provider, email_template_style, email_logo_url, email_brand_color, email_footer_text, email_footer_image_url, email_footer_logo_url, email_sender_image_url, email_sender_name, email_signature_name, email_sender_title, email_sender_email, email_signature, website')
      .eq('user_id', user.id)
      .maybeSingle();

    // Resolve branding: use sender_profile when requested, else business profile
    let branding: {
      companyName: string | null;
      headerName: string | null;
      logoUrl: string | null;
      brandColor: string;
      footerText: string | null;
      footerImageUrl: string | null;
      signature: string | null;
      templateStyle: string;
      senderName: string | null;
      signatureName: string | null;
      senderEmail: string | null;
      senderTitle: string | null;
      senderImageUrl: string | null;
      websiteUrl: string | null;
    } = {
      companyName: businessProfile?.company_name || null,
      headerName: businessProfile?.email_header_name || null,
      logoUrl: businessProfile?.email_logo_url ?? null,
      brandColor: businessProfile?.email_brand_color || '#8b5cf6',
      footerText: businessProfile?.email_footer_text ?? null,
      footerImageUrl: businessProfile?.email_footer_logo_url ?? businessProfile?.email_logo_url ?? null,
      signature: businessProfile?.email_signature ?? null,
      templateStyle: businessProfile?.email_template_style || templateStyle || 'professional',
      senderName: businessProfile?.email_sender_name ?? null,
      signatureName: businessProfile?.email_signature_name ?? null,
      senderEmail: businessProfile?.email_sender_email ?? null,
      senderTitle: businessProfile?.email_sender_title ?? null,
      senderImageUrl: businessProfile?.email_sender_image_url ?? null,
      websiteUrl: businessProfile?.website ?? null,
    };
    if (requestSenderProfileId) {
      const { data: senderProfile } = await supabaseClient
        .from('sender_profiles')
        .select('name, display_name, logo_url, brand_color, footer_text, footer_image_url, footer_logo_url, signature, template_style, sender_name, signature_name, sender_email, sender_title, sender_image_url, website_url')
        .eq('id', requestSenderProfileId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (senderProfile) {
        branding = {
          companyName: businessProfile?.company_name || null,
          headerName: senderProfile.display_name || businessProfile?.email_header_name || null,
          logoUrl: senderProfile.logo_url ?? null,
          brandColor: senderProfile.brand_color || '#8b5cf6',
          footerText: senderProfile.footer_text ?? null,
          footerImageUrl: senderProfile.footer_logo_url ?? senderProfile.logo_url ?? null,
          signature: senderProfile.signature ?? null,
          templateStyle: ['professional', 'minimal', 'modern', 'creative', 'corporate', 'bold', 'elegant'].includes(senderProfile.template_style) ? senderProfile.template_style : 'professional',
          senderName: senderProfile.sender_name ?? null,
          signatureName: senderProfile.signature_name ?? null,
          senderEmail: senderProfile.sender_email ?? null,
          senderTitle: senderProfile.sender_title ?? null,
          senderImageUrl: senderProfile.sender_image_url ?? null,
          websiteUrl: senderProfile.website_url ?? businessProfile?.website ?? null,
        };
      }
    }

    // Determine sender based on business profile preference
    let sender: 'gmail' | 'gmail_direct' | 'resend' | 'smtp' | 'sendgrid' = emailRequest.sender || businessProfile?.email_provider || 'resend';
    
    console.log(`Email provider preference: ${businessProfile?.email_provider}, Using: ${sender}`);

    // Generate thread_id for email threading (used across all sending methods)
    const threadId = `crm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Support both legacy plain text and new HTML emails
    // Note: We'll use renderEmailTemplate which handles signatures, so we extract just the body content
    let emailBodyContent = bodyHtml || (body ? `<p>${body.replace(/\n/g, '</p><p>')}</p>` : '') || '';
    let emailBodyText = bodyText || body || '';
    
    // Ensure emailBodyContent is always a string (not undefined/null)
    if (!emailBodyContent) {
      emailBodyContent = '';
    }
    
    // Remove signature if already included (to avoid duplicates when renderEmailTemplate adds it)
    // Only process if emailBodyContent is a string
    if (typeof emailBodyContent === 'string' && emailBodyContent.length > 0) {
      // Look for common signature patterns - more comprehensive removal
      const signaturePatterns = [
        /<br><br><p>Best regards,.*$/is,
        /<br><br>Best regards,.*$/is,
        /<p>Best regards,.*$/is,
        /\n\nBest regards,.*$/is,
        /Best regards,.*$/is,
        /<div class="signature".*$/is,
        /<div class="email-signature".*$/is,
        /<div[^>]*class="[^"]*signature[^"]*".*$/is,
        /michael orji.*$/is,
        /Michael Orji.*$/is,
        /AI Founding Engineer.*$/is,
        /AI innovation Studio.*$/is,
        /AI Innovation Studio.*$/is,
        /Biz Boosters Ltd.*$/is,
        /biz boosters.*$/is,
      ];
      
      for (const pattern of signaturePatterns) {
        emailBodyContent = emailBodyContent.replace(pattern, '').trim();
      }
      
      // Also remove any trailing signature-like content (multiple newlines/breaks followed by name/email patterns)
      emailBodyContent = emailBodyContent.replace(/(<br\s*\/?>|\n){2,}.*?(michael|orji|biz boosters|founding engineer|AI innovation|innovation studio|@bizboosters).*$/is, '').trim();
    }

    // If invoice is attached, append it to the email body
    if (attachInvoice && invoiceHtml) {
      emailBodyContent += `<hr style="margin: 40px 0; border: none; border-top: 2px solid #e5e7eb;" />`;
      emailBodyContent += `<h2 style="margin-bottom: 20px;">Attached ${invoiceNumber ? invoiceNumber : 'Document'}</h2>`;
      emailBodyContent += invoiceHtml;
    }

    // If body looks like escaped HTML (e.g. &lt;p&gt;), unescape so the template renders real HTML
    if (emailBodyContent && /&lt;/.test(emailBodyContent) && !/<\s*[a-zA-Z]/.test(emailBodyContent)) {
      emailBodyContent = emailBodyContent
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&');
    }

    // Create emailBodyHtml from emailBodyContent for compatibility
    let emailBodyHtml = emailBodyContent;

    // Validate required fields - allow either text or HTML body
    // Check for both undefined/null and empty strings
    const hasTextBody = emailBodyText && emailBodyText.trim().length > 0;
    const hasHtmlBody = emailBodyHtml && emailBodyHtml.trim().length > 0;
    
    if (!toEmail || !subject || (!hasTextBody && !hasHtmlBody)) {
      throw new Error('Missing required fields: toEmail, subject, and at least one of bodyText or bodyHtml');
    }
    
    // When we have HTML, always use tag-stripped HTML for the plain-text part so clients never see raw HTML
    if (hasHtmlBody) {
      emailBodyText = emailBodyHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() || 'Email content';
    } else if (hasTextBody) {
      // Pass plain text to template so bodyTextToHtml() adds paragraphs, spacing, and lists (same as Variant A)
      emailBodyContent = emailBodyText;
    }
    
    // Final safety check - ensure both are non-empty strings
    if (!emailBodyText || emailBodyText.trim().length === 0) {
      emailBodyText = 'Email content';
    }
    if (!emailBodyHtml || emailBodyHtml.trim().length === 0) {
      emailBodyHtml = '<p>Email content</p>';
    }

    console.log(`Sending email to ${toEmail} from user ${user.email} using ${sender}${useInboundReplyTo ? ' (with inbound reply-to tracking)' : ''}`);
    console.log('Email body content length:', {
      emailBodyContent: emailBodyContent?.length || 0,
      emailBodyText: emailBodyText?.length || 0,
      emailBodyHtml: emailBodyHtml?.length || 0,
    });

    // Fetch and prepare attachments if any
    const attachmentData: Array<{ filename: string; content: string; type: string }> = [];
    
    if (attachments && attachments.length > 0) {
      console.log(`Processing ${attachments.length} attachments`);
      
      for (const attachment of attachments) {
        try {
          // Download file from storage
          const { data: fileData, error: downloadError } = await supabaseClient.storage
            .from('crm-files')
            .download(attachment.storage_path);
          
          if (downloadError) {
            console.error(`Failed to download attachment ${attachment.file_name}:`, downloadError);
            continue;
          }
          
          // Convert to base64
          const arrayBuffer = await fileData.arrayBuffer();
          const base64 = btoa(
            new Uint8Array(arrayBuffer)
              .reduce((data, byte) => data + String.fromCharCode(byte), '')
          );
          
          attachmentData.push({
            filename: attachment.file_name,
            content: base64,
            type: attachment.file_type || 'application/octet-stream',
          });
          
          console.log(`Attachment prepared: ${attachment.file_name} (${attachment.file_size} bytes)`);
        } catch (attachError) {
          console.error(`Error processing attachment ${attachment.file_name}:`, attachError);
        }
      }
    }

    let messageId: string | null = null;
    let provider = sender;

    if (sender === 'gmail' || sender === 'gmail_direct') {
      // Send via Gmail Direct OAuth
      let connectionQuery = supabaseClient
        .from('crm_connections')
        .select('id, metadata, from_email')
        .eq('user_id', user.id)
        .in('provider', ['gmail', 'gmail_direct'])
        .eq('status', 'active');
      
      // Use specific connection if provided
      if (senderConnectionId) {
        connectionQuery = connectionQuery.eq('id', senderConnectionId);
      }
      
      const { data: connection, error: connectionError } = await connectionQuery.maybeSingle();

      if (connectionError || !connection) {
        throw new Error('Gmail not connected. Please connect Gmail in Settings.');
      }

      const metadata = connection.metadata as any;
      let accessToken = metadata?.access_token;
      const refreshToken = metadata?.refresh_token;
      const expiresAt = metadata?.expires_at;

      // Check if token is expired and refresh if needed
      if (expiresAt && new Date(expiresAt) <= new Date()) {
        console.log('Gmail access token expired, refreshing...');
        
        const refreshResponse = await supabaseClient.functions.invoke('gmail-oauth-refresh', {
          body: { connection_id: connection.id }
        });

        if (refreshResponse.error || !refreshResponse.data?.access_token) {
          throw new Error('Failed to refresh Gmail token. Please reconnect your Gmail account.');
        }

        accessToken = refreshResponse.data.access_token;
      }

      if (!accessToken) {
        throw new Error('Gmail access token not found. Please reconnect your Gmail account.');
      }

      const fromEmail = branding.senderEmail || connection.from_email || userProfile?.email || user.email;
      if (!fromEmail) {
        throw new Error('Could not determine sender email address.');
      }
      const fromName = branding.senderName || branding.companyName || userProfile?.full_name;

      console.log(`Sending via Gmail Direct API from: ${fromName ? fromName + ' ' : ''}<${fromEmail}>`);

      // Render full branded HTML (same as Resend/SendGrid) so Gmail shows styled email
      let wrappedHtml: string;
      try {
        wrappedHtml = renderEmailTemplate(
          branding.templateStyle,
          {
            body: emailBodyContent || '',
            senderName: fromName || 'Your Business',
            signatureName: branding.signatureName ?? undefined,
            senderEmail: fromEmail,
            senderTitle: branding.senderTitle || userProfile?.job_title,
            companyName: branding.companyName,
            headerName: branding.headerName || undefined,
            logoUrl: branding.logoUrl,
            brandColor: branding.brandColor,
            footerText: branding.footerText,
            footerImageUrl: branding.footerImageUrl,
            signature: branding.signature,
            senderImageUrl: branding.senderImageUrl || userProfile?.avatar_url,
            websiteUrl: branding.websiteUrl ?? undefined,
          }
        );
      } catch (templateError: unknown) {
        console.error('Error rendering email template (Gmail):', templateError);
        throw new Error(`Failed to render email template: ${templateError instanceof Error ? templateError.message : String(templateError)}`);
      }

      const fromLine = fromName
        ? `From: ${encodeRfc2047(fromName)} <${fromEmail}>`
        : `From: ${fromEmail}`;
      const subjectLine = `Subject: ${encodeRfc2047(subject)}`;

      // Build Gmail API message: multipart/mixed with body as multipart/alternative (text + html), then attachments
      const mixedBoundary = '===============' + Math.random().toString().substr(2) + '==';
      const altBoundary = '===============' + Math.random().toString().substr(2) + '==';
      const emailLines = [
        fromLine,
        `To: ${toEmail}`,
        subjectLine,
        'MIME-Version: 1.0',
        `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
        '',
        `--${mixedBoundary}`,
        `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
        '',
        `--${altBoundary}`,
        'Content-Type: text/plain; charset=utf-8',
        '',
        emailBodyText,
        `--${altBoundary}`,
        'Content-Type: text/html; charset=utf-8',
        '',
        wrappedHtml,
        `--${altBoundary}--`,
      ];

      // Add attachments if any
      for (const attachment of attachmentData) {
        emailLines.push(`--${mixedBoundary}`);
        emailLines.push(`Content-Type: ${attachment.type}; name="${attachment.filename}"`);
        emailLines.push('Content-Transfer-Encoding: base64');
        emailLines.push(`Content-Disposition: attachment; filename="${attachment.filename}"`);
        emailLines.push('');
        emailLines.push(attachment.content);
      }

      emailLines.push(`--${mixedBoundary}--`);

      const emailMessage = emailLines.join('\r\n');
      // Gmail API raw is base64url of the UTF-8 bytes; btoa() only accepts Latin1 so encode UTF-8 first
      const utf8Bytes = new TextEncoder().encode(emailMessage);
      const binary = Array.from(utf8Bytes).map((b) => String.fromCharCode(b)).join('');
      const encodedMessage = btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      // Send via Gmail API
      const gmailResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          raw: encodedMessage
        }),
      });

      if (!gmailResponse.ok) {
        const errorData = await gmailResponse.text();
        console.error('Gmail API error:', errorData);
        throw new Error(`Failed to send via Gmail: ${errorData}`);
      }

      const gmailData = await gmailResponse.json();
      messageId = gmailData.id || null;
      provider = 'gmail_direct';
      console.log('Email sent via Gmail Direct:', gmailData);
    } else if (sender === 'smtp') {
      // Send via Resend using verified business email
      let connectionQuery = supabaseClient
        .from('crm_connections')
        .select('from_email, status')
        .eq('user_id', user.id)
        .eq('provider', 'sendgrid')
        .eq('status', 'active');
      
      // Use specific connection if provided
      if (senderConnectionId) {
        connectionQuery = connectionQuery.eq('id', senderConnectionId);
      }
      
      const { data: connection, error: connectionError } = await connectionQuery.maybeSingle();

      if (connectionError || !connection || !connection.from_email) {
        throw new Error('Business Email not configured. Please verify your email in Settings.');
      }

      // Use businessProfile from top-level fetch (already has all needed fields)
      // No need to fetch again - businessProfile is already available in scope

      const fromEmail = branding.senderEmail || connection.from_email || userProfile?.email;
      if (!fromEmail) {
        throw new Error('Business Email not configured. Please set your business email in Settings > Profile.');
      }

      const senderName = branding.senderName || branding.companyName || userProfile?.full_name || 'Your Business';
      
      // Render with branded template
      let wrappedHtml: string;
      try {
        wrappedHtml = renderEmailTemplate(
          branding.templateStyle,
          {
            body: emailBodyContent || '',
            senderName,
            signatureName: branding.signatureName ?? undefined,
            senderEmail: fromEmail,
            senderTitle: branding.senderTitle || userProfile?.job_title,
                companyName: branding.companyName,
                headerName: branding.headerName || undefined,
                logoUrl: branding.logoUrl,
                brandColor: branding.brandColor,
                footerText: branding.footerText,
                footerImageUrl: branding.footerImageUrl,
                signature: branding.signature,
            senderImageUrl: branding.senderImageUrl || userProfile?.avatar_url,
            websiteUrl: branding.websiteUrl ?? undefined,
          }
        );
      } catch (templateError: any) {
        console.error('Error rendering email template (SMTP):', templateError);
        throw new Error(`Failed to render email template: ${templateError instanceof Error ? templateError.message : String(templateError)}`);
      }

      console.log(`Sending via Resend with verified domain: ${senderName} <${connection.from_email}>`);

      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      if (!resendApiKey) {
        throw new Error('Email service not configured.');
      }

      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${senderName} <${fromEmail}>`,
          to: [toEmail],
          subject,
          text: emailBodyText,
          html: wrappedHtml,
          reply_to: useInboundReplyTo ? RESEND_INBOUND_EMAIL : fromEmail, // Use inbound email for reply tracking if enabled
          headers: {
            'X-Entity-Ref-ID': threadId,
            'X-Priority': '3',
            'Importance': 'normal',
          },
          attachments: attachmentData.length > 0 ? attachmentData.map(att => ({
            filename: att.filename,
            content: att.content,
          })) : undefined,
        }),
      });

      if (!resendResponse.ok) {
        const errorData = await resendResponse.text();
        console.error('Resend API error:', errorData);
        throw new Error(parseResendError(resendResponse.status, errorData));
      }

      const resendData = await resendResponse.json();
      messageId = resendData.id || null;
      provider = 'smtp';
      console.log('Email sent successfully via Resend:', resendData);
    } else if (sender === 'sendgrid') {
      // Send via SendGrid
      const sendgridApiKey = Deno.env.get('SENDGRID_API_KEY');
      if (!sendgridApiKey) {
        throw new Error('SendGrid not configured. Please add SENDGRID_API_KEY.');
      }

      // Get verified sender email
      let sendgridConnectionQuery = supabaseClient
        .from('crm_connections')
        .select('from_email')
        .eq('user_id', user.id)
        .eq('provider', 'sendgrid')
        .eq('status', 'active');
      
      // Use specific connection if provided
      if (senderConnectionId) {
        sendgridConnectionQuery = sendgridConnectionQuery.eq('id', senderConnectionId);
      }
      
      const { data: connection } = await sendgridConnectionQuery.maybeSingle();

      const { data: businessProfile } = await supabaseClient
        .from('business_profiles')
        .select('company_name')
        .eq('user_id', user.id)
        .maybeSingle();

      const fromEmail = branding.senderEmail || connection?.from_email || userProfile?.email;
      if (!fromEmail) {
        throw new Error('Business Email not configured. Please set your business email in Settings > Profile and verify it in SendGrid.');
      }
      const senderName = branding.senderName || branding.companyName || userProfile?.full_name || 'Your Business';
      
      // Render with branded template
      let wrappedHtml: string;
      try {
        wrappedHtml = renderEmailTemplate(
          branding.templateStyle,
          {
            body: emailBodyContent || '',
            senderName,
            signatureName: branding.signatureName ?? undefined,
            senderEmail: fromEmail,
            senderTitle: branding.senderTitle || userProfile?.job_title,
                companyName: branding.companyName,
                headerName: branding.headerName || undefined,
                logoUrl: branding.logoUrl,
                brandColor: branding.brandColor,
                footerText: branding.footerText,
                footerImageUrl: branding.footerImageUrl,
                signature: branding.signature,
            senderImageUrl: branding.senderImageUrl || userProfile?.avatar_url,
            websiteUrl: branding.websiteUrl ?? undefined,
          }
        );
      } catch (templateError: any) {
        console.error('Error rendering email template (SMTP):', templateError);
        throw new Error(`Failed to render email template: ${templateError instanceof Error ? templateError.message : String(templateError)}`);
      }

      console.log(`Sending via SendGrid from: ${senderName} <${fromEmail}>`);

      const sendgridResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sendgridApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{
            to: [{ email: toEmail, name: toName }],
            subject: subject,
          }],
          from: {
            email: fromEmail,
            name: senderName,
          },
          reply_to: {
            email: fromEmail,
            name: senderName,
          },
          content: [
            {
              type: 'text/plain',
              value: emailBodyText,
            },
            {
              type: 'text/html',
              value: wrappedHtml,
            },
          ],
          attachments: attachmentData.length > 0 ? attachmentData.map(att => ({
            content: att.content,
            filename: att.filename,
            type: att.type,
            disposition: 'attachment',
          })) : undefined,
          custom_args: {
            thread_id: threadId,
            crm_tracking: 'true',
          },
        }),
      });

      if (!sendgridResponse.ok) {
        const errorData = await sendgridResponse.text();
        console.error('SendGrid API error:', errorData);
        throw new Error(`Failed to send via SendGrid: ${errorData}`);
      }

      // SendGrid returns 202 Accepted with X-Message-Id header
      messageId = sendgridResponse.headers.get('X-Message-Id') || null;
      provider = 'sendgrid';
      console.log('Email sent successfully via SendGrid:', messageId);
    } else {
      // Send via Resend (default)
      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      if (!resendApiKey) {
        throw new Error('Resend not configured. Please contact support.');
      }

      // Get Resend connection for verified from_email
      let resendConnectionQuery = supabaseClient
        .from('crm_connections')
        .select('from_email')
        .eq('user_id', user.id)
        .eq('provider', 'resend')
        .eq('status', 'active');
      
      // Use specific connection if provided
      if (senderConnectionId) {
        resendConnectionQuery = resendConnectionQuery.eq('id', senderConnectionId);
      }
      
      const { data: resendConnection } = await resendConnectionQuery.maybeSingle();

      const fromEmail = branding.senderEmail || resendConnection?.from_email || userProfile?.email || 'onboarding@resend.dev';
      const senderName = branding.senderName || branding.companyName || 'CRM';

      console.log(`Sending via Resend from: ${senderName} <${fromEmail}>`);

      // Render email template with error handling
      let renderedHtml: string;
      try {
        renderedHtml = renderEmailTemplate(
          branding.templateStyle,
          {
            body: emailBodyContent || '',
            senderName,
            signatureName: branding.signatureName ?? undefined,
            senderEmail: fromEmail,
            senderTitle: branding.senderTitle || userProfile?.job_title,
                companyName: branding.companyName,
                headerName: branding.headerName || undefined,
                logoUrl: branding.logoUrl,
                brandColor: branding.brandColor,
                footerText: branding.footerText,
                footerImageUrl: branding.footerImageUrl,
                signature: branding.signature,
            senderImageUrl: branding.senderImageUrl || userProfile?.avatar_url,
            websiteUrl: branding.websiteUrl ?? undefined,
          }
        );
      } catch (templateError: any) {
        console.error('Error rendering email template:', templateError);
        throw new Error(`Failed to render email template: ${templateError instanceof Error ? templateError.message : String(templateError)}`);
      }

      // Prepare request body
      let requestBody: any;
      try {
        requestBody = {
          from: `${senderName} <${fromEmail}>`,
          to: [toEmail],
          subject,
          text: emailBodyText,
          html: renderedHtml,
          reply_to: useInboundReplyTo ? RESEND_INBOUND_EMAIL : fromEmail,
          headers: {
            'X-Entity-Ref-ID': threadId,
            'X-Priority': '3',
            'Importance': 'normal',
          },
        };
        
        // Only add attachments if present
        if (attachmentData.length > 0) {
          requestBody.attachments = attachmentData.map(att => ({
            filename: att.filename,
            content: att.content,
          }));
        }
        
        console.log('Sending to Resend API with:', {
          from: requestBody.from,
          to: requestBody.to,
          subject: requestBody.subject,
          hasHtml: !!requestBody.html,
          hasText: !!requestBody.text,
          attachmentsCount: requestBody.attachments?.length || 0,
        });
      } catch (bodyError: any) {
        console.error('Error preparing request body:', bodyError);
        throw new Error(`Failed to prepare email request: ${bodyError instanceof Error ? bodyError.message : String(bodyError)}`);
      }

      let resendResponse: Response;
      try {
        resendResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });
      } catch (fetchError: any) {
        console.error('Network error calling Resend API:', fetchError);
        throw new Error(`Network error: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`);
      }

      if (!resendResponse.ok) {
        const errorData = await resendResponse.text();
        console.error('Resend API error:', {
          status: resendResponse.status,
          statusText: resendResponse.statusText,
          errorData,
        });
        throw new Error(parseResendError(resendResponse.status, errorData));
      }

      let resendData: any;
      try {
        resendData = await resendResponse.json();
        messageId = resendData.id || null;
        console.log('Email sent via Resend:', resendData);
      } catch (jsonError: any) {
        console.error('Error parsing Resend response:', jsonError);
        // If we can't parse the response but got 200, assume success
        if (resendResponse.ok) {
          console.log('Resend returned OK but unparseable response, assuming success');
          messageId = null;
        } else {
          throw new Error(`Failed to parse Resend response: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`);
        }
      }
    }

    // Check if company has an active sequence
    let linkedSequenceId: string | null = null;
    
    if (companyId) {
      console.log(`Checking for active sequences for company ${companyId}`);
      const { data: activeSequences, error: seqError } = await supabaseClient
        .from('company_sequences')
        .select('id, status')
        .eq('company_id', companyId)
        .in('status', ['active', 'draft'])
        .order('updated_at', { ascending: false })
        .limit(1);
      
      if (!seqError && activeSequences && activeSequences.length > 0) {
        linkedSequenceId = activeSequences[0].id;
        console.log(`Linking email to sequence ${linkedSequenceId}`);
      } else {
        console.log('No active sequences found for company, creating standalone email');
      }
    }

    // Log to email_activities for tracking
    const { data: activityData, error: activityError } = await supabaseClient
      .from('email_activities')
      .insert({
        contact_id: contactId || null,
        company_sequence_id: linkedSequenceId, // Link to sequence if exists, otherwise null
        step_number: linkedSequenceId ? 1 : 0, // If linked to sequence, it's step 1
        status: 'sent',
        subject,
        body: emailBodyText,
        sent_at: new Date().toISOString(),
        external_message_id: messageId,
        thread_id: threadId,
        metadata: {
          provider,
          sent_via: 'crm_direct',
          has_html: !!emailBodyHtml,
          to_email: toEmail,
          to_name: toName,
          company_id: companyId || null,
          auto_linked: !!linkedSequenceId,
          enable_auto_responder: enableAutoResponder,
          template_style: templateStyle,
        },
      })
      .select()
      .single();

    if (activityError) {
      console.error('Failed to log email activity:', activityError);
    }

    // If linked to sequence, update the sequence's current_step and updated_at
    if (linkedSequenceId && activityData) {
      const { error: updateError } = await supabaseClient
        .from('company_sequences')
        .update({
          current_step: 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', linkedSequenceId);
      
      if (updateError) {
        console.error('Failed to update sequence step:', updateError);
      } else {
        console.log('Sequence updated with new step');
      }
    }

    // ALSO create entry in email_threads for conversation view
    // This is KEY for reply tracking and unified conversation view
    if (activityData) {
      try {
        // Get the user's from_email with priority order
        const { data: connection, error: connError } = await supabaseClient
          .from('crm_connections')
          .select('from_email')
          .eq('user_id', user.id)
          .eq('provider', provider)
          .eq('status', 'active')
          .maybeSingle();

        if (connError) {
          console.error('Error fetching connection for email thread:', connError);
        }

        const fromEmail = branding.senderEmail || connection?.from_email || userProfile?.email || user.email || 'noreply@crm.com';

        console.log(`Creating email thread - From: ${fromEmail}, To: ${toEmail}, ThreadID: ${threadId}`);

        const { data: threadData, error: threadError } = await supabaseClient
          .from('email_threads')
          .insert({
            company_sequence_id: linkedSequenceId, // Link to sequence if exists
            from_email: fromEmail,
            to_email: toEmail,
            subject,
            body_text: emailBodyText,
            body_html: emailBodyHtml,
            direction: 'outbound',
            thread_id: threadId,
            message_id: messageId,
            received_at: new Date().toISOString(),
            ai_analysis: null,
            sentiment: null,
          })
          .select()
          .single();

        if (threadError) {
          console.error('❌ CRITICAL: Failed to create email thread:', {
            error: threadError,
            details: {
              fromEmail,
              toEmail,
              threadId,
              messageId,
              userId: user.id,
              provider,
            }
          });
          // Don't throw - email was sent successfully, just log the thread creation failure
        } else {
          console.log('✅ Email thread created successfully:', threadData?.id);
        }
      } catch (threadCreationError) {
        console.error('❌ Exception creating email thread:', threadCreationError);
        // Don't throw - email was sent successfully
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Email sent successfully via ${sender}`,
        messageId,
        provider,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error in send-crm-email function:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    console.error('Error details:', { 
      errorMessage, 
      errorStack, 
      errorName,
      errorType: typeof error,
      errorString: String(error),
      errorJSON: JSON.stringify(error, Object.getOwnPropertyNames(error))
    });
    
    // Return detailed error response
    try {
      return new Response(
        JSON.stringify({
          error: errorMessage || 'An error occurred while sending the email',
          errorType: errorName,
          details: Deno.env.get('ENVIRONMENT') === 'development' ? {
            stack: errorStack,
            fullError: String(error),
          } : undefined,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    } catch (responseError) {
      // If even creating the error response fails, return a minimal response
      console.error('Failed to create error response:', responseError);
      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }
  }
});
