import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import {
  API_BASE_URL,
  SYNC_UI_URL,
  getCustomerToken,
  getAggreg8Headers,
  syncAccountTransactions,
} from "../_shared/aggreg8-sync.ts";

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

const config = {
  apiUrl: API_BASE_URL,
  syncUiUrl: SYNC_UI_URL,
};


async function ensureAggreg8User(customerToken: string, email: string): Promise<string> {
  const res = await fetch(`${config.apiUrl}/users`, {
    method: "POST",
    headers: getAggreg8Headers({
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${customerToken}`,
    }),
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

    const isServiceRole = token === SUPABASE_SERVICE_ROLE_KEY;
    let user: any = null;

    if (!isServiceRole) {
      const {
        data: { user: authUser },
        error: userErr,
      } = await adminClient.auth.getUser(token);

      if (userErr || !authUser) {
        console.warn("[aggreg8-api] Auth error:", userErr);
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      user = authUser;
    }

    const body = await req.json();
    const { action, companyId, flowType, infoSharingConsentId, redirectUri, prefill, isContinuation } = body;

    if (!companyId) {
      return new Response(JSON.stringify({ error: "companyId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let isCompanyOwner = false;
    if (isServiceRole) {
      // Belső rendszerhívás / háttérfolytatás esetén automatikusan felhatalmazott
      isCompanyOwner = true;
    } else {
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

      // Verify company ownership for sensitive bank operations
      const { data: comp } = await adminClient
        .from("companies")
        .select("owner_id")
        .eq("id", companyId)
        .maybeSingle();

      isCompanyOwner = comp?.owner_id === user.id || membership.role === "owner";
    }

    // ── Action: INIT FLOW (ADD_BANK, ON_DEMAND, EXTEND_CONSENT, DELETE_INFO_SHARING_CONSENT) ──
    if (action === "init-flow") {
      const type = flowType || "ADD_BANK";

      // Security Guard: Only CEO/Owner can add a bank, trigger sync, extend consent, or delete consent
      if (
        (type === "ADD_BANK" || type === "ON_DEMAND" || type === "EXTEND_CONSENT" || type === "DELETE_INFO_SHARING_CONSENT") &&
        !isCompanyOwner
      ) {
        return new Response(
          JSON.stringify({ 
            success: false,
            error: "Kizárólag a cég tulajdonosa (CEO/Owner) jogosult a banki kapcsolatot kezelni vagy szinkronizációt indítani.",
            code: "PERMISSION_DENIED",
          }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

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
        // Ellenőrizzük, hogy a hozzájárulást melyik felhasználó hozta létre
        const { data: consentRecord } = await adminClient
          .from("aggreg8_consents")
          .select("user_id, bank_name")
          .eq("info_sharing_consent_id", infoSharingConsentId)
          .maybeSingle();

        if (consentRecord && consentRecord.user_id !== user.id) {
          return new Response(
            JSON.stringify({
              success: false,
              error: `Ezt a banki kapcsolatot (${consentRecord.bank_name || 'Bank'}) egy másik felhasználó hitelesítette. Az élő szinkronizációt és banki azonosítást kizárólag az a felhasználó tudja elindítani, aki a bankkapcsolatot létrehozta.`,
              code: "CONSENT_USER_MISMATCH",
            }),
            {
              status: 403,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        initPayload.infoSharingConsentId = infoSharingConsentId;
      }

      const res = await fetch(`${config.apiUrl}/user-flow/init`, {
        method: "POST",
        headers: getAggreg8Headers({
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${customerToken}`,
        }),
        body: JSON.stringify(initPayload),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`[aggreg8-api] init flow failed (${res.status}):`, errText);

        let userFriendlyMsg = "A banki művelet kezdeményezése sikertelen.";
        if (res.status === 400) {
          userFriendlyMsg = "A banki azonosítási kérelem érvénytelen, vagy a kapcsolódó hozzájárulás felhasználója eltér. Kérjük, próbáld újra a kapcsolatot létrehozó felhasználói fiókkal.";
        } else if (res.status === 401) {
          userFriendlyMsg = "A banki hitelesítés érvénytelen vagy lejárt. Kérjük, próbáld újra.";
        } else if (res.status === 404) {
          userFriendlyMsg = "A kiválasztott banki kapcsolat vagy számla nem található a banki szolgáltatónál.";
        } else if (res.status === 429) {
          userFriendlyMsg = "Túl sok szinkronizációs kérés érkezett rövid időn belül. Kérjük, várj pár percet az újabb próbálkozás előtt.";
        } else if (res.status >= 500) {
          userFriendlyMsg = "A banki aggregátor (Aggreg8) vagy a partnerbank szolgáltatása jelenleg átmenetileg nem elérhető. Kérjük, próbáld újra később.";
        } else {
          try {
            const parsed = JSON.parse(errText);
            if (parsed?.message) userFriendlyMsg = parsed.message;
          } catch {
            // ignore
          }
        }

        throw new Error(userFriendlyMsg);
      }

      const flowRes = await res.json();
      const { userFlowId, token: userFlowToken } = flowRes;
      const syncUiUrl = `${config.syncUiUrl}?token=${userFlowToken}&lang=HU`;

      // ── Munkamenet-követés: kapcsoljuk össze a userFlowId-t a cég és felhasználó azonosítóval ──
      if (userFlowId) {
        try {
          await adminClient.from("aggreg8_webhook_logs").insert({
            notification_type: "FLOW_INITIATED",
            user_flow_id: userFlowId,
            a8_user_id: a8UserId,
            payload: {
              company_id: companyId,
              user_id: user.id,
              flow_type: type,
              initiated_at: new Date().toISOString(),
            },
            processed: true,
          });
        } catch (logErr) {
          console.warn("[aggreg8-api] Could not log FLOW_INITIATED session map:", logErr);
        }
      }

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

    // ── Action: SYNC TRANSACTIONS (On-demand / post-flow instant sync) ──
    if (action === "sync-transactions") {
      if (!isCompanyOwner) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Kizárólag a cég tulajdonosa jogosult a banki tranzakciók szinkronizálására.",
            code: "PERMISSION_DENIED",
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { infoSharingConsentId, requestedAfter } = body;

      const consentQuery = adminClient
        .from("aggreg8_consents")
        .select("*")
        .eq("company_id", companyId)
        .neq("status", "deleted");

      if (infoSharingConsentId) {
        consentQuery.eq("info_sharing_consent_id", infoSharingConsentId);
      }

      const { data: consents, error: cErr } = await consentQuery.order("created_at", { ascending: false });

      if (cErr) throw cErr;

      if (!consents || consents.length === 0) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Nem található aktív banki kapcsolat.",
            totalSynced: 0,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const customerToken = await getCustomerToken(adminClient);
      let grandTotalSynced = 0;
      let primaryBankName = "";
      let hasMoreTransactions = false;

      for (const consent of consents) {
        if (!primaryBankName && consent.bank_name) {
          primaryBankName = consent.bank_name;
        }

        let { data: accounts } = await adminClient
          .from("aggreg8_accounts")
          .select("*")
          .eq("consent_id", consent.id);

        // Ha a webhook még nem töltötte be a számlákat (friss bankcsatlakozási versenyhelyzet):
        if (!accounts || accounts.length === 0) {
          try {
            const accRes = await fetch(`${config.apiUrl}/accounts?userId=${consent.a8_user_id}`, {
              headers: getAggreg8Headers({
                Accept: "application/json",
                Authorization: `Bearer ${customerToken}`,
              }),
            });

            if (accRes.ok) {
              const accList = await accRes.json();
              const rawAccounts = Array.isArray(accList) ? accList : (accList.accounts || []);
              for (const rawAcc of rawAccounts) {
                const { data: insAcc } = await adminClient
                  .from("aggreg8_accounts")
                  .upsert(
                    {
                      consent_id: consent.id,
                      company_id: consent.company_id,
                      a8_account_id: rawAcc.id || rawAcc._id,
                      account_name: rawAcc.name || "Bankszámla",
                      account_number: rawAcc.accountNumber || "N/A",
                      currency: rawAcc.currency || "HUF",
                      balance: rawAcc.balance ?? null,
                      updated_at: new Date().toISOString(),
                    },
                    { onConflict: "a8_account_id" }
                  )
                  .select()
                  .single();

                if (insAcc) {
                  accounts = [...(accounts || []), insAcc];
                }
              }
            }
          } catch (accFetchErr) {
            console.warn("[aggreg8-api] Could not fetch accounts from API:", accFetchErr);
          }
        }

        if (accounts && accounts.length > 0) {
          for (const acc of accounts) {
            const wasRecentlySyncedByWebhook =
              !isContinuation &&
              requestedAfter &&
              acc.last_synced_at &&
              new Date(acc.last_synced_at).getTime() >= new Date(requestedAfter).getTime() - 2000 &&
              typeof acc.last_synced_count === "number" &&
              acc.last_synced_count > 0;

            if (wasRecentlySyncedByWebhook) {
              grandTotalSynced += acc.last_synced_count;
            } else {
              const syncRes = await syncAccountTransactions(adminClient, customerToken, acc, consent.a8_user_id);
              grandTotalSynced += syncRes.totalSynced;
              if (syncRes.hasMore) {
                hasMoreTransactions = true;
              }
            }
          }
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          totalSynced: grandTotalSynced,
          bankName: primaryBankName || "Bank",
          isNewConnection: !infoSharingConsentId,
          hasMore: hasMoreTransactions,
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
        headers: getAggreg8Headers({
          Accept: "application/json",
          Authorization: `Bearer ${customerToken}`,
        }),
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
        error: err.message || "Váratlan hiba történt a banki kapcsolat kezelésekor.",
        code: isApiKeyMissing ? "A8_API_KEY_MISSING" : "OPERATION_FAILED",
      }),
      {
        status: isApiKeyMissing ? 503 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
