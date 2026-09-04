import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { isCompletedMessage } from "../utils/common.ts";

export const VALID_TABLES: Record<string, string> = {
  invoice: "invoice_uploads",
  transaction: "transaction_uploads",
  bank: "bank_statement_uploads",
  report: "report_uploads",
};
export const VALID_STATUSES = ["done", "pending", "error", "ignored", "processing"];

export const SOURCE_TABLE_TO_BUCKET: Record<string, string> = {
  invoice:            "invoice-uploads",
  invoice_uploads:    "invoice-uploads",
  transaction:        "transactions",
  transaction_uploads:"transactions",
  bank:               "bank-statements",
  bank_statement_uploads: "bank-statements",
  report:             "report-uploads",
  report_uploads:     "report-uploads",
};

export const SOURCE_TABLE_TO_DB: Record<string, string> = {
  invoice:            "invoice_uploads",
  invoice_uploads:    "invoice_uploads",
  transaction:        "transaction_uploads",
  transaction_uploads:"transaction_uploads",
  bank:               "bank_statement_uploads",
  bank_statement_uploads: "bank_statement_uploads",
  report:             "report_uploads",
  report_uploads:     "report_uploads",
};

export function parseStorageUrl(url: string): { bucket: string; path: string } | null {
  try {
    const match = url.match(/\/storage\/v1\/object\/(?:public|authenticated)\/([^/]+)\/(.+)/);
    if (!match) return null;
    return { bucket: match[1], path: match[2] };
  } catch {
    return null;
  }
}

