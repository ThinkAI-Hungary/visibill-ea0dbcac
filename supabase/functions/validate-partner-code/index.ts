import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * validate-partner-code
 * 
 * Read-only validation of a company share_token.
 * Used by eaisybooks NewClientPage to verify a partner invite code
 * before creating an accounty_assignment.
 * 
 * Input:  { share_token: string }
 * Output: { valid: true, company: { id, name, tax_number } }
 *      or { valid: false, error: "invalid_code" | "token_expired" }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ valid: false, error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user with anon client
    const anonClient = createClient(supabaseUrl, supabaseAnonKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ valid: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse body
    const { share_token } = await req.json();
    if (!share_token || typeof share_token !== "string" || share_token.trim().length === 0) {
      return new Response(JSON.stringify({ valid: false, error: "share_token is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role client to bypass RLS
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Find company by share_token
    const { data: company, error: findError } = await adminClient
      .from("companies")
      .select("id, name, tax_number, share_token_created_at")
      .eq("share_token", share_token.trim())
      .single();

    if (findError || !company) {
      return new Response(JSON.stringify({ valid: false, error: "invalid_code" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check token expiration (10 minutes)
    if (company.share_token_created_at) {
      const createdAt = new Date(company.share_token_created_at).getTime();
      const now = Date.now();
      if (now - createdAt > 10 * 60 * 1000) {
        return new Response(JSON.stringify({ valid: false, error: "token_expired" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Return company info (read-only — no DB mutations)
    return new Response(JSON.stringify({
      valid: true,
      company: {
        id: company.id,
        name: company.name,
        tax_number: company.tax_number,
      },
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ valid: false, error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
