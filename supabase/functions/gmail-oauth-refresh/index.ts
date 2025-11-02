import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { connection_id } = await req.json();

    if (!connection_id) {
      throw new Error('connection_id is required');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get connection
    const { data: connection, error: fetchError } = await supabase
      .from('crm_connections')
      .select('*')
      .eq('id', connection_id)
      .eq('provider', 'gmail_direct')
      .single();

    if (fetchError || !connection) {
      throw new Error('Connection not found');
    }

    const refreshToken = connection.metadata.refresh_token;
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    console.log('Refreshing token for connection:', connection_id);

    // Refresh the token
    const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
    const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Token refresh failed:', errorData);
      throw new Error('Failed to refresh token');
    }

    const tokens = await tokenResponse.json();
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    console.log('Got new access token, expires_in:', tokens.expires_in);

    // Update connection with new token
    const { error: updateError } = await supabase
      .from('crm_connections')
      .update({
        metadata: {
          ...connection.metadata,
          access_token: tokens.access_token,
          expires_at: expiresAt,
        },
      })
      .eq('id', connection_id);

    if (updateError) {
      throw updateError;
    }

    console.log('Successfully refreshed token for connection:', connection_id);

    return new Response(
      JSON.stringify({ 
        success: true,
        access_token: tokens.access_token,
        expires_at: expiresAt
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('Error in gmail-oauth-refresh:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
