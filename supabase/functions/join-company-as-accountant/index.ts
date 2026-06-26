import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * join-company-as-accountant
 * 
 * Validates a company share_token and creates an accounty_assignment
 * linking the authenticated user (accountant) to the company.
 * 
 * This is separate from join-company (which creates company_members for eaisybill).
 * 
 * Input:  { share_token: string }
 * Output: { success: true, company: { id, name, tax_number }, assignment_id: string }
 *      or { error: "invalid_code" | "token_expired" | "already_assigned" }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse body
    const { share_token } = await req.json();
    if (!share_token || typeof share_token !== "string" || share_token.trim().length === 0) {
      return new Response(JSON.stringify({ error: "share_token is required" }), {
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
      return new Response(JSON.stringify({ error: "invalid_code" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check token expiration (10 minutes)
    if (company.share_token_created_at) {
      const createdAt = new Date(company.share_token_created_at).getTime();
      const now = Date.now();
      if (now - createdAt > 10 * 60 * 1000) {
        return new Response(JSON.stringify({ error: "token_expired" }), {
          status: 410,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Check if already assigned as accountant
    const { data: existing } = await adminClient
      .from("accounty_assignments")
      .select("id")
      .eq("accountant_user_id", user.id)
      .eq("company_id", company.id)
      .single();

    if (existing) {
      return new Response(JSON.stringify({ error: "already_assigned" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create accounty_assignment
    const { data: assignment, error: insertError } = await adminClient
      .from("accounty_assignments")
      .insert({
        accountant_user_id: user.id,
        company_id: company.id,
        accounting_firm_id: company.id,
        role: "könyvelő",
        is_primary: true,
        is_main_accountant: true,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: "insert_failed", details: insertError.message }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      company: {
        id: company.id,
        name: company.name,
        tax_number: company.tax_number,
      },
      assignment_id: assignment.id,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
