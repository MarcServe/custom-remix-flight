import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyRequest {
  token?: string;
  code?: string;
  connectionId?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Handle both GET (from email link) and POST (from code input)
    let token: string | undefined;
    let code: string | undefined;
    let connectionId: string | undefined;

    if (req.method === "GET") {
      const url = new URL(req.url);
      token = url.searchParams.get("token") || undefined;
      
      // If accessed via GET, redirect to success page
      if (token) {
        const supabaseClient = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        const { data: connection, error: fetchError } = await supabaseClient
          .from("crm_connections")
          .select("*")
          .eq("verification_token", token)
          .single();

        if (fetchError || !connection) {
          return new Response(
            `<html><body><h1>Invalid or expired verification link</h1></body></html>`,
            { status: 400, headers: { "Content-Type": "text/html" } }
          );
        }

        // Check if token expired
        if (new Date(connection.verification_expires_at) < new Date()) {
          return new Response(
            `<html><body><h1>Verification link has expired</h1></body></html>`,
            { status: 400, headers: { "Content-Type": "text/html" } }
          );
        }

        // Mark as verified
        const { error: updateError } = await supabaseClient
          .from("crm_connections")
          .update({
            status: "active",
            verified_at: new Date().toISOString(),
            verification_token: null,
            verification_expires_at: null,
          })
          .eq("id", connection.id);

        if (updateError) {
          console.error("Error updating connection:", updateError);
          return new Response(
            `<html><body><h1>Verification failed</h1></body></html>`,
            { status: 500, headers: { "Content-Type": "text/html" } }
          );
        }

        console.log(`Email verified via link: ${connection.from_email}`);

        return new Response(
          `<html>
            <body style="font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5;">
              <div style="text-align: center; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <div style="font-size: 64px; margin-bottom: 20px;">✅</div>
                <h1 style="color: #22c55e; margin-bottom: 10px;">Email Verified!</h1>
                <p style="color: #666; margin-bottom: 30px;">Your email address has been successfully verified.</p>
                <p style="color: #999; font-size: 14px;">You can close this window and return to the app.</p>
              </div>
            </body>
          </html>`,
          { status: 200, headers: { "Content-Type": "text/html" } }
        );
      }
    } else if (req.method === "POST") {
      const body: VerifyRequest = await req.json();
      token = body.token;
      code = body.code;
      connectionId = body.connectionId;
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find connection by token or code
    let query = supabaseClient
      .from("crm_connections")
      .select("*")
      .eq("user_id", user.id);

    if (token) {
      query = query.eq("verification_token", token);
    } else if (code && connectionId) {
      query = query.eq("id", connectionId);
    } else {
      return new Response(
        JSON.stringify({ error: "Token or code required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: connection, error: fetchError } = await query.single();

    if (fetchError || !connection) {
      return new Response(
        JSON.stringify({ error: "Invalid verification token or code" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if token expired
    if (new Date(connection.verification_expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Verification code has expired" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify code if provided
    if (code && connection.metadata?.verification_code !== code) {
      return new Response(
        JSON.stringify({ error: "Invalid verification code" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark as verified
    const { error: updateError } = await supabaseClient
      .from("crm_connections")
      .update({
        status: "active",
        verified_at: new Date().toISOString(),
        verification_token: null,
        verification_expires_at: null,
      })
      .eq("id", connection.id);

    if (updateError) {
      console.error("Error updating connection:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to verify email" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Email verified: ${connection.from_email} for user ${user.id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Email verified successfully",
        email: connection.from_email
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in verify-email:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
