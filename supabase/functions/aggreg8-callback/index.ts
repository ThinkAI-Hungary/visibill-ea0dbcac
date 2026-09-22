import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const A8_AIS_API_KEY = Deno.env.get("A8_AIS_API_KEY") || "";
const A8_ENV = (Deno.env.get("A8_ENVIRONMENT") || "sandbox").toLowerCase();

const API_BASE_URL =
  A8_ENV === "prod"
    ? "https://ais-api.aggreg8.hu"
    : "https://a8-ais-api.sandbox.aggreg8test.hu";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getCustomerToken(supabaseAdmin: any): Promise<string> {
  const sanitize = (t: string | null | undefined): string => {
    if (!t) return "";
    return t.startsWith("Bearer ") ? t.slice(7).trim() : t.trim();
  };

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
    return sanitize(settings.customer_token);
  }

  if (!A8_AIS_API_KEY) {
    throw new Error("A8_AIS_API_KEY is not configured.");
  }

  const res = await fetch(`${API_BASE_URL}/token`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      apikey: A8_AIS_API_KEY,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to get Aggreg8 token: ${res.status}`);
  }

  const tokenData = await res.json();
  const rawToken = tokenData.token || tokenData;
  const token = sanitize(String(rawToken || ""));
  const expiresAt = new Date(now.getTime() + 175 * 60 * 1000).toISOString();

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

// Inkrementális tranzakció letöltés
async function syncAccountTransactions(
  supabaseAdmin: any,
  customerToken: string,
  accountRow: any,
  a8UserId: string
) {
  const fromOrdinal = (accountRow.last_ordinal_on_account || 0) + 1;
  const accountId = accountRow.a8_account_id;

  let maxOrdinal = accountRow.last_ordinal_on_account || 0;
  let page = 0;
  let totalPages = 1;
  let totalSynced = 0;
  const syncedTxIds: string[] = [];

  // Teljes történet letöltése paginációval (while page < totalPages)
  while (page < totalPages && page < 50) {
    const url = `${API_BASE_URL}/transactions?userId=${a8UserId}&accountId=${accountId}&fromOrdinalOnAccount=${fromOrdinal}&status=booked&page=${page}`;
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${customerToken}`,
      },
    });

    if (!res.ok) {
      console.error(`[syncAccountTransactions] Failed to fetch transactions for account ${accountId} (page ${page}): status ${res.status}`);
      break;
    }

    const result = await res.json();
    const txList = Array.isArray(result.transactions) ? result.transactions : (Array.isArray(result) ? result : []);

    // Aggreg8 válasz paginációs metaadatok kiolvasása
    if (typeof result.totalPages === "number") {
      totalPages = result.totalPages;
    }

    console.log(
      `[syncAccountTransactions] Account: ${accountId}, Oldal: ${page + 1}/${totalPages}, Letöltve: ${txList.length} tranzakció.`
    );

    if (txList.length === 0) {
      break;
    }

    for (const tx of txList) {
      // Ha az Aggreg8 szerint törölt tranzakció (PDF 17-18. o.)
      if (tx.bankTransactionId === "DELETED_TRANSACTION" || tx.type === "DELETED_TRANSACTION") {
        await supabaseAdmin
          .from("bank_transactions")
          .delete()
          .eq("a8_transaction_id", tx.id || tx._id);
        continue;
      }

      const ordinal = typeof tx.ordinalOnAccount === "number" ? tx.ordinalOnAccount : null;
      if (ordinal && ordinal > maxOrdinal) {
        maxOrdinal = ordinal;
      }

      const bookingDate = tx.bookingDate ? tx.bookingDate.split("T")[0] : new Date().toISOString().split("T")[0];
      const valueDate = tx.valueDate ? tx.valueDate.split("T")[0] : bookingDate;
      const amount = Number(tx.amount || 0);

      // Meghatározzuk a tranzakció típusát (credit / debit)
      const transactionType = amount >= 0 ? "credit" : "debit";

      const partnerName =
        tx.enriched?.partner?.name ||
        tx.partner?.name ||
        tx.payee?.name ||
        tx.payer?.name ||
        "N/A";

      const partnerAccount =
        tx.partner?.accountNumber ||
        tx.payee?.accountNumber ||
        tx.payer?.accountNumber ||
        null;

      const description =
        tx.enriched?.comment ||
        tx.comment ||
        `${partnerName} - banki átutalás`;

      const txA8Id = tx.id || tx._id;

      // Upsert a meglévő bank_transactions táblába
      await supabaseAdmin.from("bank_transactions").upsert(
        {
          a8_transaction_id: txA8Id,
          company_id: accountRow.company_id,
          a8_account_id: accountId,
          a8_consent_id: accountRow.consent_id,
          bank_id: tx.bankId,
          ordinal_on_account: ordinal,
          bank_transaction_id: tx.bankTransactionId,
          transaction_date: bookingDate,
          value_date: valueDate,
          description: description,
          amount: Math.abs(amount),
          currency: tx.currency || "HUF",
          transaction_type: transactionType,
          category: tx.enriched?.category?.name || "Other",
          counterparty_name: partnerName,
          counterparty_account: partnerAccount,
          status: tx.status === "pending" ? "pending" : "booked",
          enriched_partner_name: tx.enriched?.partner?.name || null,
          enriched_category_id: tx.enriched?.category?.id || null,
          enriched_category_name: tx.enriched?.category?.name || null,
          raw_data: tx,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "a8_transaction_id" }
      );

      if (txA8Id && tx.status !== "pending") {
        syncedTxIds.push(txA8Id);
      }
      totalSynced++;
    }

    // Ha az oldal kevesebb mint 200 elemet tartalmazott, elértük az utolsó oldalt
    if (txList.length < 200) {
      break;
    }

    page++;
  }

  console.log(
    `[syncAccountTransactions] Befejezve: ${accountId}, Összesen mentve: ${totalSynced} tranzakció, maxOrdinal: ${maxOrdinal}`
  );

  // Frissítjük a legmagasabb feldolgozott ordinal-t
  await supabaseAdmin
    .from("aggreg8_accounts")
    .update({
      last_ordinal_on_account: maxOrdinal,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", accountRow.id);

  // PGMQ üzenet küldése a háttér workernek max 200-as csomagokban (számlapárosítás, AI kategória és GL kontírozás)
  if (syncedTxIds.length > 0 && accountRow.company_id) {
    const CHUNK_SIZE = 200;
    for (let i = 0; i < syncedTxIds.length; i += CHUNK_SIZE) {
      const chunk = syncedTxIds.slice(i, i + CHUNK_SIZE);
      try {
        const { data: qResult, error: qError } = await supabaseAdmin.rpc("pgmq_send_retry", {
          queue_name: "transaction_jobs",
          msg: {
            source: "aggreg8",
            job_type: "aggreg8",
            company_id: accountRow.company_id,
            account_id: accountId,
            consent_id: accountRow.consent_id,
            a8_transaction_ids: chunk,
          },
        });
        if (qError) {
          console.error(`[syncAccountTransactions] Failed to enqueue PGMQ chunk ${Math.floor(i / CHUNK_SIZE) + 1}:`, qError);
        } else {
          console.log(
            `[syncAccountTransactions] Enqueued chunk of ${chunk.length} txs to PGMQ transaction_jobs for company ${accountRow.company_id}`
          );
        }
      } catch (qEx) {
        console.error(`[syncAccountTransactions] Exception enqueuing chunk to PGMQ:`, qEx);
      }
    }
  }
}

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
                bank_name: "Aggreg8 Bank",
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
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${customerToken}`,
            },
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
