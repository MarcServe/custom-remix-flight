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
    const { provider } = await req.json();

    if (!provider || !['gmail', 'outlook'].includes(provider)) {
      return new Response(
        JSON.stringify({ error: 'Invalid provider. Must be gmail or outlook' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Map frontend provider names to Nango integration IDs
    const integrationIdMap: Record<string, string> = {
      'gmail': 'google-mail',
      'outlook': 'outlook', // Update this if your Nango integration ID is different
    };

    const integrationId = integrationIdMap[provider];

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const nangoSecretKey = Deno.env.get('NANGO_SECRET_KEY');
    if (!nangoSecretKey) {
      console.error('NANGO_SECRET_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Nango not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a session token using Nango API
    const sessionResponse = await fetch('https://api.nango.dev/connect/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${nangoSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        end_user: {
          id: user.id,
          email: user.email,
        },
        allowed_integrations: [integrationId],
      }),
    });

    if (!sessionResponse.ok) {
      const errorText = await sessionResponse.text();
      console.error('Failed to create Nango session:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to create authentication session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sessionData = await sessionResponse.json();
    console.log('Nango session response:', JSON.stringify(sessionData));
    console.log('Created Nango session for provider:', provider, 'user:', user.id);

    // Nango returns the token in different fields depending on the version
    const token = sessionData.token || sessionData.sessionToken || sessionData.data?.token;
    
    if (!token) {
      console.error('No token found in Nango response:', sessionData);
      return new Response(
        JSON.stringify({ error: 'Invalid session response from Nango' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ sessionToken: token }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error in nango-oauth-init:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
