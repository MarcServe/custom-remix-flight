import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailRequest {
  toEmail: string;
  toName: string;
  subject: string;
  body: string;
  companyId?: string;
  contactId?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
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

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const emailRequest: EmailRequest = await req.json();
    const { toEmail, toName, subject, body, companyId, contactId } = emailRequest;

    if (!toEmail || !subject || !body) {
      throw new Error('Missing required fields: toEmail, subject, body');
    }

    console.log(`Sending email to ${toEmail} from user ${user.email}`);

    // Get user's Nango connection
    const { data: connection, error: connectionError } = await supabaseClient
      .from('crm_connections')
      .select('connection_id, provider')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (connectionError || !connection) {
      throw new Error('No active email connection found. Please connect your email account in Settings.');
    }

    const nangoSecretKey = Deno.env.get('NANGO_SECRET_KEY');
    if (!nangoSecretKey) {
      console.error('NANGO_SECRET_KEY environment variable is not set');
      throw new Error('Email integration not configured. Please contact support to set up NANGO_SECRET_KEY.');
    }

    console.log(`Attempting to send email via ${connection.provider} using connection ${connection.connection_id}`);

    // Send email via Nango
    const nangoResponse = await fetch('https://api.nango.dev/v1/gmail/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${nangoSecretKey}`,
        'Connection-Id': connection.connection_id,
        'Provider-Config-Key': connection.provider,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: [{ email: toEmail, name: toName }],
        subject,
        body: {
          content: body,
          type: 'text/plain',
        },
      }),
    });

    if (!nangoResponse.ok) {
      const errorData = await nangoResponse.text();
      console.error('Nango API error:', errorData);
      throw new Error(`Failed to send email via ${connection.provider}: ${errorData}`);
    }

    const nangoData = await nangoResponse.json();
    console.log('Email sent successfully:', nangoData);

    // Log email activity
    const { error: activityError } = await supabaseClient
      .from('email_activities')
      .insert({
        contact_id: contactId || null,
        company_sequence_id: companyId || null,
        step_number: 0,
        status: 'sent',
        subject,
        body,
        sent_at: new Date().toISOString(),
        external_message_id: nangoData.id || null,
        metadata: {
          provider: connection.provider,
          sent_via: 'crm_direct',
        },
      });

    if (activityError) {
      console.error('Failed to log email activity:', activityError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email sent successfully',
        messageId: nangoData.id,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error in send-crm-email function:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'An error occurred while sending the email',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
