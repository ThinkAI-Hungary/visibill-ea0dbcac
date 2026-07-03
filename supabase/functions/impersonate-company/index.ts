import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing authorization header" }, 401);
    }

    // Create admin client (service_role) for bypassing RLS
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Create user client to verify the calling user
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get the calling user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    // Verify the user is a support_admin
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("is_support_admin")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile?.is_support_admin) {
      return json({ error: "Forbidden: not a support admin" }, 403);
    }

    // Parse request body
    const { action, companyId } = await req.json();

    if (!companyId) {
      return json({ error: "companyId is required" }, 400);
    }

    if (!["start", "stop"].includes(action)) {
      return json({ error: "action must be 'start' or 'stop'" }, 400);
    }

    // Verify the target company exists
    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .select("id, name")
      .eq("id", companyId)
      .single();

    if (companyError || !company) {
      return json({ error: "Company not found" }, 404);
    }

    if (action === "start") {
      // Check if there's already an active impersonation for this user+company
      const { data: existing } = await supabaseAdmin
        .from("company_members")
        .select("id")
        .eq("user_id", user.id)
        .eq("company_id", companyId)
        .single();

      if (existing) {
        // User is already a member (or has an active impersonation) — just update timestamp
        await supabaseAdmin
          .from("company_members")
          .update({ 
            role: "support_admin",
            impersonation_started_at: new Date().toISOString()
          })
          .eq("id", existing.id);
      } else {
        // Insert new support_admin membership
        const { error: insertError } = await supabaseAdmin
          .from("company_members")
          .insert({
            user_id: user.id,
            company_id: companyId,
            role: "support_admin",
            impersonation_started_at: new Date().toISOString(),
          });

        if (insertError) {
          return json({ error: `Failed to start impersonation: ${insertError.message}` }, 500);
        }
      }

      // Audit log
      await supabaseAdmin.from("app_error_logs").insert({
        user_id: user.id,
        company_id: companyId,
        error_type: "impersonation_start",
        source: "edge_function",
        component: "impersonate-company",
        action: "impersonation_start",
        message: `Support admin started impersonation of company: ${company.name}`,
        metadata: { companyName: company.name, adminEmail: user.email },
      });

      // Also grant eaisybooks access: create temporary accounty_assignments
      // so the support_admin can see ALL clients of this accounting firm
      // Step 1: Find all unique company_ids managed by this firm
      const { data: firmAssignments } = await supabaseAdmin
        .from("accounty_assignments")
        .select("company_id, accounting_firm_id")
        .eq("accounting_firm_id", companyId);

      // Step 2: Also check if this company is a CLIENT of another firm
      const { data: clientAssignment } = await supabaseAdmin
        .from("accounty_assignments")
        .select("company_id, accounting_firm_id")
        .eq("company_id", companyId)
        .limit(1)
        .maybeSingle();

      // Collect all company_ids we need to create assignments for
      const assignmentCompanyIds = new Set<string>();
      let firmId = companyId; // default: the impersonated company IS the firm

      if (firmAssignments && firmAssignments.length > 0) {
        // This company IS an accounting firm — add all its clients
        for (const a of firmAssignments) {
          assignmentCompanyIds.add(a.company_id);
        }
      } else if (clientAssignment) {
        // This company is a client of another firm — just add this company
        firmId = clientAssignment.accounting_firm_id;
        assignmentCompanyIds.add(companyId);
      }

      if (assignmentCompanyIds.size > 0) {
        // Check which assignments already exist for this user
        const { data: existingImps } = await supabaseAdmin
          .from("accounty_assignments")
          .select("company_id")
          .eq("accountant_user_id", user.id)
          .in("company_id", Array.from(assignmentCompanyIds));

        const existingSet = new Set((existingImps || []).map(e => e.company_id));

        // Insert missing assignments
        const toInsert = Array.from(assignmentCompanyIds)
          .filter(cid => !existingSet.has(cid))
          .map(cid => ({
            accountant_user_id: user.id,
            company_id: cid,
            accounting_firm_id: firmId,
            role: "iroda_admin",
            is_impersonation: true,
          }));

        if (toInsert.length > 0) {
          await supabaseAdmin.from("accounty_assignments").insert(toInsert);
        }
      }

      return json({
        success: true,
        action: "start",
        companyId,
        companyName: company.name,
        message: `Impersonation started for ${company.name}`,
      });

    } else if (action === "stop") {
      // Delete the support_admin membership
      const { error: deleteError } = await supabaseAdmin
        .from("company_members")
        .delete()
        .eq("user_id", user.id)
        .eq("company_id", companyId)
        .eq("role", "support_admin");

      if (deleteError) {
        return json({ error: `Failed to stop impersonation: ${deleteError.message}` }, 500);
      }

      // Also remove ALL temporary accounty_assignments for this user
      await supabaseAdmin
        .from("accounty_assignments")
        .delete()
        .eq("accountant_user_id", user.id)
        .eq("is_impersonation", true);

      // Audit log
      await supabaseAdmin.from("app_error_logs").insert({
        user_id: user.id,
        company_id: companyId,
        error_type: "impersonation_stop",
        source: "edge_function",
        component: "impersonate-company",
        action: "impersonation_stop",
        message: `Support admin stopped impersonation of company: ${company.name}`,
        metadata: { companyName: company.name, adminEmail: user.email },
      });

      return json({
        success: true,
        action: "stop",
        companyId,
        companyName: company.name,
        message: `Impersonation stopped for ${company.name}`,
      });
    }

    return json({ error: "Invalid action" }, 400);

  } catch (err) {
    console.error("impersonate-company error:", err);
    return json({ error: `Internal error: ${(err as Error).message}` }, 500);
  }
});
