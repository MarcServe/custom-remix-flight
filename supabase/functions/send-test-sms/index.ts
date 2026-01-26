import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// Helper function for base64 encoding (works in Deno)
function base64Encode(str: string): string {
  try {
    // btoa should work in Deno, but if it doesn't, use TextEncoder
    if (typeof btoa !== 'undefined') {
      return btoa(str);
    }
    // Fallback for environments without btoa
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    return btoa(String.fromCharCode(...data));
  } catch (error) {
    console.error('Base64 encoding error:', error);
    throw new Error(`Failed to encode credentials: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

Deno.serve(async (req) => {
  console.log('=== send-test-sms function called ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting request processing...');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error('Missing environment variables:', { 
        hasUrl: !!SUPABASE_URL, 
        hasKey: !!SUPABASE_ANON_KEY 
      });
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Server configuration error',
          details: 'Missing required environment variables'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No Authorization header found');
      return new Response(
        JSON.stringify({ success: false, error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        global: {
          headers: { Authorization: authHeader },
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
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized', details: authError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User authenticated:', user.id);

    // Parse request body
    let requestBody;
    try {
      requestBody = await req.json();
      console.log('Request body:', JSON.stringify(requestBody));
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid request body', details: parseError instanceof Error ? parseError.message : 'Unknown error' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { phoneNumber, message, connectionId, provider } = requestBody;

    if (!phoneNumber || !message) {
      return new Response(
        JSON.stringify({ success: false, error: 'Phone number and message are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch phone service connection
    console.log('Fetching connection with ID:', connectionId);
    const { data: connection, error: connectionError } = await supabaseClient
      .from('crm_connections')
      .select('*')
      .eq('id', connectionId || '')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (connectionError) {
      console.error('Connection query error:', connectionError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch phone service connection', details: connectionError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!connection) {
      console.error('Connection not found. ID:', connectionId, 'User:', user.id);
      // Try to find any active phone connections for debugging
      const { data: allConnections } = await supabaseClient
        .from('crm_connections')
        .select('id, provider, status')
        .eq('user_id', user.id)
        .in('provider', ['twilio', 'vonage', 'messagebird', 'plivo']);
      console.log('Available connections for user:', allConnections);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Phone service connection not found',
          details: `No active connection found with ID: ${connectionId}. Available connections: ${JSON.stringify(allConnections || [])}`
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Connection found:', { id: connection.id, provider: connection.provider });

    const connectionProvider = provider || connection.provider;
    const metadata = (connection.metadata || {}) as Record<string, any>;
    
    console.log('Using provider:', connectionProvider);
    console.log('Metadata:', JSON.stringify(metadata));
    console.log('Metadata keys:', Object.keys(metadata));
    
    if (!metadata || typeof metadata !== 'object') {
      console.error('Invalid metadata:', metadata);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Phone service connection metadata is invalid',
          details: 'The connection exists but has no valid metadata'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let result: any;

    // Send SMS based on provider
    switch (connectionProvider) {
      case 'twilio': {
        const accountSid = metadata.account_sid;
        const authToken = metadata.auth_token;
        const fromNumber = metadata.phone_number;

        if (!accountSid || !authToken || !fromNumber) {
          return new Response(
            JSON.stringify({ success: false, error: 'Twilio credentials not configured' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
        const twilioAuth = base64Encode(`${accountSid}:${authToken}`);

        const twilioResponse = await fetch(twilioUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${twilioAuth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            From: fromNumber,
            To: phoneNumber,
            Body: message,
          }),
        });

        if (!twilioResponse.ok) {
          const errorData = await twilioResponse.text();
          console.error('Twilio API error:', errorData);
          
          // Try to parse Twilio error response
          let errorMessage = 'Twilio API error';
          let errorDetails = errorData;
          
          try {
            const errorJson = JSON.parse(errorData);
            if (errorJson.message) {
              errorMessage = errorJson.message;
            }
            if (errorJson.code) {
              // Map common Twilio error codes to user-friendly messages
              const errorCodeMessages: Record<number, string> = {
                20003: 'Invalid Twilio credentials. Please check your Account SID and Auth Token in the Phone Service settings.',
                21211: 'Invalid phone number format.',
                21608: 'The phone number is not a valid mobile number.',
                21610: 'Unsubscribed recipient. The recipient has opted out.',
                21614: 'Invalid "To" phone number.',
                30001: 'Queue overflow. Too many messages queued.',
                30002: 'Account suspended.',
                30003: 'Unreachable destination handset.',
                30005: 'Unknown destination handset.',
                30008: 'Unknown error.',
              };
              
              if (errorCodeMessages[errorJson.code]) {
                errorMessage = errorCodeMessages[errorJson.code];
              } else {
                errorMessage = `Twilio Error ${errorJson.code}: ${errorMessage}`;
              }
            }
            // Check for common error messages
            const errorLower = errorMessage.toLowerCase();
            if (errorLower.includes('insufficient') || errorLower.includes('credit') || errorLower.includes('balance')) {
              errorMessage = 'Insufficient Twilio account credits. Please add funds to your Twilio account.';
            } else if (errorLower.includes('authenticate') || errorLower.includes('authentication') || errorLower.includes('invalid credentials')) {
              errorMessage = 'Invalid Twilio credentials. Please check your Account SID and Auth Token in the Phone Service settings.';
            }
          } catch (parseError) {
            // If parsing fails, use the raw error data
            const errorLower = errorData.toLowerCase();
            if (errorLower.includes('insufficient') || errorLower.includes('credit') || errorLower.includes('balance')) {
              errorMessage = 'Insufficient Twilio account credits. Please add funds to your Twilio account.';
            } else if (errorLower.includes('authenticate') || errorLower.includes('authentication')) {
              errorMessage = 'Invalid Twilio credentials. Please check your Account SID and Auth Token in the Phone Service settings.';
            }
          }
          
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: errorMessage,
              details: errorDetails,
              provider: 'twilio'
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const twilioData = await twilioResponse.json();
        result = {
          success: true,
          messageId: twilioData.sid,
          status: twilioData.status,
          provider: 'twilio',
        };
        break;
      }

      case 'vonage': {
        const apiKey = metadata.api_key;
        const apiSecret = metadata.api_secret;
        const fromNumber = metadata.from_number;

        if (!apiKey || !apiSecret || !fromNumber) {
          return new Response(
            JSON.stringify({ success: false, error: 'Vonage credentials not configured' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const vonageUrl = 'https://rest.nexmo.com/sms/json';
        const vonageResponse = await fetch(vonageUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            api_key: apiKey,
            api_secret: apiSecret,
            from: fromNumber,
            to: phoneNumber,
            text: message,
          }),
        });

        if (!vonageResponse.ok) {
          const errorData = await vonageResponse.text();
          console.error('Vonage API error:', errorData);
          return new Response(
            JSON.stringify({ success: false, error: `Vonage error: ${errorData}` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const vonageData = await vonageResponse.json();
        if (vonageData.messages?.[0]?.status !== '0') {
          return new Response(
            JSON.stringify({ success: false, error: `Vonage error: ${vonageData.messages?.[0]?.['error-text'] || 'Unknown error'}` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        result = {
          success: true,
          messageId: vonageData.messages?.[0]?.['message-id'],
          status: 'sent',
          provider: 'vonage',
        };
        break;
      }

      case 'plivo': {
        const authId = metadata.auth_id;
        const authToken = metadata.auth_token;
        const fromNumber = metadata.phone_number;

        if (!authId || !authToken || !fromNumber) {
          return new Response(
            JSON.stringify({ success: false, error: 'Plivo credentials not configured' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const plivoUrl = `https://api.plivo.com/v1/Account/${authId}/Message/`;
        const plivoAuth = base64Encode(`${authId}:${authToken}`);

        const plivoResponse = await fetch(plivoUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${plivoAuth}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            src: fromNumber,
            dst: phoneNumber,
            text: message,
          }),
        });

        if (!plivoResponse.ok) {
          const errorData = await plivoResponse.text();
          console.error('Plivo API error:', errorData);
          return new Response(
            JSON.stringify({ success: false, error: `Plivo error: ${errorData}` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const plivoData = await plivoResponse.json();
        result = {
          success: true,
          messageId: plivoData.message_uuid?.[0],
          status: 'sent',
          provider: 'plivo',
        };
        break;
      }

      case 'messagebird': {
        const accessKey = metadata.access_key;
        const originator = metadata.originator;

        if (!accessKey || !originator) {
          return new Response(
            JSON.stringify({ success: false, error: 'MessageBird credentials not configured' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const messagebirdUrl = 'https://rest.messagebird.com/messages';
        const messagebirdResponse = await fetch(messagebirdUrl, {
          method: 'POST',
          headers: {
            'Authorization': `AccessKey ${accessKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            originator: originator,
            recipients: [phoneNumber],
            body: message,
          }),
        });

        if (!messagebirdResponse.ok) {
          const errorData = await messagebirdResponse.text();
          console.error('MessageBird API error:', errorData);
          return new Response(
            JSON.stringify({ success: false, error: `MessageBird error: ${errorData}` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const messagebirdData = await messagebirdResponse.json();
        result = {
          success: true,
          messageId: messagebirdData.id,
          status: messagebirdData.status,
          provider: 'messagebird',
        };
        break;
      }

      default:
        console.error('Unsupported provider:', connectionProvider);
        console.error('Available providers: twilio, vonage, messagebird, plivo');
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Unsupported provider: ${connectionProvider}`,
            details: `Provider "${connectionProvider}" is not supported. Supported providers: twilio, vonage, messagebird, plivo`
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    if (!result) {
      console.error('No result generated from provider switch');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to send SMS',
          details: 'Provider handler did not return a result'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('SMS sent successfully:', result);
    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('=== CAUGHT ERROR ===');
    console.error('Error type:', typeof error);
    console.error('Error constructor:', error?.constructor?.name);
    console.error('Error message:', error?.message);
    console.error('Error name:', error?.name);
    console.error('Error stack:', error?.stack);
    
    // Try to stringify the error
    try {
      console.error('Error as JSON:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    } catch (stringifyError) {
      console.error('Could not stringify error:', stringifyError);
    }
    console.error('Error sending test SMS:', error);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);
    console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    
    const errorMessage = error?.message || error?.toString() || 'Failed to send test SMS';
    const errorDetails = error?.stack || error?.details || 'Unknown error';
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        details: errorDetails,
        type: error?.name || 'UnknownError'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
