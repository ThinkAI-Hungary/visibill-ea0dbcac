import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

// ─── CORS Headers ──────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
};

// ─── Response Helpers ──────────────────────────────────────────
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const errorResponse = (code: string, message: string, status = 400, details?: unknown) =>
  json({ success: false, error: { code, message, details } }, status);

// ─── SHA-256 Hash Helper ───────────────────────────────────────
async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ─── Requester Context ─────────────────────────────────────────
interface RequesterContext {
  userId: string;
  name: string;
  email: string;
  role: string;
  isSupportAdmin: boolean;
  authType: "api_key" | "jwt";
}

// ─── Authenticate Requester (API Key or JWT) ───────────────────
async function authenticateRequester(
  req: Request,
  admin: SupabaseClient,
  supabaseUrl: string,
  anonKey: string
): Promise<{ context?: RequesterContext; errorResponse?: Response }> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const apiKeyHeader = req.headers.get("x-api-key") ?? "";

  let token = "";
  if (authHeader.startsWith("Bearer ")) {
    token = authHeader.replace(/^Bearer\s+/i, "").trim();
  } else if (apiKeyHeader) {
    token = apiKeyHeader.trim();
  }

  if (!token) {
    return {
      errorResponse: errorResponse(
        "UNAUTHORIZED",
        "Hiányzó hitelesítés. Kérjük adj meg 'Authorization: Bearer <kulcs>' vagy 'x-api-key: <kulcs>' fejlécet. Támogatott: vb_... API kulcs vagy Supabase Auth JWT token.",
        401
      ),
    };
  }

  // 1. API Key Auth (vb_...)
  if (token.startsWith("vb_")) {
    const keyHash = await sha256(token);
    const { data: keyRecord, error: keyErr } = await admin
      .from("api_keys")
      .select("id, user_id, is_active, expires_at, name, scope")
      .eq("key_hash", keyHash)
      .maybeSingle();

    if (keyErr || !keyRecord) {
      return {
        errorResponse: errorResponse("UNAUTHORIZED", "Érvénytelen vagy nem létező API kulcs.", 401),
      };
    }

    if (!keyRecord.is_active) {
      return {
        errorResponse: errorResponse("FORBIDDEN", "Az API kulcs vissza lett vonva (inaktív).", 403),
      };
    }

    if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
      return {
        errorResponse: errorResponse("FORBIDDEN", "Az API kulcs érvényességi ideje lejárt.", 403),
      };
    }

    // Update last_used_at asynchronously
    admin
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", keyRecord.id)
      .then(() => {});

    const targetUserId = keyRecord.user_id;
    if (!targetUserId) {
      return {
        errorResponse: errorResponse("FORBIDDEN", "A kulcshoz nem tartozik felhasználói profil.", 403),
      };
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("user_id, name, role, is_support_admin")
      .eq("user_id", targetUserId)
      .maybeSingle();

    const isManagementOrSupport =
      profile?.role === "thinkai" ||
      profile?.role === "management" ||
      profile?.is_support_admin === true;

    if (!isManagementOrSupport) {
      return {
        errorResponse: errorResponse(
          "FORBIDDEN",
          "Hozzáférés megtagadva: az API kulcs tulajdonosa nem rendelkezik management vagy support jogosultsággal.",
          403
        ),
      };
    }

    let email = "support@thinkai.hu";
    try {
      const { data: userData } = await admin.auth.admin.getUserById(targetUserId);
      if (userData?.user?.email) email = userData.user.email;
    } catch (_) {}

    return {
      context: {
        userId: targetUserId,
        name: profile?.name || keyRecord.name || "Support Felhasználó",
        email,
        role: profile?.role || "thinkai",
        isSupportAdmin: Boolean(profile?.is_support_admin),
        authType: "api_key",
      },
    };
  }

  // 2. Supabase Auth JWT token
  const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
  });

  if (!userResp.ok) {
    return {
      errorResponse: errorResponse("UNAUTHORIZED", "Érvénytelen vagy lejárt JWT token.", 401),
    };
  }

  const userData = await userResp.json();
  const userId = userData.id;
  if (!userId) {
    return {
      errorResponse: errorResponse("UNAUTHORIZED", "Nem sikerült azonosítani a felhasználót.", 401),
    };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("user_id, name, role, is_support_admin")
    .eq("user_id", userId)
    .maybeSingle();

  const isManagementOrSupport =
    profile?.role === "thinkai" ||
    profile?.role === "management" ||
    profile?.is_support_admin === true;

  if (!isManagementOrSupport) {
    return {
      errorResponse: errorResponse(
        "FORBIDDEN",
        "Hozzáférés megtagadva: a fiók nem rendelkezik management vagy support admin jogosultsággal.",
        403
      ),
    };
  }

  return {
    context: {
      userId,
      name: profile?.name || userData.user_metadata?.name || userData.email || "Support Felhasználó",
      email: userData.email || "",
      role: profile?.role || "thinkai",
      isSupportAdmin: Boolean(profile?.is_support_admin),
      authType: "jwt",
    },
  };
}

