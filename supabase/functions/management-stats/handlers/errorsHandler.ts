import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getClientForProject } from "../utils/multiProject.ts";

export function categorizeError(msg: string | null): string {
  if (!msg) return "Worker";
  const lower = msg.toLowerCase();
  if (lower.includes("timeout") || lower.includes("timed out")) return "Application";
  if (lower.includes("rate limit") || lower.includes("429")) return "Application";
  if (lower.includes("apierror") || lower.includes("pgrst") || lower.includes("http error")) return "Application";
  if (lower.includes("duplicate key") || lower.includes("already exists")) return "Worker";
  return "Worker";
}

export const APP_LOG_CATEGORY_MAP: Record<string, string> = {
  auth:         "Application",
  db_query:     "Application",
  api_call:     "Application",
  upload:       "Application",
  validation:   "Application",
  navigation:   "Application",
  unhandled:    "Application",
  realtime:     "Application",
  webhook:      "Mailgun",
  mailgun:      "Mailgun",
  email_alias:  "Mailgun",
  worker:       "Worker",
};

export function categoryLabel(cat: string): string {
  if (APP_LOG_CATEGORY_MAP[cat]) return APP_LOG_CATEGORY_MAP[cat];
  if (cat === "Application" || cat === "Mailgun" || cat === "Worker") return cat;
  return "Worker";
}

export const UPLOAD_SOURCES = new Set([
  "invoice_uploads", "transaction_uploads", "report_uploads",
  "gl_upload_notifications", "nav_sync_logs", "bank_statement_uploads",
]);

export const SOURCE_LABELS: Record<string, string> = {
  invoice_uploads:          "Feltöltés",
  transaction_uploads:      "Feltöltés",
  report_uploads:           "Feltöltés",
  gl_upload_notifications:  "Feltöltés",
  nav_sync_logs:            "Feltöltés",
  bank_statement_uploads:   "Feltöltés",
  "app_error_logs:frontend": "Frontend",
  "app_error_logs:worker":   "Worker",
  "app_error_logs:mailgun":  "Mailgun",
};

export function appLogSubSource(errorType: string): string {
  if (errorType === "worker") return "app_error_logs:worker";
  if (["webhook", "mailgun", "email_alias"].includes(errorType)) return "app_error_logs:mailgun";
  return "app_error_logs:frontend";
}

export type ErrorRow = {
  id: string;
  created_at: string;
  error_timestamp: string;
  source: string;
  source_label: string;
  error_category: string;
  error_category_label: string;
  error_message: string | null;
  file_name: string | null;
  file_url: string | null;
  company_id: string | null;
  company_name: string | null;
  user_id: string | null;
  user_name: string | null;
  context: Record<string, unknown> | null;
  stack_trace?: string | null;
  url?: string | null;
};

