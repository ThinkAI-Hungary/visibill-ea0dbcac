// ── Aggreg8 Shared Synchronisation Engine ──
// Provides shared authentication, transaction incremental ingestion,
// and state tracking across Edge Functions (aggreg8-api and aggreg8-callback).

export const A8_AIS_API_KEY = Deno.env.get("A8_AIS_API_KEY") || "";
export const A8_ENV = (Deno.env.get("A8_ENVIRONMENT") || "sandbox").toLowerCase();
export const A8_PROD_PROXY_URL = Deno.env.get("A8_PROD_PROXY_URL") || "https://a8.visibill.hu";
export const A8_PROXY_SECRET = Deno.env.get("A8_PROXY_SECRET") || "";

export const API_BASE_URL =
  A8_ENV === "prod"
    ? A8_PROD_PROXY_URL
    : "https://a8-ais-api.sandbox.aggreg8test.hu";

export const SYNC_UI_URL =
  A8_ENV === "prod"
    ? "https://sync-ui.aggreg8.hu"
    : "https://a8-sync-ui.sandbox.aggreg8test.hu";

/**
 * Fejlécek előkészítése az Aggreg8 (vagy a DigitalOcean proxy) hívásokhoz.
 */
export function getAggreg8Headers(extraHeaders: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...extraHeaders };
  if (A8_ENV === "prod" && A8_PROXY_SECRET) {
    headers["X-A8-Proxy-Secret"] = A8_PROXY_SECRET;
  }
  return headers;
}

export interface SyncAccountResult {
  totalSynced: number;
  hasMore: boolean;
}

/**
 * Lekéri vagy felfrissíti a tartós Aggreg8 ügyfél tokent az aggreg8_settings táblából.
 */
