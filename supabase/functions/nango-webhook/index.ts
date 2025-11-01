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
    const webhookData = await req.json();
    console.log('Nango webhook received:', JSON.stringify(webhookData, null, 2));

    const { type, payload } = webhookData;

    // Handle connection.created event
    if (type === 'connection.created') {
      const { connection, provider } = payload;
      
      console.log('Processing connection.created:', {
        connectionId: connection.connection_id,
        provider: provider.provider_config_key,
        userId: connection.connection_id, // Nango uses connection_id as our user_id
      });

      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Store the connection in our database
      const { error: insertError } = await supabaseClient
        .from('crm_connections')
        .upsert({
          user_id: connection.connection_id, // This is the user_id we passed during session creation
          provider: provider.provider_config_key,
          connection_id: connection.id || connection.connection_id,
          status: 'active',
          metadata: {
            email: connection.credentials?.raw?.email || null,
            scopes: connection.credentials?.raw?.scope?.split(' ') || [],
          },
          last_sync_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,provider'
        });

      if (insertError) {
        console.error('Failed to store connection:', insertError);
        return new Response(
          JSON.stringify({ error: 'Failed to store connection', details: insertError.message }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      console.log('Connection stored successfully for user:', connection.connection_id);

      return new Response(
        JSON.stringify({ success: true, message: 'Connection stored successfully' }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Handle connection.deleted event
    if (type === 'connection.deleted') {
      const { connection, provider } = payload;
      
      console.log('Processing connection.deleted:', {
        connectionId: connection.connection_id,
        provider: provider.provider_config_key,
      });

      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Update connection status to disconnected
      const { error: updateError } = await supabaseClient
        .from('crm_connections')
        .update({ status: 'disconnected' })
        .eq('connection_id', connection.id || connection.connection_id);

      if (updateError) {
        console.error('Failed to update connection:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update connection', details: updateError.message }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      console.log('Connection marked as disconnected');

      return new Response(
        JSON.stringify({ success: true, message: 'Connection updated successfully' }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Log other event types but don't process them
    console.log('Received unhandled webhook event type:', type);

    return new Response(
      JSON.stringify({ success: true, message: 'Event received but not processed' }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error processing Nango webhook:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
