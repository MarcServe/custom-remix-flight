import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerificationRequest {
  email: string;
}

serve(async (req) => {
  console.log("send-verification-email function called");
  
  if (req.method === "OPTIONS") {
    console.log("OPTIONS request received");
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Processing verification request");
    const authHeader = req.headers.get("Authorization");
    console.log("Authorization header present:", !!authHeader);
    
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader! },
        },
      }
    );

    console.log("Getting user from auth header");
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError) {
      console.error("User auth error:", userError);
      return new Response(
        JSON.stringify({ error: "Unauthorized", details: userError.message }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    if (!user) {
      console.error("No user found in session");
      return new Response(
        JSON.stringify({ error: "Unauthorized", details: "No user found" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("User authenticated:", user.id);

    const { email }: VerificationRequest = await req.json();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check rate limiting - max 3 verification emails per hour per email
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabaseClient
      .from("crm_connections")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("from_email", email)
      .gte("created_at", oneHourAgo);

    if (count && count >= 3) {
      return new Response(
        JSON.stringify({ error: "Too many verification attempts. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate verification token and code
    const verificationToken = crypto.randomUUID();
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Store verification token
    const { data: connection, error: insertError } = await supabaseClient
      .from("crm_connections")
      .insert({
        user_id: user.id,
        provider: "verified_email",
        connection_id: `verified_${Date.now()}`,
        status: "pending",
        from_email: email,
        verification_token: verificationToken,
        verification_expires_at: expiresAt.toISOString(),
        metadata: { verification_code: verificationCode },
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating verification record:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create verification record" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send verification email using Resend
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const verificationUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/verify-email?token=${verificationToken}`;

    const { error: emailError } = await resend.emails.send({
      from: "CRM Verification <onboarding@resend.dev>",
      to: [email],
      subject: "Verify your email address",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333; margin-bottom: 20px;">Verify Your Email Address</h1>
          <p style="color: #666; font-size: 16px; line-height: 1.5;">
            Thank you for adding your business email to the CRM. To start sending emails, please verify your email address.
          </p>
          
          <div style="background: #f5f5f5; border-radius: 8px; padding: 20px; margin: 30px 0;">
            <p style="color: #333; font-size: 14px; margin-bottom: 10px;">Your verification code:</p>
            <p style="font-size: 32px; font-weight: bold; color: #333; letter-spacing: 4px; margin: 0;">
              ${verificationCode}
            </p>
          </div>

          <p style="color: #666; font-size: 14px; margin-bottom: 20px;">
            Or click the button below to verify instantly:
          </p>

          <a href="${verificationUrl}" 
             style="display: inline-block; background: #0066cc; color: white; padding: 12px 30px; 
                    text-decoration: none; border-radius: 6px; font-weight: 600;">
            Verify Email Address
          </a>

          <p style="color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
            This verification code will expire in 24 hours. If you didn't request this verification, you can safely ignore this email.
          </p>
        </div>
      `,
    });

    if (emailError) {
      console.error("Error sending verification email:", emailError);
      
      // Clean up the connection record
      await supabaseClient
        .from("crm_connections")
        .delete()
        .eq("id", connection.id);

      return new Response(
        JSON.stringify({ error: "Failed to send verification email" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Verification email sent to ${email} for user ${user.id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Verification email sent",
        connectionId: connection.id
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-verification-email:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
