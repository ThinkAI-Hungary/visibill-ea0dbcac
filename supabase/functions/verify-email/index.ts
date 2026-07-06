import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const APP_URL = "https://app.visibill.hu";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Missing token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[VERIFY-EMAIL] Verifying token:", token.substring(0, 8) + "...");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Find profile with this token
    const { data: profile, error: findError } = await supabase
      .from("profiles")
      .select("id, user_id, email_verified")
      .eq("email_verify_token", token)
      .single();

    if (findError || !profile) {
      console.error("[VERIFY-EMAIL] Token not found:", findError?.message);
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (profile.email_verified) {
      console.log("[VERIFY-EMAIL] Already verified");
      return new Response(
        JSON.stringify({ success: true, message: "Already verified" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark as verified and clear the token
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ email_verified: true, email_verify_token: null })
      .eq("id", profile.id);

    if (updateError) {
      console.error("[VERIFY-EMAIL] Update error:", updateError.message);
      return new Response(
        JSON.stringify({ error: "Verification failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[VERIFY-EMAIL] Successfully verified user:", profile.user_id);

    // Also confirm the user in Supabase auth (sets email_confirmed_at).
    // This satisfies the "Confirm email" setting in the Supabase dashboard,
    // so the user can log in even when email confirmation is required.
    const { error: authConfirmError } = await supabase.auth.admin.updateUserById(
      profile.user_id,
      { email_confirm: true }
    );
    if (authConfirmError) {
      // Non-fatal — profiles.email_verified is already set, log and continue
      console.warn("[VERIFY-EMAIL] Auth confirm warning:", authConfirmError.message);
    } else {
      console.log("[VERIFY-EMAIL] Auth email_confirmed_at set for user:", profile.user_id);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[VERIFY-EMAIL] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
