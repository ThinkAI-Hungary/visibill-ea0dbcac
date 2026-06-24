import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

// Admin-only operation: sandbox mock storage cleanup
// Auth: service_role key via x-admin-secret header (no JWT verify)
// Ez a function KIZÁRÓLAG a SANDBOX cég (59b545c0-...) sandbox-demo/ mappájában
// lévő mock számlaképeket törli a Storage-ból, és NULL-ra állítja a melleklet_url
// mezőket az érintett mock invoice rekordokban.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-secret",
};

const SANDBOX_COMPANY_ID = "59b545c0-5818-4499-ac5e-06afc0880e73";
const SANDBOX_STORAGE_PREFIX = "sandbox-demo/";
const INVOICE_BUCKET = "invoice-uploads";

// Azok a mock számla ID-k amelyek a sandbox-demo/ prefixű melleklet_url-lel rendelkeznek
// Ezeket identifikáljuk az f2000000- UUID-prefix alapján (seeded mock adatok)
const MOCK_INVOICE_UUID_PREFIX = "f2000000-";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase environment variables" }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    // Auth: x-admin-secret header ellenőrzés
    const adminSecret = req.headers.get("x-admin-secret");
    const expectedSecret = Deno.env.get("ADMIN_CLEANUP_SECRET");

    if (!expectedSecret || adminSecret !== expectedSecret) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: invalid or missing admin secret" }),
        {
          status: 401,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    // Optional: dry_run mode a biztonságos előnézethez
    const url = new URL(req.url);
    const dryRun = url.searchParams.get("dry_run") === "true";

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // ── 1. Storage: sandbox-demo/ mappa összes fájljának listázása ──────────
    console.log(`[sandbox-cleanup] Listing storage files in ${INVOICE_BUCKET}/${SANDBOX_STORAGE_PREFIX}`);

    const { data: storageFiles, error: listError } = await serviceClient.storage
      .from(INVOICE_BUCKET)
      .list(SANDBOX_STORAGE_PREFIX.replace(/\/$/, ""), {
        limit: 200,
        offset: 0,
      });

    if (listError) {
      console.error("[sandbox-cleanup] Storage list error:", listError);
      return new Response(
        JSON.stringify({ error: "Storage list failed", detail: listError.message }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    const filePaths = (storageFiles ?? []).map(
      (f) => `${SANDBOX_STORAGE_PREFIX}${f.name}`
    );

    console.log(`[sandbox-cleanup] Found ${filePaths.length} files:`, filePaths);

    // ── 2. DB: mock invoice rekordok lekérdezése (melleklet_url NOT NULL) ───
    const { data: mockInvoices, error: invoiceQueryError } = await serviceClient
      .from("invoices")
      .select("id, bizonylatsorszam, melleklet_url")
      .eq("company_id", SANDBOX_COMPANY_ID)
      .like("id", `${MOCK_INVOICE_UUID_PREFIX}%`)
      .not("melleklet_url", "is", null);

    if (invoiceQueryError) {
      console.error("[sandbox-cleanup] Invoice query error:", invoiceQueryError);
      return new Response(
        JSON.stringify({ error: "Invoice query failed", detail: invoiceQueryError.message }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    const affectedInvoices = mockInvoices ?? [];
    console.log(
      `[sandbox-cleanup] Found ${affectedInvoices.length} mock invoices with melleklet_url to clear`
    );

    // ── DRY RUN: visszaadjuk mi fog történni, de nem csinálunk semmit ───────
    if (dryRun) {
      return new Response(
        JSON.stringify({
          dry_run: true,
          storage_files_to_delete: filePaths,
          invoices_to_clear: affectedInvoices.map((i) => ({
            id: i.id,
            bizonylatsorszam: i.bizonylatsorszam,
            melleklet_url: i.melleklet_url,
          })),
        }),
        {
          status: 200,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    // ── 3. Storage törlés ────────────────────────────────────────────────────
    let storageDeletedCount = 0;
    let storageErrors: string[] = [];

    if (filePaths.length > 0) {
      const { data: deleteData, error: deleteError } = await serviceClient.storage
        .from(INVOICE_BUCKET)
        .remove(filePaths);

      if (deleteError) {
        console.error("[sandbox-cleanup] Storage delete error:", deleteError);
        storageErrors.push(deleteError.message);
      } else {
        storageDeletedCount = deleteData?.length ?? 0;
        console.log(`[sandbox-cleanup] Deleted ${storageDeletedCount} storage files`);
      }
    }

    // ── 4. DB cleanup: melleklet_url → NULL ─────────────────────────────────
    let dbClearedCount = 0;
    let dbError: string | null = null;

    if (affectedInvoices.length > 0) {
      const { error: updateError, count } = await serviceClient
        .from("invoices")
        .update({ melleklet_url: null })
        .eq("company_id", SANDBOX_COMPANY_ID)
        .like("id", `${MOCK_INVOICE_UUID_PREFIX}%`)
        .not("melleklet_url", "is", null);

      if (updateError) {
        console.error("[sandbox-cleanup] DB update error:", updateError);
        dbError = updateError.message;
      } else {
        dbClearedCount = count ?? affectedInvoices.length;
        console.log(`[sandbox-cleanup] Cleared melleklet_url on ${dbClearedCount} invoice records`);
      }
    }

    // ── 5. Összefoglaló ──────────────────────────────────────────────────────
    const result = {
      success: storageErrors.length === 0 && dbError === null,
      storage: {
        files_found: filePaths.length,
        files_deleted: storageDeletedCount,
        deleted_paths: filePaths,
        errors: storageErrors,
      },
      database: {
        invoices_found: affectedInvoices.length,
        invoices_cleared: dbClearedCount,
        error: dbError,
      },
    };

    console.log("[sandbox-cleanup] Done:", JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 207,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[sandbox-cleanup] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }
});
