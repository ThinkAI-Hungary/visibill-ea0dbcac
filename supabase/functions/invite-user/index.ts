import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── 1. Authenticate the calling user ──
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

    // Verify calling user with anon client
    const anonClient = createClient(supabaseUrl, supabaseAnonKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: callingUser }, error: authError } = await anonClient.auth.getUser(token);

    if (authError || !callingUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 2. Parse & validate body ──
    const { email, name, password, company_id, accounting_firm_id, role } = await req.json();

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return new Response(JSON.stringify({ success: false, error: "valid_email_required" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return new Response(JSON.stringify({ success: false, error: "name_required" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!password || typeof password !== "string" || password.length < 6) {
      return new Response(JSON.stringify({ success: false, error: "password_min_6" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validRoles = ["member", "admin", "assistant", "viewer", "employee", "könyvelő", "senior_könyvelő", "asszisztens", "iroda_admin"];
    const assignRole = role && validRoles.includes(role) ? role : "member";

    // Service role client (bypasses RLS, can create auth users)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── 3. If company_id provided, verify caller is owner/admin ──
    if (company_id) {
      // Check if caller is an accountant firm admin/senior in accounty_assignments
      const isAccountantRole = ["könyvelő", "senior_könyvelő", "asszisztens", "iroda_admin"].includes(role);
      let isAuthorized = false;

      if (isAccountantRole) {
        // Verify caller has role 'iroda_admin' or 'senior_könyvelő' in this firm
        const firmIdForAuth = accounting_firm_id || company_id;
        const { data: callerAssignment } = await adminClient
          .from("accounty_assignments")
          .select("role")
          .eq("accounting_firm_id", firmIdForAuth)
          .eq("accountant_user_id", callingUser.id)
          .in("role", ["iroda_admin", "senior_könyvelő"])
          .limit(1);

        if (callerAssignment && callerAssignment.length > 0) {
          isAuthorized = true;
        }
      }

      if (!isAuthorized) {
        // Check if caller is the company owner
        const { data: company } = await adminClient
          .from("companies")
          .select("owner_id")
          .eq("id", company_id)
          .single();

        const isOwner = company?.owner_id === callingUser.id;

        if (!isOwner) {
          // Check if caller is admin member
          const { data: membership } = await adminClient
            .from("company_members")
            .select("role")
            .eq("company_id", company_id)
            .eq("user_id", callingUser.id)
            .single();

          if (!membership || (membership.role !== "admin" && membership.role !== "owner")) {
            return new Response(JSON.stringify({ success: false, error: "not_admin" }), {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      }
    }

    // ── 4. Check if email already exists ──
    const emailLower = email.trim().toLowerCase();
    const { data: existingUserId, error: rpcError } = await adminClient
      .rpc("get_user_id_by_email", { p_email: emailLower });

    if (rpcError) {
      console.error("[INVITE-USER] RPC check user email error:", rpcError);
    }

    const existingUser = existingUserId ? { id: existingUserId } : null;

    if (existingUser) {
      // User already exists — just add to company if requested
        const isAccountantRole = ["könyvelő", "senior_könyvelő", "asszisztens", "iroda_admin"].includes(role);
        if (isAccountantRole) {
          // UPSERT: if already assigned to this company, update role/firm; otherwise insert
          const firmId = accounting_firm_id || company_id;
          const { error: upsertError } = await adminClient
            .from("accounty_assignments")
            .upsert({
              accountant_user_id: existingUser.id,
              company_id: company_id,
              accounting_firm_id: firmId,
              role: role,
              is_primary: true,
              kanban_status: "aktiv",
              source: "manual"
            }, {
              onConflict: "accountant_user_id,company_id"
            });

          if (upsertError) {
            console.error("[INVITE-USER] Accountant assignment upsert error for existing user:", upsertError);
            return new Response(JSON.stringify({ success: false, error: "member_insert_failed", details: upsertError.message }), {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          return new Response(JSON.stringify({
            success: true,
            existing_user: true,
            user_id: existingUser.id,
            message: "Existing user added/updated in firm assignments",
          }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Check if already a member
        const { data: existingMember } = await adminClient
          .from("company_members")
          .select("id")
          .eq("user_id", existingUser.id)
          .eq("company_id", company_id)
          .single();

        if (existingMember) {
          return new Response(JSON.stringify({ success: false, error: "already_member" }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Add to company
        const { error: memberError } = await adminClient
          .from("company_members")
          .insert({ user_id: existingUser.id, company_id, role: assignRole });

        if (memberError) {
          console.error("[INVITE-USER] Member insert error:", memberError);
          return new Response(JSON.stringify({ success: false, error: "member_insert_failed", details: memberError.message }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({
          success: true,
          existing_user: true,
          user_id: existingUser.id,
          message: "Existing user added to company",
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

      return new Response(JSON.stringify({ success: false, error: "email_exists" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 5. Create the new auth user ──
    const { data: newAuthData, error: createError } = await adminClient.auth.admin.createUser({
      email: emailLower,
      password,
      email_confirm: true, // Admin-invited users don't need email verification
      user_metadata: {
        name: name.trim(),
        invited_by: callingUser.id,
      },
    });

    if (createError) {
      console.error("[INVITE-USER] Create user error:", createError);
      return new Response(JSON.stringify({ success: false, error: "user_create_failed", details: createError.message }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newUserId = newAuthData.user?.id;
    if (!newUserId) {
      return new Response(JSON.stringify({ success: false, error: "user_create_failed", details: "No user ID returned" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[INVITE-USER] User created:", newUserId, emailLower);

    // ── 6. Create profile (if trigger doesn't exist) ──
    const { data: existingProfile } = await adminClient
      .from("profiles")
      .select("id")
      .eq("user_id", newUserId)
      .maybeSingle();

    if (!existingProfile) {
      const { error: profileError } = await adminClient
        .from("profiles")
        .insert({
          user_id: newUserId,
          name: name.trim(),
          email_verified: true,
        });

      if (profileError) {
        console.error("[INVITE-USER] Profile insert error:", profileError);
        // Not fatal — profile trigger might handle it
      }
    } else {
      // Update name if profile was auto-created by trigger
      await adminClient
        .from("profiles")
        .update({ name: name.trim(), email_verified: true })
        .eq("user_id", newUserId);
    }

    // ── 7. Add to company (if requested) ──
    if (company_id) {
      const isAccountantRole = ["könyvelő", "senior_könyvelő", "asszisztens", "iroda_admin"].includes(role);
      if (isAccountantRole) {
        // Add accountant assignment
        const firmIdNew = accounting_firm_id || company_id;
        const { error: assignError } = await adminClient
          .from("accounty_assignments")
          .insert({
            accountant_user_id: newUserId,
            company_id: company_id,
            accounting_firm_id: firmIdNew,
            role: role,
            is_primary: true,
            kanban_status: "aktiv",
            source: "manual"
          });

        if (assignError) {
          console.error("[INVITE-USER] Accountant assignment insert error:", assignError);
        }
      } else {
        const { error: memberError } = await adminClient
          .from("company_members")
          .insert({ user_id: newUserId, company_id, role: assignRole });

        if (memberError) {
          console.error("[INVITE-USER] Member insert error:", memberError);
          // Not fatal — user is created, just not linked yet
        }
      }
    }

    // ── 8. Success ──
    return new Response(JSON.stringify({
      success: true,
      existing_user: false,
      user_id: newUserId,
      email: emailLower,
      name: name.trim(),
      company_id: company_id || null,
      role: company_id ? assignRole : null,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[INVITE-USER] Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
