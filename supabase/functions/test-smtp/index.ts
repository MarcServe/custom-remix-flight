import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SMTPTestRequest {
  host: string;
  port: number;
  username: string;
  password: string;
  secure: boolean;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Testing SMTP connection...');
    
    const { host, port, username, password, secure }: SMTPTestRequest = await req.json();

    if (!host || !port || !username || !password) {
      return new Response(
        JSON.stringify({ error: 'Missing required SMTP configuration fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    try {
      // Test basic TCP connection to SMTP server
      const conn = await Deno.connect({ 
        hostname: host, 
        port: port,
      });
      
      console.log('TCP connection successful');
      
      // Read initial server greeting
      const buffer = new Uint8Array(1024);
      await conn.read(buffer);
      const greeting = new TextDecoder().decode(buffer);
      console.log('Server greeting:', greeting);
      
      // Close the connection
      conn.close();

      // Basic validation that we got an SMTP response
      if (greeting.includes('220') || greeting.includes('SMTP')) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'SMTP server connection successful' 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        return new Response(
          JSON.stringify({ 
            error: 'Connected but did not receive valid SMTP greeting',
            details: greeting.substring(0, 100)
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (smtpError) {
      console.error('SMTP connection failed:', smtpError);
      const errorMessage = smtpError instanceof Error ? smtpError.message : 'Unknown error';
      
      return new Response(
        JSON.stringify({ 
          error: 'Failed to connect to SMTP server',
          details: errorMessage 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error in test-smtp function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: errorMessage 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