export async function buildFiles(admin: ReturnType<typeof createClient>, url: URL) {
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") || "25", 10)));
  const offset = (page - 1) * pageSize;

  const companyId = url.searchParams.get("companyId") || "";
  const userId = url.searchParams.get("userId") || "";
  const fileType = url.searchParams.get("fileType") || ""; 
  const status = url.searchParams.get("status") || ""; 
  const search = url.searchParams.get("search") || "";
  const dateFrom = url.searchParams.get("dateFrom") || "";
  const dateTo = url.searchParams.get("dateTo") || "";
  const sortBy = url.searchParams.get("sortBy") || "created_at";
  const sortDir = url.searchParams.get("sortDir") === "asc" ? "asc" : "desc";

  // Fast-path: RPC get_management_files
  try {
    const { data: rpcRes, error: rpcErr } = await admin.rpc("get_management_files" as any, {
      p_page: page,
      p_page_size: pageSize,
      p_sort_by: sortBy,
      p_sort_dir: sortDir,
      p_search: search || null,
      p_company_id: companyId || null,
      p_user_id: userId || null,
      p_file_type: fileType || null,
      p_status: status || null,
      p_date_from: dateFrom ? dateFrom : null,
      p_date_to: dateTo ? `${dateTo}T23:59:59.999Z` : null,
    });
    if (!rpcErr && rpcRes && typeof rpcRes === "object") {
      return rpcRes;
    }
    if (rpcErr) {
      console.warn("[buildFiles] get_management_files RPC returned error, using fallback:", rpcErr);
    }
  } catch (e) {
    console.warn("[buildFiles] get_management_files RPC exception, using fallback:", e);
  }

  const fetchTable = async (tableName: string, typeKey: string, typeLabel: string) => {
    if (fileType && fileType !== typeKey) return [];
    
    let q = admin.from(tableName).select("*");
    if (companyId) q = q.eq("company_id", companyId);
    if (userId) q = q.eq("user_id", userId);
    if (search) q = q.or(`file_name.ilike.%${search}%,error_message.ilike.%${search}%`);
    if (dateFrom) q = q.gte("created_at", dateFrom);
    if (dateTo) q = q.lte("created_at", `${dateTo}T23:59:59`);
    
    q = q.order("created_at", { ascending: sortDir === "ASC" }).limit(500);
    const { data, error } = await q;
    if (error || !data) return [];
    return data.map((r: any) => ({ ...r, source_table: typeKey, file_type_label: typeLabel }));
  };

  const [invoiceRows, transactionRows, bankRows, reportRows] = await Promise.all([
    fetchTable("invoice_uploads", "invoice", "Számla"),
    fetchTable("transaction_uploads", "transaction", "Tranzakció"),
    fetchTable("bank_statement_uploads", "bank", "Bankkivonat"),
    fetchTable("report_uploads", "report", "Riport"),
  ]);

  const allRows = [...invoiceRows, ...transactionRows, ...bankRows, ...reportRows];

  const SUCCESS_STATUSES = new Set(["done", "completed", "processed"]);
  const ERROR_STATUSES = new Set(["error", "failed", "ignored", "dismissed", "webhook_failed"]);

  const [companiesRes, profilesRes] = await Promise.all([
    admin.from("companies").select("id, name"),
    admin.from("profiles").select("user_id, name")
  ]);

  const companyMap = new Map((companiesRes.data || []).map((c: any) => [c.id, c.name]));
  const profileMap = new Map((profilesRes.data || []).map((p: any) => [p.user_id, p.name]));

  const mappedRows = allRows.map(row => {
    return {
      id: row.id,
      source_table: row.source_table,
      file_type_label: row.file_type_label,
      company_id: row.company_id,
      company_name: companyMap.get(row.company_id) || null,
      user_id: row.user_id,
      user_name: row.metadata?.source === 'email_alias' 
        ? 'Mailgun'
        : (row.user_id ? (profileMap.get(row.user_id) || null) : 'Mailgun'),
      user_email: row.metadata?.sender || null,
      file_name: row.file_name,
      file_size: row.file_size,
      file_type: row.file_type,
      file_url: row.file_url,
      upload_status: row.upload_status,
      processing_status: row.processing_status,
      error_message: row.error_message,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  });

  const isError = (r: typeof mappedRows[0]) => ERROR_STATUSES.has(r.processing_status || "") || (!!r.error_message && !isCompletedMessage(r.error_message));
  const isSuccess = (r: typeof mappedRows[0]) => isCompletedMessage(r.error_message) && SUCCESS_STATUSES.has(r.processing_status || "");

  // Deduplicate raw rows across upload tables matching the get_management_files RPC
  const dedupMap = new Map<string, typeof mappedRows[0]>();
  for (const r of mappedRows) {
    const normKey = `${r.company_id || ''}::${(r.file_name || r.file_url || '').toLowerCase().trim()}`;
    const existing = dedupMap.get(normKey);
    if (!existing) {
      dedupMap.set(normKey, r);
    } else {
      const existingSuccess = isSuccess(existing);
      const currentSuccess = isSuccess(r);
      if (!existingSuccess && currentSuccess) {
        dedupMap.set(normKey, r);
      } else if (existingSuccess === currentSuccess) {
        if (new Date(r.created_at).getTime() > new Date(existing.created_at).getTime()) {
          dedupMap.set(normKey, r);
        }
      }
    }
  }
  const dedupedRows = Array.from(dedupMap.values());

  const stats = {
    totalCount: dedupedRows.length,
    successCount: dedupedRows.filter(isSuccess).length,
    errorCount: dedupedRows.filter(isError).length,
    pendingCount: 0,
  };
  stats.pendingCount = stats.totalCount - stats.successCount - stats.errorCount;

  let filteredRows = dedupedRows;
  if (status) {
    const vals = status.split(",");
    const wantPending = vals.includes("pending");
    filteredRows = mappedRows.filter(r => {
      const s = r.processing_status || "";
      if (vals.includes(s)) return true;
      if (isError(r) && !isSuccess(r)) {
        if (vals.some(v => ERROR_STATUSES.has(v))) return true;
      }
      if (wantPending && !isSuccess(r) && !isError(r)) return true;
      return false;
    });
  }

  const safeSort = (['created_at', 'file_name', 'file_size', 'company_name', 'user_name', 'processing_status'].includes(sortBy) ? sortBy : 'created_at') as keyof typeof mappedRows[0];
  
  filteredRows.sort((a, b) => {
    const va = a[safeSort] ?? "";
    const vb = b[safeSort] ?? "";
    if (sortDir === "ASC") return va < vb ? -1 : va > vb ? 1 : 0;
    return va > vb ? -1 : va < vb ? 1 : 0;
  });

  return {
    totalRows: filteredRows.length,
    files: filteredRows.slice(offset, offset + pageSize),
    stats,
  };
}

export async function updateFileStatus(
  admin: ReturnType<typeof createClient>,
  body: { files?: Array<{ id: string; source_table: string }>; targetStatus?: string }
) {
  const { files, targetStatus } = body;

  if (!files || !Array.isArray(files) || files.length === 0) {
    return { error: "files array required", updated: 0 };
  }
  if (!targetStatus || !VALID_STATUSES.includes(targetStatus)) {
    return { error: `Invalid targetStatus. Valid: ${VALID_STATUSES.join(", ")}`, updated: 0 };
  }
  if (files.length > 200) {
    return { error: "Max 200 files per batch", updated: 0 };
  }

  const DONE_STATUS_MAP: Record<string, string> = {
    invoice_uploads: "processed",
    transaction_uploads: "completed",
    bank_statement_uploads: "completed",
    report_uploads: "completed",
  };

  const grouped = new Map<string, string[]>();
  for (const f of files) {
    const tableName = VALID_TABLES[f.source_table];
    if (!tableName) continue;
    const ids = grouped.get(tableName) || [];
    ids.push(f.id);
    grouped.set(tableName, ids);
  }

  let totalUpdated = 0;
  const errors: string[] = [];

  await Promise.all(
    Array.from(grouped.entries()).map(async ([tableName, ids]) => {
      const resolvedStatus = targetStatus === "done"
        ? (DONE_STATUS_MAP[tableName] || "completed")
        : targetStatus;

      const { data, error } = await admin
        .from(tableName)
        .update({ processing_status: resolvedStatus, updated_at: new Date().toISOString() })
        .in("id", ids)
        .select("id");

      if (error) {
        errors.push(`${tableName}: ${error.message}`);
      } else {
        totalUpdated += data?.length ?? 0;
      }
    })
  );

  return {
    success: errors.length === 0,
    updated: totalUpdated,
    requested: files.length,
    ...(errors.length > 0 ? { errors } : {}),
  };
}

export async function deleteFiles(
  admin: ReturnType<typeof createClient>,
  body: {
    files?: Array<{ id: string; source_table: string; file_url: string | null }>;
    dbOnly?: boolean;
  }
) {
  const { files, dbOnly } = body;

  if (!files || !Array.isArray(files) || files.length === 0) {
    return { error: "files array required", deleted: 0 };
  }
  if (files.length > 200) {
    return { error: "Max 200 files per batch", deleted: 0 };
  }

  const invalidTables = files.filter(f => !SOURCE_TABLE_TO_DB[f.source_table]).map(f => f.source_table);
  if (invalidTables.length > 0) {
    return { error: `Invalid source_table values: ${[...new Set(invalidTables)].join(", ")}`, deleted: 0 };
  }

  let storageDeleted = 0;
  let dbOnlyDeleted = 0;
  const storageErrors: string[] = [];
  const dbErrors: string[] = [];

  const deletingIds = new Set(files.map(x => x.id));
  const deletedStoragePaths = new Set<string>();

  await Promise.all(
    files.map(async (f) => {
      const dbTable = SOURCE_TABLE_TO_DB[f.source_table];

      let shouldDeleteStorage = Boolean(f.file_url && !dbOnly);

      if (shouldDeleteStorage) {
        // Guard: check if any SURVIVING upload record in any table still references this exact file_url
        try {
          const checkTables = ["invoice_uploads", "transaction_uploads", "report_uploads", "bank_statement_uploads"];
          const checkResults = await Promise.all(
            checkTables.map(tbl =>
              admin.from(tbl).select("id").eq("file_url", f.file_url!).limit(10)
            )
          );
          const hasSiblingRef = checkResults.some(r =>
            (r.data || []).some((row: any) => !deletingIds.has(row.id))
          );

          // Guard: check if any finalized invoice references this file_url
          let hasInvoiceRef = false;
          try {
            const invCheck = await admin
              .from("invoices")
              .select("id")
              .or(`melleklet_url.eq.${f.file_url},image_url.eq.${f.file_url}`)
              .limit(1);
            hasInvoiceRef = Boolean(invCheck.data && invCheck.data.length > 0);
          } catch {}

          if (hasSiblingRef || hasInvoiceRef) {
            shouldDeleteStorage = false;
            console.info(`[delete-files] Preserving physical storage blob for ${f.id} because surviving records reference ${f.file_url}`);
          }
        } catch (err) {
          console.warn(`[delete-files] Failed to check sibling references for ${f.id}, defaulting to storage delete:`, err);
        }
      }

      if (shouldDeleteStorage) {
        const parsed = parseStorageUrl(f.file_url!);
        if (parsed) {
          const storageKey = `${parsed.bucket}:${parsed.path}`;
          if (!deletedStoragePaths.has(storageKey)) {
            deletedStoragePaths.add(storageKey);
            const { error: storageError } = await admin.storage
              .from(parsed.bucket)
              .remove([parsed.path]);
            if (storageError) {
              storageErrors.push(`${f.id}: ${storageError.message}`);
              console.error(`[delete-files] Storage removal failed for ${f.id}:`, storageError.message);
            } else {
              storageDeleted++;
            }
          }
        } else {
          storageErrors.push(`${f.id}: could not parse storage URL`);
        }
      } else {
        dbOnlyDeleted++;
      }

      const { error: dbError } = await admin
        .from(dbTable)
        .delete()
        .eq("id", f.id);

      if (dbError) {
        dbErrors.push(`${f.id}: ${dbError.message}`);
        console.error(`[delete-files] DB row deletion failed for ${f.id}:`, dbError.message);
      }
    })
  );

  const totalDeleted = storageDeleted + dbOnlyDeleted;

  return {
    success: dbErrors.length === 0,
    deleted: totalDeleted,
    storageDeleted,
    dbOnlyDeleted,
    requested: files.length,
    ...(storageErrors.length > 0 ? { storageErrors } : {}),
    ...(dbErrors.length > 0 ? { dbErrors } : {}),
  };
}