// ─── Resolve Ticket Helper (UUID or ticket_number) ─────────────
async function resolveTicket(admin: SupabaseClient, identifier: string) {
  const trimmed = (identifier || "").trim();
  if (!trimmed) return null;

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
  if (isUuid) {
    const { data } = await admin.from("feedback").select("*").eq("id", trimmed).maybeSingle();
    if (data) return data;
  }

  // Look up by ticket_number variations (#1024, 1024, EB-0024)
  const searchTerms = [trimmed];
  if (trimmed.startsWith("#")) {
    searchTerms.push(trimmed.slice(1));
  } else {
    searchTerms.push("#" + trimmed);
  }
  const cleanNum = trimmed.replace(/^#/, "");
  if (/^\d+$/.test(cleanNum)) {
    searchTerms.push("EB-" + cleanNum.padStart(4, "0"));
  }

  const { data } = await admin
    .from("feedback")
    .select("*")
    .in("ticket_number", searchTerms)
    .limit(1)
    .maybeSingle();

  return data || null;
}

// ─── Main Handler ──────────────────────────────────────────────
serve(async (req: Request) => {
  // 1. CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[TICKETS-API] Missing Supabase environment variables");
      return errorResponse("SERVER_CONFIG_ERROR", "Szerver konfigurációs hiba", 500);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const url = new URL(req.url);
    let action = url.searchParams.get("action")?.toLowerCase() || "";

    // Parse body if POST
    let body: any = {};
    if (req.method === "POST" || req.method === "PATCH") {
      body = await req.json().catch(() => ({}));
      if (!action && body.action) {
        action = String(body.action).toLowerCase();
      }
    }

    // Default action for GET is 'list' or 'help'
    if (!action) {
      action = req.method === "GET" ? "list" : "help";
    }

    // Action: help does not require auth
    if (action === "help" || action === "docs") {
      return json({
        success: true,
        api: "VisiBill Ticket Management API",
        version: "1.0",
        description:
          "Külső Ticket Kezelő REST API management és support admin felhasználók számára. Felület nélküli lekérdezés, jegykezelés, válaszadás és státuszváltás.",
        authentication: {
          header: "Authorization: Bearer <API_KEY_OR_JWT> vagy x-api-key: <API_KEY>",
          key_format: "vb_... (állandó M2M kulcs) vagy Supabase Bearer JWT",
        },
        actions: {
          "overview": {
            method: "GET",
            description: "Összesített KPI mutatók (nyitott, megoldott, válaszra váró jegyek).",
            example: "?action=overview",
          },
          "list": {
            method: "GET",
            description: "Hibajegyek listázása, szűrése és keresése.",
            params: {
              status: "open (alapértelmezett) | all | created | assigned | in_progress | resolved",
              assigned_to: "all (alapértelmezett) | me | unassigned | <user_uuid>",
              needs_response: "true | false (a mi válaszunkra váró jegyek)",
              priority: "critical | high | medium | low",
              category: "kategória szűrő",
              search: "szöveges keresés jegyszámban, cégnévben, emailben vagy üzenetben",
              limit: "maximum darabszám (alapértelmezett: 50, max: 200)",
              offset: "lapozási eltolás",
            },
            example: "?action=list&status=open&needs_response=true",
          },
          "get": {
            method: "GET",
            description: "Konkrét hibajegy adatlapja a teljes beszélgetésfolyammal és eseménytörténettel.",
            params: {
              ticket: "Jegyszám (pl. 1024, #1024, EB-0024) vagy jegy UUID",
            },
            example: "?action=get&ticket=1024",
          },
          "comment": {
            method: "POST",
            description: "Ügyfélszolgálati válasz küldése vagy belső jegyzet rögzítése.",
            body: {
              ticket: "Jegyszám vagy UUID (kötelező)",
              message: "Válaszüzenet szövege (kötelező)",
              is_internal: "true: belső jegyzet, false (alapértelmezett): ügyfélnek kiküldött válasz",
              attachments: "Csatolmány URL-ek tömbje (opcionális)",
              needs_staff_response: "false (alapértelmezett válasznál) vagy true",
              status: "opcionális új státusz (pl. in_progress, resolved)",
            },
            example_body: {
              ticket: "1024",
              message: "Kedves Tamás! A NAV szinkronizáció beállítását javítottuk.",
              is_internal: false,
            },
          },
          "update": {
            method: "POST",
            description: "Hibajegy státuszának, felelősének vagy prioritásának módosítása.",
            body: {
              ticket: "Jegyszám vagy UUID (kötelező)",
              status: "created | assigned | in_progress | resolved",
              priority: "low | medium | high | critical",
              category: "kategória megnevezése",
              assigned_to: "'me' (hozzám rendelés) | <user_uuid> | null (kiosztás törlése)",
              needs_staff_response: "true | false",
            },
            example_body: {
              ticket: "1024",
              assigned_to: "me",
              status: "in_progress",
            },
          },
          "resolve": {
            method: "POST",
            description: "Gyors jegylezárás vagy ügyféli megerősítés kérése.",
            body: {
              ticket: "Jegyszám vagy UUID (kötelező)",
              comment: "Lezáró üzenet az ügyfélnek (opcionális)",
              request_confirmation: "true: megerősítés kérése, false (alapértelmezett): azonnali lezárás",
            },
            example_body: {
              ticket: "1024",
              comment: "A hiba elhárult, a jegyet lezártuk.",
              request_confirmation: false,
            },
          },
          "create": {
            method: "POST",
            description: "Új hibajegy létrehozása ügyfél vagy cég nevében.",
            body: {
              message: "Probléma leírása (kötelező)",
              target_user_id: "Érintett felhasználó UUID (vagy target_email)",
              target_email: "Érintett felhasználó email címe (ha az ID nem ismert)",
              company_id: "Cég azonosítója (opcionális)",
              company_name: "Cég neve (opcionális)",
              type: "bug | feedback | question (alapértelmezett: feedback)",
              priority: "low | medium | high | critical (alapértelmezett: medium)",
              category: "kategória (opcionális)",
              assigned_to: "'me' vagy felelős UUID",
            },
          },
        },
      });
    }

    // Authenticate requester
    const { context, errorResponse: authError } = await authenticateRequester(
      req,
      admin,
      supabaseUrl,
      anonKey
    );

    if (authError || !context) {
      return authError || errorResponse("UNAUTHORIZED", "Hitelesítési hiba", 401);
    }

    // ── Action: overview ─────────────────────────────────────────
    if (action === "overview") {
      const [
        { count: totalCount },
        { count: resolvedCount },
        { count: openCount },
        { count: needsResponseCount },
        { count: unassignedCount },
        { count: assignedToMeCount },
        { count: criticalOpenCount },
      ] = await Promise.all([
        admin.from("feedback").select("id", { count: "exact", head: true }),
        admin.from("feedback").select("id", { count: "exact", head: true }).eq("status", "resolved"),
        admin.from("feedback").select("id", { count: "exact", head: true }).neq("status", "resolved"),
        admin
          .from("feedback")
          .select("id", { count: "exact", head: true })
          .neq("status", "resolved")
          .eq("needs_staff_response", true),
        admin
          .from("feedback")
          .select("id", { count: "exact", head: true })
          .neq("status", "resolved")
          .is("assigned_to", null),
        admin
          .from("feedback")
          .select("id", { count: "exact", head: true })
          .neq("status", "resolved")
          .eq("assigned_to", context.userId),
        admin
          .from("feedback")
          .select("id", { count: "exact", head: true })
          .neq("status", "resolved")
          .eq("priority", "critical"),
      ]);

      return json({
        success: true,
        user: {
          id: context.userId,
          name: context.name,
          email: context.email,
          role: context.role,
        },
        stats: {
          total_tickets: totalCount || 0,
          open_tickets: openCount || 0,
          resolved_tickets: resolvedCount || 0,
          needs_staff_response: needsResponseCount || 0,
          assigned_to_me: assignedToMeCount || 0,
          unassigned_open: unassignedCount || 0,
          critical_open: criticalOpenCount || 0,
        },
      });
    }

    // ── Action: list ─────────────────────────────────────────────
    if (action === "list" || action === "tickets") {
      const statusParam = (url.searchParams.get("status") || "open").toLowerCase();
      const assignedParam = url.searchParams.get("assigned_to");
      const needsResponseParam = url.searchParams.get("needs_response");
      const priorityParam = url.searchParams.get("priority");
      const categoryParam = url.searchParams.get("category");
      const serviceParam = url.searchParams.get("service");
      const searchParam = url.searchParams.get("search");
      const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 50), 1), 200);
      const offset = Math.max(Number(url.searchParams.get("offset") || 0), 0);

      let query = admin
        .from("feedback")
        .select(
          `
          id,
          ticket_number,
          type,
          category,
          service,
          status,
          priority,
          company_name,
          company_id,
          user_name,
          user_email,
          user_id,
          message,
          needs_staff_response,
          waiting_for_user_confirmation,
          assigned_to,
          created_by,
          created_at,
          updated_at,
          last_customer_message_at,
          assigned_profile:profiles!feedback_assigned_to_fkey(name),
          creator_profile:profiles!feedback_created_by_fkey(name)
        `,
          { count: "exact" }
        );

      // Status filter
      if (statusParam === "open") {
        query = query.neq("status", "resolved");
      } else if (statusParam === "created") {
        query = query.in("status", ["created", "new", "open"]);
      } else if (statusParam !== "all") {
        query = query.eq("status", statusParam);
      }

      // Assignee filter
      if (assignedParam === "me") {
        query = query.eq("assigned_to", context.userId);
      } else if (assignedParam === "unassigned") {
        query = query.is("assigned_to", null);
      } else if (assignedParam && assignedParam !== "all") {
        query = query.eq("assigned_to", assignedParam);
      }

      // Needs response filter
      if (needsResponseParam === "true") {
        query = query.eq("needs_staff_response", true);
      } else if (needsResponseParam === "false") {
        query = query.eq("needs_staff_response", false);
      }

      // Priority filter
      if (priorityParam) {
        query = query.eq("priority", priorityParam);
      }

      // Category filter
      if (categoryParam) {
        query = query.eq("category", categoryParam);
      }

      // Service filter
      if (serviceParam) {
        query = query.eq("service", serviceParam);
      }

      // Text search
      if (searchParam) {
        query = query.or(
          `ticket_number.ilike.%${searchParam}%,company_name.ilike.%${searchParam}%,user_name.ilike.%${searchParam}%,user_email.ilike.%${searchParam}%,message.ilike.%${searchParam}%`
        );
      }

      // Sort: updated_at DESC
      query = query.order("updated_at", { ascending: false }).range(offset, offset + limit - 1);

      const { data: tickets, error: listErr, count } = await query;
      if (listErr) {
        return errorResponse("DATABASE_ERROR", `Hiba a jegyek lekérdezésekor: ${listErr.message}`, 500);
      }

      const ticketIds = (tickets || []).map((t) => t.id);

      // Fetch comment counts & user reads in batch
      let commentCounts = new Map<string, number>();
      let readsMap = new Map<string, string>();

      if (ticketIds.length > 0) {
        const [{ data: comments }, { data: reads }] = await Promise.all([
          admin.from("ticket_comments").select("feedback_id").in("feedback_id", ticketIds),
          admin
            .from("ticket_reads")
            .select("feedback_id, last_read_at")
            .eq("user_id", context.userId)
            .in("feedback_id", ticketIds),
        ]);

        (comments || []).forEach((c) => {
          commentCounts.set(c.feedback_id, (commentCounts.get(c.feedback_id) || 0) + 1);
        });

        (reads || []).forEach((r) => {
          if (r.last_read_at) readsMap.set(r.feedback_id, r.last_read_at);
        });
      }

      const formattedTickets = (tickets || []).map((t: any) => {
        const lastRead = readsMap.get(t.id);
        const hasUnread = !lastRead || new Date(t.updated_at).getTime() > new Date(lastRead).getTime();

        return {
          id: t.id,
          ticket_number: t.ticket_number,
          status: t.status,
          priority: t.priority,
          category: t.category,
          service: t.service,
          company: {
            id: t.company_id,
            name: t.company_name,
          },
          user: {
            id: t.user_id,
            name: t.user_name,
            email: t.user_email,
          },
          summary: t.message ? (t.message.length > 140 ? t.message.slice(0, 137) + "..." : t.message) : "",
          needs_staff_response: Boolean(t.needs_staff_response),
          waiting_for_user_confirmation: Boolean(t.waiting_for_user_confirmation),
          assigned_to: t.assigned_to,
          assigned_to_name: t.assigned_profile?.name || null,
          created_by: t.created_by,
          created_by_name: t.creator_profile?.name || null,
          comment_count: commentCounts.get(t.id) || 0,
          has_unread: hasUnread,
          created_at: t.created_at,
          updated_at: t.updated_at,
        };
      });

      return json({
        success: true,
        total: count ?? formattedTickets.length,
        offset,
        limit,
        tickets: formattedTickets,
      });
    }

    // ── Action: get ──────────────────────────────────────────────
    if (action === "get" || action === "detail") {
      const ticketParam = url.searchParams.get("ticket") || url.searchParams.get("id");
      if (!ticketParam) {
        return errorResponse("BAD_REQUEST", "A 'ticket' paraméter (jegyszám vagy UUID) megadása kötelező.");
      }

      const ticket = await resolveTicket(admin, ticketParam);
      if (!ticket) {
        return errorResponse("NOT_FOUND", `Nem található hibajegy a megadott azonosítóval: '${ticketParam}'`, 404);
      }

      // Fetch comments & events in parallel
      const [{ data: comments }, { data: events }, { data: assignedProfile }, { data: creatorProfile }] =
        await Promise.all([
          admin
            .from("ticket_comments")
            .select("id, user_id, user_name, user_email, is_admin, is_internal, message, attachments, created_at")
            .eq("feedback_id", ticket.id)
            .order("created_at", { ascending: true }),
          admin
            .from("ticket_events")
            .select("id, event_type, actor_id, actor_name, actor_email, old_value, new_value, metadata, created_at")
            .eq("feedback_id", ticket.id)
            .order("created_at", { ascending: true }),
          ticket.assigned_to
            ? admin.from("profiles").select("name").eq("user_id", ticket.assigned_to).maybeSingle()
            : Promise.resolve({ data: null }),
          ticket.created_by
            ? admin.from("profiles").select("name").eq("user_id", ticket.created_by).maybeSingle()
            : Promise.resolve({ data: null }),
        ]);

      // Record ticket read for current user
      admin
        .from("ticket_reads")
        .upsert(
          {
            feedback_id: ticket.id,
            user_id: context.userId,
            last_read_at: new Date().toISOString(),
          },
          { onConflict: "feedback_id,user_id" }
        )
        .then(() => {});

      return json({
        success: true,
        ticket: {
          ...ticket,
          assigned_to_name: assignedProfile?.name || null,
          created_by_name: creatorProfile?.name || null,
        },
        comments: comments || [],
        events: events || [],
      });
    }

    // ── Action: comment ──────────────────────────────────────────
    if (action === "comment" || action === "add-comment") {
      const ticketParam = body.ticket || body.ticketId || body.ticket_id || url.searchParams.get("ticket");
      const message = (body.message || "").trim();
      const isInternal = Boolean(body.is_internal || body.isInternal);
      const attachments = Array.isArray(body.attachments) ? body.attachments : null;
      const needsStaffResponse =
        body.needs_staff_response !== undefined
          ? Boolean(body.needs_staff_response)
          : isInternal
          ? undefined // internal comment does not clear customer SLA by default
          : false; // staff public reply clears needs_staff_response
      const nextStatus = body.status;

      if (!ticketParam) {
        return errorResponse("BAD_REQUEST", "A 'ticket' azonosító (jegyszám vagy UUID) megadása kötelező.");
      }
      if (!message) {
        return errorResponse("BAD_REQUEST", "A 'message' szöveg megadása kötelező.");
      }

      const ticket = await resolveTicket(admin, ticketParam);
      if (!ticket) {
        return errorResponse("NOT_FOUND", `Nem található hibajegy: '${ticketParam}'`, 404);
      }

      // 1. Insert comment
      const { data: newComment, error: commentErr } = await admin
        .from("ticket_comments")
        .insert({
          feedback_id: ticket.id,
          user_id: context.userId,
          user_name: context.name,
          user_email: context.email,
          is_admin: true,
          is_internal: isInternal,
          message,
          attachments,
        })
        .select()
        .single();

      if (commentErr) {
        return errorResponse("DATABASE_ERROR", `Hiba a válasz rögzítésekor: ${commentErr.message}`, 500);
      }

      // 2. Update feedback row if needed
      const updatePayload: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (needsStaffResponse !== undefined) {
        updatePayload.needs_staff_response = needsStaffResponse;
      }
      if (nextStatus && ["created", "assigned", "in_progress", "resolved"].includes(nextStatus)) {
        updatePayload.status = nextStatus;
      }

      await admin.from("feedback").update(updatePayload).eq("id", ticket.id);

      // 3. Mark read for the actor
      await admin.from("ticket_reads").upsert(
        {
          feedback_id: ticket.id,
          user_id: context.userId,
          last_read_at: new Date().toISOString(),
        },
        { onConflict: "feedback_id,user_id" }
      );

      return json({
        success: true,
        message: isInternal ? "Belső jegyzet sikeresen rögzítve." : "Ügyfélszolgálati válasz sikeresen rögzítve.",
        comment: newComment,
        ticket_id: ticket.id,
        ticket_number: ticket.ticket_number,
      });
    }

    // ── Action: update ───────────────────────────────────────────
    if (action === "update" || action === "update-ticket") {
      const ticketParam = body.ticket || body.ticketId || body.ticket_id || url.searchParams.get("ticket");
      if (!ticketParam) {
        return errorResponse("BAD_REQUEST", "A 'ticket' azonosító megadása kötelező.");
      }

      const ticket = await resolveTicket(admin, ticketParam);
      if (!ticket) {
        return errorResponse("NOT_FOUND", `Nem található hibajegy: '${ticketParam}'`, 404);
      }

      const updatePayload: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      // Status
      if (body.status && ["created", "assigned", "in_progress", "resolved"].includes(body.status)) {
        updatePayload.status = body.status;
      }

      // Priority
      if (body.priority && ["low", "medium", "high", "critical"].includes(body.priority)) {
        updatePayload.priority = body.priority;
      }

      // Category
      if (body.category !== undefined) {
        updatePayload.category = body.category || null;
      }

      // Needs staff response
      if (body.needs_staff_response !== undefined) {
        updatePayload.needs_staff_response = Boolean(body.needs_staff_response);
      }

      // Assignee
      if (body.assigned_to !== undefined) {
        let newAssignee: string | null = body.assigned_to;
        if (newAssignee === "me") {
          newAssignee = context.userId;
        } else if (!newAssignee) {
          newAssignee = null;
        }
        updatePayload.assigned_to = newAssignee;

        // Auto-transition status if appropriate
        if (newAssignee && (ticket.status === "created" || ticket.status === "new" || ticket.status === "open")) {
          updatePayload.status = "assigned";
        } else if (!newAssignee && ticket.status === "assigned") {
          updatePayload.status = "created";
        }
      }

      const { data: updatedTicket, error: updateErr } = await admin
        .from("feedback")
        .update(updatePayload)
        .eq("id", ticket.id)
        .select()
        .single();

      if (updateErr) {
        return errorResponse("DATABASE_ERROR", `Hiba a jegy frissítésekor: ${updateErr.message}`, 500);
      }

      return json({
        success: true,
        message: "Hibajegy sikeresen frissítve.",
        ticket: updatedTicket,
      });
    }

    // ── Action: resolve ──────────────────────────────────────────
    if (action === "resolve" || action === "close") {
      const ticketParam = body.ticket || body.ticketId || body.ticket_id || url.searchParams.get("ticket");
      const commentText = (body.comment || "").trim();
      const requestConfirmation = Boolean(body.request_confirmation);

      if (!ticketParam) {
        return errorResponse("BAD_REQUEST", "A 'ticket' azonosító megadása kötelező.");
      }

      const ticket = await resolveTicket(admin, ticketParam);
      if (!ticket) {
        return errorResponse("NOT_FOUND", `Nem található hibajegy: '${ticketParam}'`, 404);
      }

      // Optional closing comment
      if (commentText) {
        await admin.from("ticket_comments").insert({
          feedback_id: ticket.id,
          user_id: context.userId,
          user_name: context.name,
          user_email: context.email,
          is_admin: true,
          is_internal: false,
          message: commentText,
        });
      }

      if (requestConfirmation) {
        // Request confirmation flow
        await admin
          .from("feedback")
          .update({
            waiting_for_user_confirmation: true,
            resolution_requested_at: new Date().toISOString(),
            resolution_requested_by: context.userId,
            status: "in_progress",
            updated_at: new Date().toISOString(),
          })
          .eq("id", ticket.id);

        await admin.from("ticket_events").insert({
          feedback_id: ticket.id,
          event_type: "resolution_requested",
          actor_id: context.userId,
          actor_email: context.email,
          actor_name: context.name,
          metadata: {
            automated: false,
            comment_provided: Boolean(commentText),
          },
        });

        return json({
          success: true,
          status: "in_progress",
          waiting_for_user_confirmation: true,
          message: "Megerősítés-kérés elküldve a felhasználónak.",
        });
      } else {
        // Direct resolution
        await admin
          .from("feedback")
          .update({
            status: "resolved",
            needs_staff_response: false,
            waiting_for_user_confirmation: false,
            resolution_confirmed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", ticket.id);

        return json({
          success: true,
          status: "resolved",
          message: "Hibajegy sikeresen megoldottra állítva (lezárva).",
        });
      }
    }

    // ── Action: create ───────────────────────────────────────────
    if (action === "create" || action === "create-ticket") {
      const message = (body.message || "").trim();
      if (!message) {
        return errorResponse("BAD_REQUEST", "A 'message' leírás megadása kötelező.");
      }

      let targetUserId = body.target_user_id || body.targetUserId;
      let targetEmail = body.target_email || body.targetEmail || null;
      let targetName = body.target_name || body.targetName || null;

      // If email provided without ID, find target user
      if (!targetUserId && targetEmail) {
        const { data: authUser } = await admin
          .from("profiles")
          .select("user_id, name")
          .ilike("name", `%${targetEmail}%`)
          .maybeSingle();

        if (authUser?.user_id) {
          targetUserId = authUser.user_id;
          if (!targetName && authUser.name) targetName = authUser.name;
        }
      }

      // If still no target user, default to context user (self-reported)
      if (!targetUserId) {
        targetUserId = context.userId;
        targetName = context.name;
        targetEmail = context.email;
      } else if (!targetName || !targetEmail) {
        const { data: p } = await admin
          .from("profiles")
          .select("name")
          .eq("user_id", targetUserId)
          .maybeSingle();
        if (p?.name) targetName = p.name;
        try {
          const { data: u } = await admin.auth.admin.getUserById(targetUserId);
          if (u?.user?.email) targetEmail = u.user.email;
        } catch (_) {}
      }

      let companyId = body.company_id || body.companyId || null;
      let companyName = body.company_name || body.companyName || null;
      if (companyId && !companyName) {
        const { data: comp } = await admin.from("companies").select("name").eq("id", companyId).maybeSingle();
        if (comp?.name) companyName = comp.name;
      }

      let assignedTo = body.assigned_to || body.assignedTo || null;
      if (assignedTo === "me") assignedTo = context.userId;

      const ticketId = crypto.randomUUID();
      const { data: newTicket, error: insertErr } = await admin
        .from("feedback")
        .insert({
          id: ticketId,
          user_id: targetUserId,
          created_by: context.userId,
          user_email: targetEmail,
          user_name: targetName,
          company_id: companyId,
          company_name: companyName,
          service: body.service || "eaisybill",
          type: body.type || "feedback",
          category: body.category || null,
          priority: body.priority || "medium",
          message,
          attachments: Array.isArray(body.attachments) ? body.attachments : null,
          assigned_to: assignedTo,
          status: assignedTo ? "assigned" : "created",
        })
        .select()
        .single();

      if (insertErr) {
        return errorResponse("DATABASE_ERROR", `Hiba a jegy létrehozásakor: ${insertErr.message}`, 500);
      }

      // Mark read for creator
      await admin.from("ticket_reads").insert({
        feedback_id: ticketId,
        user_id: context.userId,
        last_read_at: new Date().toISOString(),
      });

      return json({
        success: true,
        message: "Hibajegy sikeresen létrehozva.",
        ticket: newTicket,
      });
    }

    return errorResponse("UNKNOWN_ACTION", `Ismeretlen művelet: '${action}'. Használd a ?action=help végpontot a leíráshoz.`, 400);
  } catch (error: any) {
    console.error("[TICKETS-API] Unexpected error:", error);
    return errorResponse("SERVER_ERROR", error?.message || "Váratlan szerverhiba történt", 500);
  }
});
