import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const connectionId = url.searchParams.get('connection_id');
    const integrationId = url.searchParams.get('integration_id');
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');

    console.log('OAuth callback received:', { connectionId, integrationId, code: code ? 'present' : 'missing', error });

    if (error) {
      console.error('OAuth error:', error);
      // Redirect to integrations page with error
      return Response.redirect(
        `${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovable.app')}/integrations?error=${encodeURIComponent(error)}`,
        302
      );
    }

    if (!connectionId || !integrationId || !code) {
      console.error('Missing required parameters:', { connectionId, integrationId, code });
      return Response.redirect(
        `${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovable.app')}/integrations?error=missing_parameters`,
        302
      );
    }

    // Exchange code for access token with Nango
    const nangoSecretKey = Deno.env.get('NANGO_SECRET_KEY');
    if (!nangoSecretKey) {
      console.error('NANGO_SECRET_KEY not configured');
      return Response.redirect(
        `${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovable.app')}/integrations?error=server_configuration`,
        302
      );
    }

    // Verify the connection was created successfully with Nango
    const verifyResponse = await fetch(
      `https://api.nango.dev/connection/${connectionId}?provider_config_key=${integrationId}`,
      {
        headers: {
          'Authorization': `Bearer ${nangoSecretKey}`,
        },
      }
    );

    if (!verifyResponse.ok) {
      const errorText = await verifyResponse.text();
      console.error('Failed to verify Nango connection:', verifyResponse.status, errorText);
      return Response.redirect(
        `${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovable.app')}/integrations?error=connection_failed`,
        302
      );
    }

    const connectionData = await verifyResponse.json();
    console.log('Nango connection verified:', connectionData);

    // Store the connection in our database
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { error: insertError } = await supabaseClient
      .from('crm_connections')
      .upsert({
        user_id: connectionId, // connectionId is the user_id we passed in oauth init
        provider: integrationId,
        connection_id: connectionData.id || connectionId,
        status: 'active',
        metadata: {
          email: connectionData.credentials?.raw?.email || null,
          scopes: connectionData.credentials?.raw?.scope?.split(' ') || [],
        },
        last_sync_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,provider'
      });

    if (insertError) {
      console.error('Failed to store connection:', insertError);
      return Response.redirect(
        `${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovable.app')}/integrations?error=database_error`,
        302
      );
    }

    console.log('Connection stored successfully for user:', connectionId);

    // Redirect to integrations page with success
    return Response.redirect(
      `${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovable.app')}/integrations?success=true`,
      302
    );
  } catch (error) {
    console.error('Error in nango-oauth-callback:', error);
    return Response.redirect(
      `${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovable.app')}/integrations?error=unknown`,
      302
    );
  }
});
