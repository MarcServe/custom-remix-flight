import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InvitationRequest {
  teamId: string;
  email: string;
  role: string;
  teamName: string;
}

serve(async (req: Request) => {
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

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { teamId, email, role, teamName }: InvitationRequest = await req.json();
    
    console.log('Sending team invitation:', { teamId, email, role, teamName });

    // Get inviter profile
    const { data: inviterProfile } = await supabaseClient
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single();

    // Create invitation in database
    const { data: invitation, error: inviteError } = await supabaseClient
      .from('team_invitations')
      .insert({
        team_id: teamId,
        email: email.toLowerCase(),
        role,
        invited_by_user_id: user.id,
      })
      .select()
      .single();

    if (inviteError) {
      console.error('Error creating invitation:', inviteError);
      return new Response(
        JSON.stringify({ error: 'Failed to create invitation' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send email via Resend
    const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
    const appUrl = Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '') || 'http://localhost:5173';
    const inviteUrl = `${appUrl}/#/auth?invitation=${invitation.token}`;

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);">
    <div style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); padding: 30px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Team Invitation</h1>
    </div>
    
    <div style="padding: 30px;">
      <p style="font-size: 16px; margin-bottom: 20px;">Hi there!</p>
      
      <p style="font-size: 16px; margin-bottom: 20px;">
        <strong>${inviterProfile?.full_name || inviterProfile?.email || 'Someone'}</strong> 
        has invited you to join the team <strong>${teamName}</strong> as a <strong>${role}</strong>.
      </p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${inviteUrl}" 
           style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 600; font-size: 16px;">
          Accept Invitation
        </a>
      </div>
      
      <p style="font-size: 14px; color: #666; margin-top: 30px;">
        Or copy and paste this link into your browser:
      </p>
      <p style="font-size: 12px; color: #8b5cf6; word-break: break-all; background-color: #f5f3ff; padding: 10px; border-radius: 4px;">
        ${inviteUrl}
      </p>
      
      <p style="font-size: 14px; color: #666; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e9ecef;">
        This invitation will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
      </p>
    </div>
  </div>
</body>
</html>
    `.trim();

    const { error: emailError } = await resend.emails.send({
      from: 'Team Invitations <onboarding@resend.dev>',
      to: [email],
      subject: `You've been invited to join ${teamName}`,
      html: emailHtml,
    });

    if (emailError) {
      console.error('Error sending email:', emailError);
      return new Response(
        JSON.stringify({ error: 'Failed to send invitation email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Invitation sent successfully:', invitation.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        invitation: { id: invitation.id, email: invitation.email }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in send-team-invitation:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
