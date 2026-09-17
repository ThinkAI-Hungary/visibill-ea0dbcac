import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

// ── Client Guard for Visibill Edge Functions ──
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function checkAutomationShield(req: Request): Response | null {
  const authHeader = req.headers.get("authorization") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (serviceKey && authHeader.includes(serviceKey)) {
    return null;
  }

  const userAgent = (req.headers.get("user-agent") || "").toLowerCase();
  const clientInfo = (req.headers.get("x-client-info") || "").toLowerCase();
  const origin = req.headers.get("origin") || "";
  const referer = req.headers.get("referer") || "";

  const isScript =
    userAgent.startsWith("node") ||
    userAgent.includes("node-fetch") ||
    userAgent.includes("axios") ||
    userAgent.includes("undici") ||
    userAgent.startsWith("python") ||
    userAgent.includes("aiohttp") ||
    userAgent.includes("requests") ||
    userAgent.includes("urllib") ||
    userAgent.startsWith("curl") ||
    userAgent.startsWith("wget") ||
    userAgent.includes("postman") ||
    userAgent.includes("insomnia") ||
    userAgent.includes("httpie") ||
    userAgent.startsWith("powershell") ||
    userAgent.includes("go-http-client") ||
    clientInfo.includes("supabase-js-node");

  if (isScript) {
    return new Response(
      JSON.stringify({
        code: "AUTOMATION_BLOCKED",
        error: "A közvetlen szkript-alapú automatizáció le van tiltva a Visibill rendszerében. Kérjük használd a hivatalos webes felületet!",
        details: "Direct script automation is restricted. Please use the official Visibill web application.",
      }),
      {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  if (!origin && !referer && !userAgent.startsWith("deno")) {
    return new Response(
      JSON.stringify({
        code: "AUTOMATION_BLOCKED",
        error: "A közvetlen szkript-alapú automatizáció le van tiltva a Visibill rendszerében. Kérjük használd a hivatalos webes felületet!",
        details: "Direct script automation is restricted. Please use the official Visibill web application.",
      }),
      {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  return null;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const A8_AIS_API_KEY = Deno.env.get("A8_AIS_API_KEY") || "";
const A8_ENV = (Deno.env.get("A8_ENVIRONMENT") || "sandbox").toLowerCase();

const URLS = {
  sandbox: {
    apiUrl: "https://a8-ais-api.sandbox.aggreg8test.hu",
    syncUiUrl: "https://a8-sync-ui.sandbox.aggreg8test.hu",
  },
  prod: {
    apiUrl: "https://ais-api.aggreg8.hu",
    syncUiUrl: "https://sync-ui.aggreg8.hu",
  },
};

const config = A8_ENV === "prod" ? URLS.prod : URLS.sandbox;

async function getCustomerToken(supabaseAdmin: any): Promise<string> {
  // 1. Check cached token in aggreg8_settings
  const { data: settings } = await supabaseAdmin
    .from("aggreg8_settings")
    .select("customer_token, token_expires_at")
    .eq("environment", A8_ENV)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const now = new Date();
  if (
    settings?.customer_token &&
    settings.token_expires_at &&
    new Date(settings.token_expires_at).getTime() > now.getTime() + 5 * 60 * 1000
  ) {
    return settings.customer_token;
  }

  if (!A8_AIS_API_KEY) {
    throw new Error("Az Aggreg8 API kulcs (A8_AIS_API_KEY) még nincs beállítva a Supabase Secrets környezeti változók között. Kérjük add meg az SMS-ben kapott API kulcsot a Supabase Dashboard-on!");
  }

  // 2. Fetch fresh token from Aggreg8 GET /token
  const res = await fetch(`${config.apiUrl}/token`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      apikey: A8_AIS_API_KEY,
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Aggreg8 GET /token failed (${res.status}): ${errorText}`);
  }

  const tokenData = await res.json();
  const token = tokenData.token || tokenData;
  const expiresAt = new Date(now.getTime() + 175 * 60 * 1000).toISOString(); // ~2h 55m

  // 3. Cache token
  await supabaseAdmin.from("aggreg8_settings").upsert(
    {
      environment: A8_ENV,
      customer_token: token,
      token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  return token;
}

async function ensureAggreg8User(customerToken: string, email: string): Promise<string> {
  const res = await fetch(`${config.apiUrl}/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${customerToken}`,
    },
    body: JSON.stringify({ email }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Aggreg8 POST /users failed (${res.status}): ${err}`);
  }

  const userObj = await res.json();
  return userObj.userId || userObj.id || userObj._id;
}

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders, status: 200 });
  }

  // Client Guard check
  const automationBlock = checkAutomationShield(req);
  if (automationBlock) {
    return automationBlock;
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const {
      data: { user },
      error: userErr,
    } = await adminClient.auth.getUser(token);

    if (userErr || !user) {
      console.warn("[aggreg8-api] Auth error:", userErr);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, companyId, flowType, infoSharingConsentId, redirectUri, prefill } = body;

    if (!companyId) {
      return new Response(JSON.stringify({ error: "companyId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify company membership
    const { data: membership, error: memErr } = await adminClient
      .from("company_members")
      .select("role")
      .eq("company_id", companyId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memErr || !membership) {
      return new Response(JSON.stringify({ error: "Access denied to company" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Action: INIT FLOW (ADD_BANK, ON_DEMAND, EXTEND_CONSENT, DELETE_INFO_SHARING_CONSENT) ──
    if (action === "init-flow") {
      const type = flowType || "ADD_BANK";
      const customerToken = await getCustomerToken(adminClient);
      const a8UserId = await ensureAggreg8User(customerToken, user.email!);

      const initPayload: Record<string, unknown> = {
        flowType: type,
        email: user.email,
        redirectUri: redirectUri || undefined,
      };

      if (type === "ADD_BANK" && prefill) {
        initPayload.prefill = prefill;
      }

      if (
        (type === "ON_DEMAND" || type === "EXTEND_CONSENT" || type === "DELETE_INFO_SHARING_CONSENT") &&
        infoSharingConsentId
      ) {
        initPayload.infoSharingConsentId = infoSharingConsentId;
      }

      const res = await fetch(`${config.apiUrl}/user-flow/init`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${customerToken}`,
        },
        body: JSON.stringify(initPayload),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Aggreg8 init flow failed (${res.status}): ${errText}`);
      }

      const flowRes = await res.json();
      const { userFlowId, token: userFlowToken } = flowRes;
      const syncUiUrl = `${config.syncUiUrl}?token=${userFlowToken}&lang=HU`;

      return new Response(
        JSON.stringify({
          success: true,
          userFlowId,
          userFlowToken,
          syncUiUrl,
          a8UserId,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── Action: LIST CONSENTS & ACCOUNTS ──
    if (action === "list-consents") {
      const { data: consents, error: cErr } = await adminClient
        .from("aggreg8_consents")
        .select(`
          *,
          accounts:aggreg8_accounts(*)
        `)
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      if (cErr) {
        throw cErr;
      }

      return new Response(JSON.stringify({ success: true, consents }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Action: GET BANKS LIST ──
    if (action === "get-banks") {
      const customerToken = await getCustomerToken(adminClient);
      const res = await fetch(`${config.apiUrl}/banks`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${customerToken}`,
        },
      });

      if (!res.ok) {
        throw new Error(`Aggreg8 GET /banks failed with status ${res.status}`);
      }

      const banks = await res.json();
      return new Response(JSON.stringify({ success: true, banks }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[aggreg8-api] Error:", err);
    const isApiKeyMissing = err.message?.includes("A8_AIS_API_KEY");
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || "An unexpected error occurred",
        code: isApiKeyMissing ? "A8_API_KEY_MISSING" : "OPERATION_FAILED",
      }),
      {
        status: isApiKeyMissing ? 503 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