export async function buildErrors(admin: ReturnType<typeof createClient>, url: URL) {
  const page = Math.max(0, Number(url.searchParams.get("page") || 0));
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") || 25)));
  const sortBy = url.searchParams.get("sortBy") || "created_at";
  const sortDir = url.searchParams.get("sortDir") || "desc";
  const search = (url.searchParams.get("search") || "").trim().toLowerCase();
  const filterCompanyId = url.searchParams.get("companyId") || "";
  const filterSource = url.searchParams.get("source") || "";
  const filterCategory = url.searchParams.get("category") || "";
  const filterUserId = url.searchParams.get("userId") || "";
  const dateFrom = url.searchParams.get("dateFrom") || "";
  const dateTo = url.searchParams.get("dateTo") || "";

  const [companiesRes, profilesRes, ...errorResults] = await Promise.all([
    admin.from("companies").select("id, name"),
    admin.from("profiles").select("user_id, name"),
    admin.from("invoice_uploads")
      .select("id, created_at, updated_at, error_message, file_name, file_url, company_id, user_id, metadata")
      .eq("processing_status", "error"),
    admin.from("transaction_uploads")
      .select("id, created_at, updated_at, error_message, file_name, file_url, company_id, user_id, metadata")
      .eq("processing_status", "error"),
    admin.from("report_uploads")
      .select("id, created_at, updated_at, error_message, file_name, file_url, company_id, user_id, metadata")
      .eq("processing_status", "error"),
    admin.from("gl_upload_notifications")
      .select("id, created_at, processed_at, error_message, company_id")
      .eq("processing_status", "error"),
    admin.from("nav_sync_logs")
      .select("id, started_at, completed_at, error_message, company_id")
      .eq("status", "error"),
    admin.from("bank_statement_uploads")
      .select("id, created_at, updated_at, error_message, file_name, file_url, company_id, user_id, metadata")
      .eq("processing_status", "error"),
    admin.from("app_error_logs")
      .select("id, created_at, message, error_type, component, action, company_id, user_id, context, stack_trace, url")
      .eq("severity", "error")
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const companyById = new Map((companiesRes.data || []).map((c: any) => [c.id, c.name]));
  const profileByUserId = new Map((profilesRes.data || []).map((p: any) => [p.user_id, p.name]));

  const sourceNames = [
    "invoice_uploads", "transaction_uploads", "report_uploads",
    "gl_upload_notifications", "nav_sync_logs", "bank_statement_uploads",
    "app_error_logs",
  ];

  let allErrors: ErrorRow[] = [];
  for (let i = 0; i < sourceNames.length; i++) {
    const res = errorResults[i];
    if (res.error) {
      console.warn(`[MANAGEMENT-STATS] Error querying ${sourceNames[i]}:`, res.error.message);
      continue;
    }
    const source = sourceNames[i];
    for (const row of res.data || []) {
      const isAppLog = source === "app_error_logs";
      const isMailgunComponent = isAppLog && row.component === 'process-mailgun-webhook';
      const cat = isMailgunComponent
        ? 'Mailgun'
        : isAppLog ? (row.error_type || "unknown") : categorizeError(row.error_message ?? row.message);
      const ctxEmail = isAppLog && row.context?.email ? ` [${row.context.email}]` : "";
      const errorMsg = isAppLog
        ? `[${row.component || '?'}/${row.action || '?'}]${ctxEmail} ${row.message || ''}`
        : (row.error_message || null);
      const effectiveSource = isMailgunComponent
        ? 'app_error_logs:mailgun'
        : isAppLog ? appLogSubSource(row.error_type || "") : source;

      let errorTimestamp = row.created_at;
      if (source === "nav_sync_logs") {
        errorTimestamp = row.completed_at || row.started_at;
      } else if (source === "gl_upload_notifications") {
        errorTimestamp = row.processed_at || row.created_at;
      } else if (!isAppLog) {
        errorTimestamp = row.updated_at || row.created_at;
      }

      allErrors.push({
        id: row.id,
        created_at: source === "nav_sync_logs" ? row.started_at : row.created_at,
        error_timestamp: errorTimestamp,
        source: effectiveSource,
        source_label: SOURCE_LABELS[effectiveSource] || SOURCE_LABELS[source] || source,
        error_category: cat,
        error_category_label: categoryLabel(cat),
        error_message: errorMsg,
        file_name: isAppLog ? (row.component || null) : (row.file_name || null),
        file_url: isAppLog ? null : (row.file_url || null),
        company_id: row.company_id || null,
        company_name: row.company_id ? (companyById.get(row.company_id) as string || null) : null,
        user_id: row.user_id || null,
        user_name: (isAppLog && row.component === 'process-mailgun-webhook')
          ? 'Mailgun'
          : (!isAppLog && row.metadata?.source === 'email_alias')
            ? 'Mailgun'
            : (row.user_id ? (profileByUserId.get(row.user_id) as string || null) : null),
        context: isAppLog ? (row.context || null) : null,
        stack_trace: isAppLog ? (row.stack_trace || null) : null,
        url: isAppLog ? (row.url || null) : null,
      });
    }
  }

  const totalErrors = allErrors.length;
  const now = Date.now();
  const last24hErrors = allErrors.filter(e => now - new Date(e.error_timestamp).getTime() < 86400_000).length;

  const companyErrorCounts = new Map<string, { id: string; name: string; count: number }>();
  for (const e of allErrors) {
    if (!e.company_id) continue;
    const existing = companyErrorCounts.get(e.company_id);
    if (existing) existing.count++;
    else companyErrorCounts.set(e.company_id, { id: e.company_id, name: e.company_name || "—", count: 1 });
  }
  let mostAffectedCompany: { id: string; name: string; errorCount: number } | null = null;
  for (const v of companyErrorCounts.values()) {
    if (!mostAffectedCompany || v.count > mostAffectedCompany.errorCount) {
      mostAffectedCompany = { id: v.id, name: v.name, errorCount: v.count };
    }
  }

  const userErrorCounts = new Map<string, { id: string; name: string; count: number }>();
  for (const e of allErrors) {
    if (!e.user_id) continue;
    const existing = userErrorCounts.get(e.user_id);
    if (existing) existing.count++;
    else userErrorCounts.set(e.user_id, { id: e.user_id, name: e.user_name || "—", count: 1 });
  }
  let mostAffectedUser: { id: string; name: string; errorCount: number } | null = null;
  for (const v of userErrorCounts.values()) {
    if (!mostAffectedUser || v.count > mostAffectedUser.errorCount) {
      mostAffectedUser = { id: v.id, name: v.name, errorCount: v.count };
    }
  }

  const categoryCounts = new Map<string, number>();
  for (const e of allErrors) {
    categoryCounts.set(e.error_category, (categoryCounts.get(e.error_category) || 0) + 1);
  }
  let topErrorCategory: { category: string; label: string; count: number } | null = null;
  for (const [cat, cnt] of categoryCounts) {
    if (!topErrorCategory || cnt > topErrorCategory.count) {
      topErrorCategory = { category: cat, label: categoryLabel(cat), count: cnt };
    }
  }

  if (filterCompanyId) allErrors = allErrors.filter(e => e.company_id === filterCompanyId);
  if (filterUserId) allErrors = allErrors.filter(e => e.user_id === filterUserId);
  if (filterSource) {
    if (filterSource === 'uploads') {
      allErrors = allErrors.filter(e => UPLOAD_SOURCES.has(e.source));
    } else {
      allErrors = allErrors.filter(e => e.source === filterSource || e.source.startsWith(filterSource + ':'));
    }
  }
  if (filterCategory) allErrors = allErrors.filter(e => e.error_category_label === filterCategory);
  if (dateFrom) {
    const d = dateFrom.includes('T') ? new Date(dateFrom).getTime() : new Date(`${dateFrom}T00:00:00.000Z`).getTime();
    if (!isNaN(d)) {
      allErrors = allErrors.filter(e => new Date(e.error_timestamp).getTime() >= d);
    }
  }
  if (dateTo) {
    const d = dateTo.includes('T') ? new Date(dateTo).getTime() : new Date(`${dateTo}T23:59:59.999Z`).getTime();
    if (!isNaN(d)) {
      allErrors = allErrors.filter(e => new Date(e.error_timestamp).getTime() <= d);
    }
  }
  if (search) {
    allErrors = allErrors.filter(e =>
      (e.error_message || "").toLowerCase().includes(search) ||
      (e.file_name || "").toLowerCase().includes(search) ||
      (e.company_name || "").toLowerCase().includes(search) ||
      (e.user_name || "").toLowerCase().includes(search)
    );
  }

  const allowedSort = new Set(["created_at", "source", "error_category"]);
  const key = allowedSort.has(sortBy) ? sortBy : "created_at";
  const dir = sortDir === "asc" ? 1 : -1;
  allErrors.sort((a, b) => {
    if (key === "created_at") {
      return (new Date(a.error_timestamp).getTime() - new Date(b.error_timestamp).getTime()) * dir;
    }
    return ((a as any)[key] || "").localeCompare((b as any)[key] || "") * dir;
  });

  const totalRows = allErrors.length;
  const paged = allErrors.slice(page * pageSize, page * pageSize + pageSize);

  return {
    totalErrors,
    last24hErrors,
    mostAffectedCompany,
    mostAffectedUser,
    topErrorCategory,
    totalRows,
    errors: paged,
  };
}

export async function deleteErrors(
  admin: ReturnType<typeof createClient>,
  body: { ids?: Array<{ source: string; id: string; project?: string }> },
) {
  if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
    return { deleted: 0, error: null };
  }

  const byProjectAndSource = new Map<string, Map<string, string[]>>();
  for (const item of body.ids) {
    if (!item.source || !item.id) continue;
    const project = item.project || "PROD";
    if (!byProjectAndSource.has(project)) {
      byProjectAndSource.set(project, new Map<string, string[]>());
    }
    const sourceMap = byProjectAndSource.get(project)!;
    if (!sourceMap.has(item.source)) {
      sourceMap.set(item.source, []);
    }
    sourceMap.get(item.source)!.push(item.id);
  }

  const validTables = new Set([
    "invoice_uploads", "transaction_uploads", "report_uploads",
    "gl_upload_notifications", "nav_sync_logs", "bank_statement_uploads",
    "app_error_logs",
  ]);

  let totalDeleted = 0;
  const errors: string[] = [];

  for (const [project, sourceMap] of byProjectAndSource) {
    const projectClient = getClientForProject(admin, project);

    for (const [rawSource, ids] of sourceMap) {
      const source = rawSource.includes(':') ? rawSource.split(':')[0] : rawSource;
      if (!validTables.has(source)) {
        errors.push(`[${project}] Invalid source: ${rawSource}`);
        continue;
      }

      if (source === "app_error_logs") {
        const { error, count } = await projectClient
          .from("app_error_logs")
          .delete()
          .in("id", ids);

        if (error) {
          errors.push(`[${project}] ${source}: ${error.message}`);
        } else {
          totalDeleted += count || 0;
        }
      } else {
        const statusField = source === "nav_sync_logs" ? "status" : "processing_status";
        const { error, count } = await projectClient
          .from(source)
          .update({
            [statusField]: "dismissed",
            error_message: null,
          } as any)
          .in("id", ids)
          .eq(statusField, "error");

        if (error) {
          errors.push(`[${project}] ${source}: ${error.message}`);
        } else {
          totalDeleted += count || 0;
        }
      }
    }
  }

  return {
    deleted: totalDeleted,
    error: errors.length > 0 ? errors.join("; ") : null,
  };
}

export async function deleteAllErrors(
  admin: ReturnType<typeof createClient>,
) {
  const errors: string[] = [];
  let totalDeleted = 0;

  const { error: appErr, count: appCount } = await admin
    .from("app_error_logs")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (appErr) errors.push(`app_error_logs: ${appErr.message}`);
  else totalDeleted += appCount || 0;

  const uploadTables = [
    { table: "invoice_uploads", statusField: "processing_status" },
    { table: "transaction_uploads", statusField: "processing_status" },
    { table: "report_uploads", statusField: "processing_status" },
    { table: "gl_upload_notifications", statusField: "processing_status" },
    { table: "nav_sync_logs", statusField: "status" },
    { table: "bank_statement_uploads", statusField: "processing_status" },
  ];

  for (const { table, statusField } of uploadTables) {
    const { error, count } = await admin
      .from(table)
      .update({ [statusField]: "dismissed", error_message: null } as any)
      .eq(statusField, "error");
    if (error) errors.push(`${table}: ${error.message}`);
    else totalDeleted += count || 0;
  }

  return {
    deleted: totalDeleted,
    error: errors.length > 0 ? errors.join("; ") : null,
  };
}

export const QUEUE_MAP: Record<string, string> = {
  invoice_uploads: "invoice_jobs",
  transaction_uploads: "transaction_jobs",
  gl_upload_notifications: "gl_classification_jobs",
  report_uploads: "report_jobs",
};

export const QUEUE_TABLE_MAP: Record<string, string> = {
  invoice_jobs: "invoice_uploads",
  transaction_jobs: "transaction_uploads",
  gl_classification_jobs: "gl_upload_notifications",
  report_jobs: "report_uploads",
};

export const RETRY_SELECT: Record<string, string> = {
  invoice_uploads: "id, user_id, company_id, file_url, file_name, document_category",
  transaction_uploads: "id, user_id, company_id, file_url, file_name",
  gl_upload_notifications: "id, company_id",
  report_uploads: "id, user_id, company_id, file_url, file_name",
};

export function buildQueuePayload(source: string, row: any): Record<string, unknown> {
  if (source === "invoice_uploads") {
    return {
      id: row.id,
      user_id: row.user_id,
      company_id: row.company_id,
      file_url: row.file_url,
      file_name: row.file_name,
      document_category: row.document_category,
      source: "invoice_uploads",
    };
  }
  if (source === "transaction_uploads") {
    return {
      id: row.id,
      user_id: row.user_id,
      company_id: row.company_id,
      file_url: row.file_url,
      file_name: row.file_name,
      source: "transaction_uploads",
    };
  }
  if (source === "gl_upload_notifications") {
    return {
      id: row.id,
      company_id: row.company_id,
      source: "gl_upload_notifications",
    };
  }
  if (source === "report_uploads") {
    return {
      id: row.id,
      user_id: row.user_id,
      company_id: row.company_id,
      file_url: row.file_url,
      file_name: row.file_name,
      source: "report_uploads",
    };
  }
  return { id: row.id, source };
}

export async function migrateRowToTable(
  client: any,
  sourceTable: string,
  targetTable: string,
  rowId: string,
) {
  const { data: row, error: fetchErr } = await client
    .from(sourceTable)
    .select("*")
    .eq("id", rowId)
    .maybeSingle();

  if (fetchErr || !row) {
    throw new Error(`Failed to fetch source row: ${fetchErr?.message || "Not found"}`);
  }

  const targetRow: Record<string, any> = {
    id: row.id,
    user_id: row.user_id,
    company_id: row.company_id,
    file_name: row.file_name,
    file_type: row.file_type,
    file_size: row.file_size,
    file_url: row.file_url,
    upload_status: row.upload_status || "uploaded",
    processing_status: "pending",
    error_message: null,
    metadata: row.metadata || {},
    ...(row.notes !== undefined && { notes: row.notes }),
    ...(row.email_sender_domain !== undefined && { email_sender_domain: row.email_sender_domain }),
  };

  if (targetTable === "invoice_uploads") {
    targetRow.document_category = row.document_category || "invoice";
  }

  const { error: delErr } = await client
    .from(sourceTable)
    .delete()
    .eq("id", rowId);

  if (delErr) {
    throw new Error(`Failed to delete source row: ${delErr.message}`);
  }

  const { error: insErr } = await client
    .from(targetTable)
    .insert(targetRow);

  if (insErr) {
    await client.from(sourceTable).insert(row);
    throw new Error(`Failed to insert target row: ${insErr.message}`);
  }

  return targetRow;
}

export async function retryErrors(
  admin: ReturnType<typeof createClient>,
  body: {
    ids?: Array<{ source: string; id: string; project?: string }>;
    targetQueue?: string;
    targetCategory?: string | null;
  },
) {
  if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
    return { retried: 0, error: null };
  }

  const validQueues = new Set(Object.values(QUEUE_MAP));
  const effectiveQueue = body.targetQueue && validQueues.has(body.targetQueue)
    ? body.targetQueue
    : null;

  const byProjectAndSource = new Map<string, Map<string, string[]>>();
  for (const item of body.ids) {
    if (!item.source || !item.id) continue;
    const project = item.project || "PROD";
    if (!byProjectAndSource.has(project)) {
      byProjectAndSource.set(project, new Map<string, string[]>());
    }
    const sourceMap = byProjectAndSource.get(project)!;
    if (!sourceMap.has(item.source)) {
      sourceMap.set(item.source, []);
    }
    sourceMap.get(item.source)!.push(item.id);
  }

  let totalRetried = 0;
  const errors: string[] = [];

  for (const [project, sourceMap] of byProjectAndSource) {
    const projectClient = getClientForProject(admin, project);

    const logSources = Array.from(sourceMap.keys()).filter(k => k === "app_error_logs" || k.startsWith("app_error_logs:"));
    if (logSources.length > 0) {
      const logIds: string[] = [];
      for (const src of logSources) {
        logIds.push(...(sourceMap.get(src) || []));
        sourceMap.delete(src);
      }

      if (logIds.length > 0) {
        console.log(`[MANAGEMENT-STATS] [${project}] Resolving ${logIds.length} app_error_logs to uploads...`);
        const { data: logs, error: logErr } = await projectClient
          .from("app_error_logs")
          .select("id, component, context")
          .in("id", logIds);

        if (logErr) {
          console.error(`[MANAGEMENT-STATS] [${project}] Failed to fetch app_error_logs:`, logErr.message);
          errors.push(`[${project}] app_error_logs fetch: ${logErr.message}`);
        } else {
          for (const log of logs || []) {
            let ctx = log.context;
            if (typeof ctx === "string") {
              try {
                ctx = JSON.parse(ctx);
              } catch (_) {
                ctx = null;
              }
            }
            const uploadId = ctx?.upload_id || ctx?.job_id;
            if (!uploadId) {
              errors.push(`[${project}] Log ${log.id} has no upload_id or job_id in context`);
              continue;
            }

            let uploadTable = "";
            if (log.component === "report_pipeline") {
              uploadTable = "report_uploads";
            } else if (log.component === "invoice_pipeline") {
              uploadTable = "invoice_uploads";
            } else if (log.component === "transaction_pipeline") {
              uploadTable = "transaction_uploads";
            } else {
              errors.push(`[${project}] Log ${log.id} component ${log.component} not mapable to upload table`);
              continue;
            }

            if (!sourceMap.has(uploadTable)) {
              sourceMap.set(uploadTable, []);
            }
            sourceMap.get(uploadTable)!.push(uploadId);
            console.log(`[MANAGEMENT-STATS] [${project}] Resolved log ${log.id} to ${uploadTable}/${uploadId}`);
          }
        }
      }
    }

    for (const [rawSource, ids] of sourceMap) {
      const source = rawSource.includes(':') ? rawSource.split(':')[0] : rawSource;
      const queueName = effectiveQueue || QUEUE_MAP[source];
      if (!queueName) {
        errors.push(`[${project}] Retry not supported for ${rawSource}`);
        continue;
      }

      const selectCols = RETRY_SELECT[source] || "id";
      const { data: rows, error: fetchErr } = await projectClient
        .from(source)
        .select(selectCols)
        .in("id", ids);

      if (fetchErr) {
        errors.push(`[${project}] ${source} fetch: ${fetchErr.message}`);
        continue;
      }

      if (!rows || rows.length === 0) {
        errors.push(`[${project}] ${source}: no rows found`);
        continue;
      }

      for (const rawRow of rows) {
        let row = rawRow;
        let activeSource = source;
        const targetTable = QUEUE_TABLE_MAP[queueName];
        let isCrossPipeline = false;

        if (targetTable && targetTable !== source) {
          isCrossPipeline = true;
          try {
            const migrated = await migrateRowToTable(projectClient, source, targetTable, row.id);
            row = migrated;
            activeSource = targetTable;
            console.log(`[MANAGEMENT-STATS] [${project}] Migrated row ${row.id} from ${source} to ${targetTable} (trigger will enqueue automatically)`);
          } catch (migrateErr: any) {
            console.error(`[MANAGEMENT-STATS] [${project}] Migration failed for ${row.id}:`, migrateErr.message);
            errors.push(`[${project}] ${row.id}: migration failed — ${migrateErr.message}`);
            continue;
          }
        } else {
          const statusField = activeSource === "nav_sync_logs" ? "status" : "processing_status";
          const updatePayload: Record<string, unknown> = {
            [statusField]: "pending",
            error_message: null,
          };
          if (body.targetCategory !== undefined && body.targetCategory !== null && activeSource === "invoice_uploads") {
            updatePayload.document_category = body.targetCategory;
          }
          const { error: updateErr } = await projectClient
            .from(activeSource)
            .update(updatePayload as any)
            .eq("id", row.id);

          if (updateErr) {
            errors.push(`[${project}] ${activeSource}/${row.id} update: ${updateErr.message}`);
            continue;
          }
          if (body.targetCategory !== undefined && body.targetCategory !== null && activeSource === "invoice_uploads") {
            row.document_category = body.targetCategory;
          }
        }

        if (isCrossPipeline) {
          totalRetried++;
        } else {
          const payload = buildQueuePayload(activeSource, row);
          const { error: rpcErr } = await projectClient.rpc("pgmq_send_retry", {
            queue_name: queueName,
            msg: payload,
          });

          if (rpcErr) {
            console.error(`[MANAGEMENT-STATS] [${project}] pgmq_send_retry failed for ${activeSource}/${row.id}:`, rpcErr.message);
            errors.push(`[${project}] ${activeSource}/${row.id}: queue send failed — ${rpcErr.message}`);
          } else {
            totalRetried++;
          }
        }
      }
    }
  }

  return {
    retried: totalRetried,
    error: errors.length > 0 ? errors.join("; ") : null,
  };
}
