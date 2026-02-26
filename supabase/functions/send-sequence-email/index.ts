import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { renderEmailTemplate } from '../_shared/professional-template.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_INBOUND_EMAIL = Deno.env.get('RESEND_INBOUND_EMAIL') || 'leadgenie@eldapgraaa.resend.app';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { companySequenceId, stepNumber } = await req.json();

    if (!companySequenceId || stepNumber === undefined) {
      throw new Error('Missing required fields: companySequenceId, stepNumber');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch company sequence with related data (company.user_id for branding when no auth)
    const { data: companySequence, error: sequenceError } = await supabase
      .from('company_sequences')
      .select(`
        *,
        company:companies(id, name, website, user_id),
        sequence:email_sequences(name, use_email_branding)
      `)
      .eq('id', companySequenceId)
      .single();

    if (sequenceError || !companySequence) {
      throw new Error(`Company sequence not found: ${sequenceError?.message}`);
    }

    // Check if sequence is active
    if (companySequence.status !== 'active') {
      throw new Error('Sequence is not active');
    }

    // Get the email step
    const emailStep = companySequence.personalized_emails?.find(
      (e: any) => e.stepNumber === stepNumber
    );

    if (!emailStep) {
      throw new Error(`Step ${stepNumber} not found`);
    }

    // Fetch contacts for this company
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select('*')
      .eq('company_id', companySequence.company_id)
      .eq('email_verified', true)
      .limit(1);

    if (contactsError || !contacts || contacts.length === 0) {
      throw new Error('No verified contacts found for this company');
    }

    const contact = contacts[0];

    // Resolve user: auth token first, else company owner (for server/cron calls)
    const authHeader = req.headers.get('Authorization');
    const token = authHeader ? authHeader.replace('Bearer ', '') : null;
    const { data: { user: authUser } } = token
      ? await supabase.auth.getUser(token)
      : { data: { user: null } };
    const company = companySequence.company as { id: string; name: string; website?: string; user_id?: string } | null;
    const userId = authUser?.id ?? company?.user_id ?? null;

    // Get business profile: email provider and optionally full branding for template
    let emailProvider = 'resend';
    let fromEmail = 'noreply@yourdomain.com';
    let senderName = 'Your Company';
    let branding: { companyName: string | null; headerName: string | null; logoUrl: string | null; brandColor: string; footerText: string | null; footerImageUrl: string | null; signature: string | null; templateStyle: string; senderName: string | null; signatureName: string | null; senderEmail: string | null; senderTitle: string | null; senderImageUrl: string | null; websiteUrl: string | null } | null = null;

    if (userId) {
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('email, full_name, job_title, avatar_url')
        .eq('id', userId)
        .maybeSingle();

      const { data: businessProfile } = await supabase
        .from('business_profiles')
        .select('company_name, email_header_name, email_provider, email_template_style, email_logo_url, email_brand_color, email_footer_text, email_footer_image_url, email_footer_logo_url, email_sender_image_url, email_sender_name, email_signature_name, email_sender_title, email_sender_email, email_signature, website')
        .eq('user_id', userId)
        .maybeSingle();

      emailProvider = businessProfile?.email_provider || 'resend';
      senderName = businessProfile?.company_name || 'Your Company';
      fromEmail = (await (async () => {
        const { data: connection } = await supabase
          .from('crm_connections')
          .select('from_email')
          .eq('user_id', userId)
          .in('provider', [emailProvider, 'smtp'])
          .eq('status', 'active')
          .order('provider', { ascending: emailProvider === 'smtp' })
          .maybeSingle();
        return connection?.from_email || userProfile?.email || 'noreply@yourdomain.com';
      })()) as string;

      const useBranding = (companySequence.sequence as { use_email_branding?: boolean } | null)?.use_email_branding !== false;
      if (useBranding && businessProfile) {
        const bp = businessProfile as Record<string, unknown>;
        branding = {
          companyName: (bp.company_name as string) ?? null,
          headerName: (bp.email_header_name as string) ?? null,
          logoUrl: (bp.email_logo_url as string) ?? null,
          brandColor: (bp.email_brand_color as string) || '#8b5cf6',
          footerText: (bp.email_footer_text as string) ?? null,
          footerImageUrl: (bp.email_footer_logo_url as string) ?? (bp.email_logo_url as string) ?? null,
          signature: (bp.email_signature as string) ?? null,
          templateStyle: (bp.email_template_style as string) || 'professional',
          senderName: (bp.email_sender_name as string) ?? null,
          signatureName: (bp.email_signature_name as string) ?? null,
          senderEmail: (bp.email_sender_email as string) ?? null,
          senderTitle: (bp.email_sender_title as string) ?? null,
          senderImageUrl: (bp.email_sender_image_url as string) ?? null,
          websiteUrl: (bp.website as string) ?? null,
        };
      }
    }

    console.log(`Sending via ${emailProvider} from ${fromEmail}`);

    const plainBody = emailStep.body;
    const htmlBody = branding
      ? renderEmailTemplate(branding.templateStyle, {
          body: plainBody,
          senderName: branding.senderName || senderName,
          signatureName: branding.signatureName ?? undefined,
          senderEmail: fromEmail,
          senderTitle: branding.senderTitle || undefined,
          companyName: branding.companyName ?? undefined,
          headerName: branding.headerName ?? undefined,
          logoUrl: branding.logoUrl ?? undefined,
          brandColor: branding.brandColor,
          footerText: branding.footerText ?? undefined,
          footerImageUrl: branding.footerImageUrl ?? undefined,
          signature: branding.signature ?? undefined,
          senderImageUrl: branding.senderImageUrl ?? undefined,
          websiteUrl: branding.websiteUrl ?? undefined,
        })
      : plainBody.replace(/\n/g, '<br>');

    // Send email via configured provider
    let emailResult: any;
    let externalMessageId: string | undefined;

    if (emailProvider === 'sendgrid' && SENDGRID_API_KEY) {
      const sendgridResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SENDGRID_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{
            to: [{ email: contact.email, name: contact.name }],
            subject: emailStep.subject,
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
            { type: 'text/plain', value: plainBody },
            { type: 'text/html', value: htmlBody },
          ],
          tracking_settings: {
            open_tracking: { enable: true },
            click_tracking: { enable: true, enable_text: true },
          },
          custom_args: {
            company_sequence_id: companySequenceId,
            step_number: stepNumber.toString(),
          },
        }),
      });

      if (!sendgridResponse.ok) {
        const errorText = await sendgridResponse.text();
        throw new Error(`Email send failed via SendGrid: ${errorText}`);
      }

      externalMessageId = sendgridResponse.headers.get('X-Message-Id') || `sendgrid-${crypto.randomUUID()}`;
    } else if (RESEND_API_KEY) {
      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${senderName} <${fromEmail}>`,
          to: contact.email,
          subject: emailStep.subject,
          html: htmlBody,
          text: plainBody,
          reply_to: RESEND_INBOUND_EMAIL,
          tags: [
            { name: 'company_sequence_id', value: companySequenceId },
            { name: 'step_number', value: stepNumber.toString() },
          ],
        }),
      });

      emailResult = await resendResponse.json();

      if (!resendResponse.ok) {
        throw new Error(`Email send failed: ${JSON.stringify(emailResult)}`);
      }

      externalMessageId = emailResult.id;
    } else {
      console.log('RESEND_API_KEY not configured, simulating email send');
      externalMessageId = `simulated-${crypto.randomUUID()}`;
    }

    // Record email activity
    const { error: activityError } = await supabase
      .from('email_activities')
      .insert({
        company_sequence_id: companySequenceId,
        contact_id: contact.id,
        step_number: stepNumber,
        subject: emailStep.subject,
        body: emailStep.body,
        status: 'sent',
        sent_at: new Date().toISOString(),
        external_message_id: externalMessageId,
        metadata: {
          to: contact.email,
          from: fromEmail,
          provider: emailProvider,
          sending_method: emailProvider === 'sendgrid' ? 'api' : 'api',
          tracking_enabled: true,
          can_track_opens: true,
          can_track_clicks: true,
          can_track_replies: emailProvider === 'sendgrid',
        },
      });

    if (activityError) {
      console.error('Failed to record email activity:', activityError);
    }

    // Update company sequence current_step
    const { error: updateError } = await supabase
      .from('company_sequences')
      .update({
        current_step: stepNumber,
        updated_at: new Date().toISOString(),
      })
      .eq('id', companySequenceId);

    if (updateError) {
      console.error('Failed to update company sequence:', updateError);
    }

    // Check if this was the last step
    const isLastStep = stepNumber >= (companySequence.personalized_emails?.length || 0) - 1;
    if (isLastStep) {
      await supabase
        .from('company_sequences')
        .update({ status: 'completed' })
        .eq('id', companySequenceId);
    }

    console.log(`Email sent successfully for sequence ${companySequenceId}, step ${stepNumber}`);

    return new Response(
      JSON.stringify({
        success: true,
        emailId: externalMessageId,
        recipient: contact.email,
        step: stepNumber,
        isLastStep,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in send-sequence-email:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
