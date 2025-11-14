import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { Resend } from "npm:resend@4.0.0";
import { renderAsync } from "npm:@react-email/components@0.0.22";
import React from "npm:react@18.3.1";
import { WelcomeEmail } from "../_shared/emails/welcome.tsx";

const resend = new Resend(Deno.env.get("RESEND_API_KEY") as string);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[SEND-WELCOME-EMAIL] Function started");

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Get user from request body
    const { userId, email, name } = await req.json();
    console.log("[SEND-WELCOME-EMAIL] Sending welcome email to:", email);

    if (!email) {
      throw new Error("Email is required");
    }

    // Check email preferences
    const { data: prefs } = await supabaseClient
      .from('user_email_preferences')
      .select('welcome_email')
      .eq('user_id', userId)
      .single();

    if (prefs && !prefs.welcome_email) {
      console.log("[SEND-WELCOME-EMAIL] User has disabled welcome emails");
      return new Response(
        JSON.stringify({ success: true, message: "Email disabled by user preference" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Render the email template
    const html = await renderAsync(
      React.createElement(WelcomeEmail, {
        name: name || email.split("@")[0],
        email,
      })
    );

    // Send the email
    const { data, error } = await resend.emails.send({
      from: "Visibill <onboarding@resend.dev>",
      to: [email],
      subject: "Welcome to Visibill - Let's Get Started! 🎉",
      html,
    });

    if (error) {
      console.error("[SEND-WELCOME-EMAIL] Error sending email:", error);
      throw error;
    }

    console.log("[SEND-WELCOME-EMAIL] Welcome email sent successfully:", data);

    return new Response(
      JSON.stringify({ success: true, data }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[SEND-WELCOME-EMAIL] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