export async function getCustomerToken(supabaseAdmin: any, forceRefresh: boolean = false): Promise<string> {
  const sanitize = (t: string | null | undefined): string => {
    if (!t) return "";
    return t.startsWith("Bearer ") ? t.slice(7).trim() : t.trim();
  };

  const now = new Date();
  if (!forceRefresh) {
    const { data: settings } = await supabaseAdmin
      .from("aggreg8_settings")
      .select("customer_token, token_expires_at")
      .eq("environment", A8_ENV)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (
      settings?.customer_token &&
      settings.token_expires_at &&
      new Date(settings.token_expires_at).getTime() > now.getTime() + 5 * 60 * 1000
    ) {
      return sanitize(settings.customer_token);
    }
  }

  if (!A8_AIS_API_KEY) {
    throw new Error("A8_AIS_API_KEY is not configured.");
  }

  const res = await fetch(`${API_BASE_URL}/token`, {
    method: "GET",
    headers: getAggreg8Headers({
      Accept: "application/json",
      apikey: A8_AIS_API_KEY,
    }),
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

/**
 * Egy adott bankszámla inkrementális tranzakció-letöltése az Aggreg8 AIS API-ból.
 * Visszatér a sikeresen letöltött és mentett tranzakciók darabszámával és a hasMore jelzővel.
 */
export async function syncAccountTransactions(
  supabaseAdmin: any,
  customerToken: string,
  accountRow: any,
  a8UserId: string
): Promise<SyncAccountResult> {
  const fromOrdinal = (accountRow.last_ordinal_on_account || 0) + 1;
  const accountId = accountRow.a8_account_id;

  let maxOrdinal = accountRow.last_ordinal_on_account || 0;
  let page = 0;
  let totalPages = 1;
  let totalSynced = 0;
  const syncedTxIds: string[] = [];
  const MAX_PAGES_PER_RUN = 50;

  // Paginált lekérés (max 50 oldal x 200 elem = 10,000 tranzakcióig védve egy futásban)
  while (page < totalPages && page < MAX_PAGES_PER_RUN) {
    const url = `${API_BASE_URL}/transactions?userId=${a8UserId}&accountId=${accountId}&fromOrdinalOnAccount=${fromOrdinal}&status=booked&page=${page}`;
    let res = await fetch(url, {
      headers: getAggreg8Headers({
        Accept: "application/json",
        Authorization: `Bearer ${customerToken}`,
      }),
    });

    // Ha időközben 401 Unauthorized-et kaptunk, frissítsük a tokent és próbáljuk újra egyszer
    if (res.status === 401) {
      console.warn(`[syncAccountTransactions] 401 Unauthorized for account ${accountId}, refreshing token...`);
      try {
        customerToken = await getCustomerToken(supabaseAdmin, true);
        res = await fetch(url, {
          headers: getAggreg8Headers({
            Accept: "application/json",
            Authorization: `Bearer ${customerToken}`,
          }),
        });
      } catch (tokenRefreshErr) {
        console.error(`[syncAccountTransactions] Token refresh failed:`, tokenRefreshErr);
      }
    }

    if (!res.ok) {
      console.error(
        `[syncAccountTransactions] Failed to fetch transactions for account ${accountId} (page ${page}): status ${res.status}`
      );
      break;
    }

    const result = await res.json();
    const txList = Array.isArray(result.transactions)
      ? result.transactions
      : Array.isArray(result)
      ? result
      : [];

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
      // Törölt tranzakció kezelése (PSD2 specifikáció szerint)
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

    if (txList.length < 200) {
      break;
    }

    page++;
  }

  const hasMore = page >= MAX_PAGES_PER_RUN && page < totalPages && totalSynced > 0;

  console.log(
    `[syncAccountTransactions] Befejezve: ${accountId}, Mentve: ${totalSynced} tranzakció, maxOrdinal: ${maxOrdinal}, hasMore: ${hasMore}`
  );

  // Frissítjük a bankszámla állapotát az új ordinal-lal és a most szinkronizált darabszámmal
  await supabaseAdmin
    .from("aggreg8_accounts")
    .update({
      last_ordinal_on_account: maxOrdinal,
      last_synced_at: new Date().toISOString(),
      last_synced_count: totalSynced,
      updated_at: new Date().toISOString(),
    })
    .eq("id", accountRow.id);

  // PGMQ üzenet küldése a háttér workernek max 200-as csomagokban
  if (syncedTxIds.length > 0 && accountRow.company_id) {
    const CHUNK_SIZE = 200;
    for (let i = 0; i < syncedTxIds.length; i += CHUNK_SIZE) {
      const chunk = syncedTxIds.slice(i, i + CHUNK_SIZE);
      try {
        await supabaseAdmin.rpc("pgmq_send_retry", {
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
      } catch (qEx) {
        console.error(`[syncAccountTransactions] Exception enqueuing chunk to PGMQ:`, qEx);
      }
    }
  }

  // Ha még maradtak további oldalak (10 000+ tétel limit elérése), automatikus háttér-folytatás indítása
  if (hasMore) {
    console.log(
      `[syncAccountTransactions] 10,000 tétel limit elérve (${page}/${totalPages} oldal). Automatikus háttér folytatás indítása a következő 10 000 tételre...`
    );
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (supabaseUrl && serviceRoleKey) {
      const continuationPromise = fetch(`${supabaseUrl}/functions/v1/aggreg8-api`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          action: "sync-transactions",
          companyId: accountRow.company_id,
          isContinuation: true,
        }),
      })
        .then(async (cRes) => {
          if (!cRes.ok) {
            const errText = await cRes.text();
            console.error(`[syncAccountTransactions] Continuation trigger failed (${cRes.status}): ${errText}`);
          } else {
            console.log(`[syncAccountTransactions] Continuation successfully dispatched for company ${accountRow.company_id}`);
          }
        })
        .catch((cErr) => {
          console.error(`[syncAccountTransactions] Continuation fetch error:`, cErr);
        });

      // @ts-ignore
      if (typeof EdgeRuntime !== "undefined" && typeof EdgeRuntime.waitUntil === "function") {
        // @ts-ignore
        EdgeRuntime.waitUntil(continuationPromise);
      }
    }
  }

  return { totalSynced, hasMore };
}
