import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import {
  API_BASE_URL,
  getCustomerToken,
  getAggreg8Headers,
  syncAccountTransactions,
} from "../_shared/aggreg8-sync.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders, status: 200 });
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    const payload = await req.json();
    console.log("[aggreg8-callback] Inbound Notification:", JSON.stringify(payload, null, 2));

    const {
      notificationType,
      userId: a8UserId,
      infoSharingConsentId,
      userFlowInfo,
      consentedAccounts,
      activeSyncEnabled,
      passiveSyncEnabled,
      activeSyncExpirationDate,
      passiveSyncExpirationDate,
    } = payload;

    // 1. Audit Log rögzítése
    const { data: logEntry } = await supabaseAdmin
      .from("aggreg8_webhook_logs")
      .insert({
        notification_type: notificationType || "UNKNOWN",
        user_flow_id: userFlowInfo?.userFlowId || null,
        a8_user_id: a8UserId || null,
        info_sharing_consent_id: infoSharingConsentId || null,
        payload,
      })
      .select("id")
      .single();

    let customerToken = "";
    try {
      customerToken = await getCustomerToken(supabaseAdmin);
    } catch (tokenErr) {
      console.warn("[aggreg8-callback] Could not get customer token for background sync:", tokenErr);
    }

    // 2. Értesítés feldolgozása típus szerint
    switch (notificationType) {
      case "INFO_SHARING_CONSENT_CREATED": {
        // Keressük meg a kapcsolódó céget az Aggreg8 consent vagy meglévő kapcsolat alapján
        let { data: existingConsent } = await supabaseAdmin
          .from("aggreg8_consents")
          .select("*")
          .eq("info_sharing_consent_id", infoSharingConsentId)
          .maybeSingle();

        if (!existingConsent) {
          let resolvedCompanyId: string | null = null;
          let resolvedUserId: string | null = null;

          // 1. Elsődleges feloldás: keresés userFlowId alapján a FLOW_INITIATED munkamenet-naplóból
          const userFlowId = userFlowInfo?.userFlowId;
          if (userFlowId) {
            const { data: flowInitLog } = await supabaseAdmin
              .from("aggreg8_webhook_logs")
              .select("payload")
              .eq("notification_type", "FLOW_INITIATED")
              .eq("user_flow_id", userFlowId)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            if (flowInitLog?.payload?.company_id && flowInitLog?.payload?.user_id) {
              resolvedCompanyId = flowInitLog.payload.company_id;
              resolvedUserId = flowInitLog.payload.user_id;
              console.log(
                `[aggreg8-callback] Resolved company ${resolvedCompanyId} and user ${resolvedUserId} via userFlowId: ${userFlowId}`
              );
            }
          }

          // 2. Másodlagos feloldás (fallback): meglévő consent keresése az a8_user_id alapján
          if (!resolvedCompanyId && a8UserId) {
            const { data: latestConsent } = await supabaseAdmin
              .from("aggreg8_consents")
              .select("company_id, user_id")
              .eq("a8_user_id", a8UserId)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            if (latestConsent) {
              resolvedCompanyId = latestConsent.company_id;
              resolvedUserId = latestConsent.user_id;
              console.log(
                `[aggreg8-callback] Fallback resolved company ${resolvedCompanyId} from latest consent for a8UserId ${a8UserId}`
              );
            }
          }

          if (resolvedCompanyId && resolvedUserId) {
            const { data: newConsent, error: insErr } = await supabaseAdmin
              .from("aggreg8_consents")
              .insert({
                company_id: resolvedCompanyId,
                user_id: resolvedUserId,
                info_sharing_consent_id: infoSharingConsentId,
                a8_user_id: a8UserId,
                bank_id: "PENDING_SYNC",
                bank_name: "Aggreg8.io integráció",
                active_sync_enabled: activeSyncEnabled ?? true,
                passive_sync_enabled: passiveSyncEnabled ?? true,
                active_sync_expiration_date: activeSyncExpirationDate || null,
                passive_sync_expiration_date: passiveSyncExpirationDate || null,
                status: "active",
              })
              .select()
              .single();

            if (insErr) {
              console.error("[aggreg8-callback] Failed to insert new consent:", insErr);
            } else {
              existingConsent = newConsent;
            }
          } else {
            console.error(
              `[aggreg8-callback] Could not resolve company_id for infoSharingConsentId: ${infoSharingConsentId}, userFlowId: ${userFlowId}, a8UserId: ${a8UserId}`
            );
          }
        }

        // Számlák lekérdezése az Aggreg8 tartós tárból
        if (existingConsent && customerToken && a8UserId) {
          const accRes = await fetch(`${API_BASE_URL}/accounts?userId=${a8UserId}`, {
            headers: getAggreg8Headers({
              Accept: "application/json",
              Authorization: `Bearer ${customerToken}`,
            }),
          });

          if (accRes.ok) {
            const accList = await accRes.json();
            const rawAccounts = Array.isArray(accList) ? accList : (accList.accounts || []);

            // Ha az Aggreg8 megküldte a specifikus engedélyezett számlákat (consentedAccounts), szűrjünk azokra
            const consentedAccountIds: string[] | null =
              Array.isArray(consentedAccounts) && consentedAccounts.length > 0
                ? consentedAccounts.map((a: any) =>
                    typeof a === "string" ? a : (a.id || a._id || a.accountId)
                  )
                : null;

            const targetAccounts = consentedAccountIds
              ? rawAccounts.filter((acc: any) =>
                  consentedAccountIds.includes(acc.id || acc._id)
                )
              : rawAccounts;

            // Bank név és azonosító frissítése a hozzájáruláson ha elérhető
            if (targetAccounts.length > 0 && existingConsent.bank_id === "PENDING_SYNC") {
              const firstAcc = targetAccounts[0];
              const detectedBankId = firstAcc.bankId || firstAcc.bank?.id;
              const detectedBankName = firstAcc.bankName || firstAcc.bank?.name;
              if (detectedBankId || detectedBankName) {
                await supabaseAdmin
                  .from("aggreg8_consents")
                  .update({
                    bank_id: detectedBankId || existingConsent.bank_id,
                    bank_name: detectedBankName || existingConsent.bank_name,
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", existingConsent.id);
              }
            }

            for (const acc of targetAccounts) {
              const { data: savedAcc, error: accErr } = await supabaseAdmin
                .from("aggreg8_accounts")
                .upsert(
                  {
                    consent_id: existingConsent.id,
                    company_id: existingConsent.company_id,
                    a8_account_id: acc.id || acc._id,
                    account_name: acc.name || "Bankszámla",
                    account_number: acc.accountNumber || "N/A",
                    currency: acc.currency || "HUF",
                    balance: acc.balance ?? null,
                    updated_at: new Date().toISOString(),
                  },
                  { onConflict: "a8_account_id" }
                )
                .select()
                .single();

              if (accErr) {
                console.error("[aggreg8-callback] Error saving aggreg8_account:", accErr);
              } else if (savedAcc) {
                await syncAccountTransactions(supabaseAdmin, customerToken, savedAcc, a8UserId);
              }
            }
          }
        }
        break;
      }

      case "INFO_SHARING_CONSENT_UPDATED": {
        await supabaseAdmin
          .from("aggreg8_consents")
          .update({
            active_sync_enabled: activeSyncEnabled,
            passive_sync_enabled: passiveSyncEnabled,
            active_sync_expiration_date: activeSyncExpirationDate,
            passive_sync_expiration_date: passiveSyncExpirationDate,
            status: "active",
            updated_at: new Date().toISOString(),
          })
          .eq("info_sharing_consent_id", infoSharingConsentId);
        break;
      }

      case "INFO_SHARING_CONSENT_DELETED": {
        await supabaseAdmin
          .from("aggreg8_consents")
          .update({
            status: "deleted",
            updated_at: new Date().toISOString(),
          })
          .eq("info_sharing_consent_id", infoSharingConsentId);
        break;
      }

      case "USER_FLOW_ENDED": {
        console.log(`[aggreg8-callback] UserFlow ended with status: ${userFlowInfo?.status}, step: ${userFlowInfo?.step}`);
        
        // Ha a felhasználó befejezte a szinkronizációt vagy az azonosítást:
        const isCompleted =
          userFlowInfo?.step === "SYNC_COMPLETED" ||
          userFlowInfo?.status === "COMPLETED" ||
          userFlowInfo?.step === "INFO_SHARING_CONSENT_GIVEN";

        if (isCompleted && customerToken) {
          const consentQuery = supabaseAdmin
            .from("aggreg8_consents")
            .select("id, a8_user_id, company_id");

          if (infoSharingConsentId) {
            consentQuery.eq("info_sharing_consent_id", infoSharingConsentId);
          } else if (a8UserId) {
            consentQuery.eq("a8_user_id", a8UserId);
          }

          const { data: consent } = await consentQuery
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (consent) {
            const { data: accounts } = await supabaseAdmin
              .from("aggreg8_accounts")
              .select("*")
              .eq("consent_id", consent.id);

            if (accounts && accounts.length > 0) {
              for (const acc of accounts) {
                await syncAccountTransactions(supabaseAdmin, customerToken, acc, consent.a8_user_id);
              }
            }
          }
        }
        break;
      }

      case "TRANSACTIONS_CREATED":
      case "TRANSACTIONS_UPDATED": {
        // Az érintett consenthez tartozó számlák lekérdezése
        const { data: consent } = await supabaseAdmin
          .from("aggreg8_consents")
          .select("id, a8_user_id, company_id")
          .eq("info_sharing_consent_id", infoSharingConsentId)
          .maybeSingle();

        if (consent && customerToken) {
          const { data: accounts } = await supabaseAdmin
            .from("aggreg8_accounts")
            .select("*")
            .eq("consent_id", consent.id);

          if (accounts) {
            for (const acc of accounts) {
              await syncAccountTransactions(supabaseAdmin, customerToken, acc, consent.a8_user_id);
            }
          }
        }
        break;
      }

      default:
        console.log(`[aggreg8-callback] Unhandled notificationType: ${notificationType}`);
        break;
    }

    if (logEntry?.id) {
      await supabaseAdmin
        .from("aggreg8_webhook_logs")
        .update({ processed: true })
        .eq("id", logEntry.id);
    }

    return new Response(JSON.stringify({ text: "Success", response: {} }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[aggreg8-callback] Callback handling error:", err);
    return new Response(
      JSON.stringify({ text: "Error", error: err.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
