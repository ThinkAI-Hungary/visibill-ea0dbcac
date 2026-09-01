import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { isCompletedMessage } from "../utils/common.ts";
import { getProjectClients } from "../utils/multiProject.ts";

export async function getActiveErrors(pc: any, periodSince?: string | null) {
  let invQ = pc.client
    .from("invoice_uploads")
    .select("id, document_category, file_name, company_id, file_url, created_at, updated_at, error_message")
    .or("processing_status.eq.error,and(processing_status.eq.ignored,error_message.not.is.null)");
  if (periodSince) invQ = invQ.gte("updated_at", periodSince);
  const { data: invData } = await invQ;

  let txQ = pc.client
    .from("transaction_uploads")
    .select("id, file_name, company_id, file_url, created_at, updated_at, error_message")
    .eq("processing_status", "error");
  if (periodSince) txQ = txQ.gte("updated_at", periodSince);
  const { data: txData } = await txQ;

  const invRows = invData || [];
  const txRows = txData || [];

  return { activeInv: invRows, activeTx: txRows };
}

export async function buildWorkerStatus(admin: ReturnType<typeof createClient>, period: string = "all") {
  const HEALTH_THRESHOLD_SECONDS = 120;
  const now = new Date();
  const periodMs: Record<string, number> = {
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
    "90d": 90 * 24 * 60 * 60 * 1000,
  };
  const ms = periodMs[period];
  const periodSince = ms ? new Date(now.getTime() - ms).toISOString() : null;

  const dayKeys: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    dayKeys.push(d.toISOString().substring(0, 10));
  }

  const projectClients = getProjectClients(admin);

  // 1. Container heartbeats (always from PROD)
  const { data: heartbeats } = await admin
    .from("worker_heartbeats")
    .select("*")
    .gt("last_heartbeat", new Date(now.getTime() - 3 * 60 * 1000).toISOString())
    .order("container_name");

  const activeContainers = (heartbeats || []).map((h: any) => {
    const lastBeat = new Date(h.last_heartbeat);
    const startedAt = new Date(h.started_at);
    const ageSec = (now.getTime() - lastBeat.getTime()) / 1000;
    return {
      container_name: h.container_name,
      host_ip: h.host_ip,
      supabase_project: h.supabase_project,
      started_at: h.started_at,
      last_heartbeat: h.last_heartbeat,
      is_healthy: ageSec < HEALTH_THRESHOLD_SECONDS,
      uptime_seconds: Math.floor((now.getTime() - startedAt.getTime()) / 1000),
      version: h.version,
      active_queues: h.active_queues || [],
      cpu_usage: h.cpu_usage ?? 0,
      ram_usage: h.ram_usage ?? 0,
      jobs_24h: 0,
      avg_duration_ms: 0,
      total_cost_24h: 0,
    };
  });

  const expectedReplicas: Record<string, { count: number, project: string }> = {
    "worker-prod": { count: 4, project: "PROD" },
    "worker-vsweb": { count: 1, project: "VSWEB" },
    "worker-thinkerman": { count: 1, project: "THINKERMAN" },
  };

  const containers = [...activeContainers];

  for (const [baseName, spec] of Object.entries(expectedReplicas)) {
    const activeForService = activeContainers.filter(c => 
      c.container_name === baseName || c.container_name.startsWith(`${baseName}-`)
    );
    
    const missingCount = spec.count - activeForService.length;
    if (missingCount > 0) {
      for (let i = 0; i < missingCount; i++) {
        containers.push({
          container_name: `${baseName}-offline-${i + 1}`,
          host_ip: "unknown",
          supabase_project: spec.project,
          started_at: new Date().toISOString(),
          last_heartbeat: new Date(0).toISOString(),
          is_healthy: false,
          uptime_seconds: 0,
          version: "offline",
          active_queues: [],
          cpu_usage: 0,
          ram_usage: 0,
          jobs_24h: 0,
          avg_duration_ms: 0,
          total_cost_24h: 0,
        });
      }
    }
  }

  // 2. PGMQ queue metrics
  const queues: any[] = [];
  for (const pc of projectClients) {
    try {
      const { data: queueMetrics } = await pc.client.rpc("pgmq_metrics_all");
      for (const q of (queueMetrics || [])) {
        const queueEntry: any = {
          queue_name: `${pc.name}:${q.queue_name}`,
          queue_length: q.queue_length ?? 0,
          total_messages: q.total_messages ?? 0,
          newest_msg_age_sec: q.newest_msg_age_sec,
          oldest_msg_age_sec: q.oldest_msg_age_sec,
          project: pc.name,
          pending_items: [],
        };

        if ((q.queue_length ?? 0) > 0) {
          try {
            const { data: items } = await pc.client.rpc("peek_queue_items", {
              queue_name: q.queue_name,
              max_items: 20,
            });
            queueEntry.pending_items = (items || []).map((item: any) => ({
              msg_id: item.msg_id,
              enqueued_at: item.enqueued_at,
              read_ct: item.read_ct,
              file_name: item.file_name,
              company_name: item.company_name,
              source: item.source || 'upload',
              document_category: item.document_category || 'unknown',
            }));
          } catch (peekErr) {
            console.warn(`[worker-status] peek failed for ${pc.name}:${q.queue_name}:`, peekErr);
          }
        }

        queues.push(queueEntry);
      }
    } catch (e) {
      console.warn(`[worker-status] pgmq_metrics_all failed for ${pc.name}:`, e);
    }
  }

  // 3. LLM pipeline stats via SQL aggregation
  const pipelineMap = new Map<string, {
    jobs: number;
    totalDuration: number;
    totalCost: number;
  }>();
  const workerMap = new Map<string, { jobs: number; totalDuration: number; totalCost: number }>();

  const llmFetches = projectClients.map(async (pc) => {
    try {
      const { data } = await pc.client.rpc("worker_pipeline_stats", {
        since_ts: periodSince || undefined,
      });
      return { project: pc.name, rows: data || [] };
    } catch (e) {
      console.warn(`[worker-status] worker_pipeline_stats RPC failed for ${pc.name}:`, e);
      return { project: pc.name, rows: [] };
    }
  });
  const llmResults = await Promise.all(llmFetches);

  for (const { project, rows } of llmResults) {
    for (const row of rows) {
      const p = row.pipeline || "unknown";
      const wid = row.worker_id || `worker-${project.toLowerCase()}`;
      const pipeKey = `${project}:${p}`;

      if (!pipelineMap.has(pipeKey)) {
        pipelineMap.set(pipeKey, { jobs: 0, totalDuration: 0, totalCost: 0 });
      }
      const pm = pipelineMap.get(pipeKey)!;
      pm.jobs += Number(row.jobs) || 0;
      pm.totalDuration += Number(row.total_duration_ms) || 0;
      pm.totalCost += parseFloat(row.total_cost) || 0;

      if (!workerMap.has(wid)) {
        workerMap.set(wid, { jobs: 0, totalDuration: 0, totalCost: 0 });
      }
      const wm = workerMap.get(wid)!;
      wm.jobs += Number(row.jobs) || 0;
      wm.totalDuration += Number(row.total_duration_ms) || 0;
      wm.totalCost += parseFloat(row.total_cost) || 0;
    }
  }

  for (const c of containers) {
    const wStats = workerMap.get(c.container_name);
    if (wStats) {
      c.jobs_24h = wStats.jobs;
      c.avg_duration_ms = wStats.jobs > 0 ? Math.round(wStats.totalDuration / wStats.jobs) : 0;
      c.total_cost_24h = Math.round(wStats.totalCost * 100) / 100;
    }
  }

  // 3b. Daily counts for sparkline (last 7 days)
  const weeklyFetches = projectClients.map(async (pc) => {
    try {
      const { data } = await pc.client.rpc("worker_daily_counts", { days_back: 7 });
      return { project: pc.name, rows: data || [] };
    } catch {
      return { project: pc.name, rows: [] };
    }
  });
  const weeklyResults = await Promise.all(weeklyFetches);

  const dailyMap = new Map<string, Map<string, number>>();
  for (const { project, rows } of weeklyResults) {
    for (const row of rows) {
      const pipeKey = `${project}:${row.pipeline || "unknown"}`;
      const dayKey = String(row.day_key).substring(0, 10);
      if (!dailyMap.has(pipeKey)) dailyMap.set(pipeKey, new Map());
      const dm = dailyMap.get(pipeKey)!;
      dm.set(dayKey, (dm.get(dayKey) || 0) + Number(row.cnt));
    }
  }

  // 4. Worker error count
  let totalErrors24h = 0;
  const pipelineErrorMap = new Map<string, number>();

  const errorFetches = projectClients.map(async (pc) => {
    try {
      const { activeInv, activeTx } = await getActiveErrors(pc, periodSince);
      
      activeInv.forEach((r: any) => {
        const cat = r.document_category || "invoice";
        pipelineErrorMap.set(cat, (pipelineErrorMap.get(cat) || 0) + 1);
      });
      
      if (activeTx.length > 0) {
        pipelineErrorMap.set("transaction", (pipelineErrorMap.get("transaction") || 0) + activeTx.length);
      }

      return activeInv.length + activeTx.length;
    } catch {
      return 0;
    }
  });
  const errorResults = await Promise.all(errorFetches);
  totalErrors24h = errorResults.reduce((s, c) => s + c, 0);

  const pipelines = Array.from(pipelineMap.entries()).map(([pipeKey, data]) => {
    const [project, ...rest] = pipeKey.split(':');
    const pipeline = rest.join(':');
    return {
      pipeline,
      project,
      jobs_24h: data.jobs,
      avg_duration_ms: data.jobs > 0 ? Math.round(data.totalDuration / data.jobs) : 0,
      total_cost_usd: Math.round(data.totalCost * 1000) / 1000,
      error_count_24h: pipelineErrorMap.get(pipeline) || 0,
      daily_counts: dayKeys.map(dk => (dailyMap.get(pipeKey)?.get(dk)) || 0),
    };
  });
  pipelines.sort((a, b) => b.jobs_24h - a.jobs_24h);

  // 5. Recent jobs
  const recentFetches = projectClients.map(async (pc) => {
    try {
      let recentQuery = pc.client
        .from("llm_koltsegek")
        .select("id, created_at, pipeline, file_name, company_id, model_name, total_tokens, estimated_cost_usd, processing_duration_ms, worker_id, upload_id")
        .order("created_at", { ascending: false })
        .limit(200);
      if (periodSince) recentQuery = recentQuery.gte("created_at", periodSince);
      const { data } = await recentQuery;

      const companyIds = [...new Set((data || []).map((r: any) => r.company_id).filter(Boolean))];
      let companyNameMap = new Map<string, string>();
      if (companyIds.length > 0) {
        const { data: companies } = await pc.client
          .from("companies")
          .select("id, name")
          .in("id", companyIds);
        for (const c of (companies || [])) {
          companyNameMap.set(c.id, c.name);
        }
      }

      const uploadIds = [...new Set((data || []).map((r: any) => r.upload_id).filter(Boolean))];
      const uploadStatusMap = new Map<string, string>();
      const uploadUrlMap = new Map<string, string>();
      const uploadSourceMap = new Map<string, string>();
      const llmDetailsMap = new Map<string, { cost: number; duration: number }>();

      if (uploadIds.length > 0) {
        try {
          const { data: llmCosts } = await pc.client
            .from("llm_koltsegek")
            .select("upload_id, estimated_cost_usd, processing_duration_ms")
            .in("upload_id", uploadIds);
          for (const l of (llmCosts || [])) {
            if (l.upload_id) {
              const current = llmDetailsMap.get(l.upload_id) || { cost: 0, duration: 0 };
              current.cost += parseFloat(l.estimated_cost_usd) || 0;
              if (l.processing_duration_ms) {
                current.duration = Math.max(current.duration, l.processing_duration_ms);
              }
              llmDetailsMap.set(l.upload_id, current);
            }
          }
        } catch {}

        try {
          const { data: invUploads } = await pc.client
            .from("invoice_uploads")
            .select("id, processing_status, error_message, file_url")
            .in("id", uploadIds);
          for (const u of (invUploads || [])) {
            const hasError = u.processing_status === "error" || u.processing_status === "failed" || (!!u.error_message && !isCompletedMessage(u.error_message));
            uploadStatusMap.set(u.id, hasError ? "ERROR" : "OK");
            if (u.file_url) uploadUrlMap.set(u.id, u.file_url);
            uploadSourceMap.set(u.id, "invoice_uploads");
          }
        } catch {}

        try {
          const { data: txUploads } = await pc.client
            .from("transaction_uploads")
            .select("id, processing_status, error_message, file_url")
            .in("id", uploadIds);
          for (const u of (txUploads || [])) {
            const hasError = u.processing_status === "error" || u.processing_status === "failed" || (!!u.error_message && !isCompletedMessage(u.error_message));
            uploadStatusMap.set(u.id, hasError ? "ERROR" : "OK");
            if (u.file_url) uploadUrlMap.set(u.id, u.file_url);
            uploadSourceMap.set(u.id, "transaction_uploads");
          }
        } catch {}

        try {
          const { data: bankUploads } = await pc.client
            .from("bank_statement_uploads")
            .select("id, processing_status, error_message, file_url")
            .in("id", uploadIds);
          for (const u of (bankUploads || [])) {
            const hasError = u.processing_status === "error" || u.processing_status === "failed" || (!!u.error_message && !isCompletedMessage(u.error_message));
            uploadStatusMap.set(u.id, hasError ? "ERROR" : "OK");
            if (u.file_url) uploadUrlMap.set(u.id, u.file_url);
            uploadSourceMap.set(u.id, "bank_statement_uploads");
          }
        } catch {}

        try {
          const { data: reportUploads } = await pc.client
            .from("report_uploads")
            .select("id, processing_status, error_message, file_url")
            .in("id", uploadIds);
          for (const u of (reportUploads || [])) {
            const hasError = u.processing_status === "error" || u.processing_status === "failed" || (!!u.error_message && !isCompletedMessage(u.error_message));
            uploadStatusMap.set(u.id, hasError ? "ERROR" : "OK");
            if (u.file_url) uploadUrlMap.set(u.id, u.file_url);
            uploadSourceMap.set(u.id, "report_uploads");
          }
        } catch {}

        try {
          const { data: glUploads } = await pc.client
            .from("gl_upload_notifications")
            .select("id, processing_status, error_message")
            .in("id", uploadIds);
          for (const u of (glUploads || [])) {
            const hasError = u.processing_status === "error" || u.processing_status === "failed" || (!!u.error_message && !isCompletedMessage(u.error_message));
            uploadStatusMap.set(u.id, hasError ? "ERROR" : "OK");
            uploadSourceMap.set(u.id, "gl_upload_notifications");
          }
        } catch {}

        try {
          const { data: accUploads } = await pc.client
            .from("accounty_uploads")
            .select("id, status, error_message, file_path")
            .in("id", uploadIds);
          for (const u of (accUploads || [])) {
            const hasError = u.status === "error" || u.status === "failed" || (!!u.error_message && !isCompletedMessage(u.error_message));
            uploadStatusMap.set(u.id, hasError ? "ERROR" : "OK");
            if (u.file_path) uploadUrlMap.set(u.id, u.file_path);
            uploadSourceMap.set(u.id, "accounty_uploads");
          }
        } catch {}
      }

      return (data || []).map((r: any) => {
        const llm = r.upload_id ? llmDetailsMap.get(r.upload_id) : null;
        const resolvedSource = r.upload_id ? (uploadSourceMap.get(r.upload_id) || r.pipeline || "upload") : (r.pipeline || "direct");
        return {
          id: r.id,
          created_at: r.created_at,
          pipeline: r.pipeline,
          file_name: r.file_name,
          company_name: companyNameMap.get(r.company_id) || null,
          model_name: r.model_name,
          total_tokens: r.total_tokens || 0,
          estimated_cost_usd: llm ? llm.cost : (parseFloat(r.estimated_cost_usd) || 0),
          processing_duration_ms: llm ? llm.duration : (r.processing_duration_ms || 0),
          worker_id: r.worker_id || `worker-${pc.name.toLowerCase()}`,
          project: pc.name,
          upload_id: r.upload_id || null,
          status: r.upload_id ? (uploadStatusMap.get(r.upload_id) || "OK") : "OK",
          file_url: r.upload_id ? (uploadUrlMap.get(r.upload_id) || null) : null,
          source: resolvedSource,
        };
      });
    } catch {
      return [];
    }
  });
  const recentResults = await Promise.all(recentFetches);
  const raw_recent_jobs = recentResults
    .map(projectJobs => 
      projectJobs
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 100)
    )
    .flat()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const seenUploadIds = new Set<string>();
  const recent_jobs: any[] = [];
  for (const job of raw_recent_jobs) {
    if (job.upload_id) {
      if (seenUploadIds.has(job.upload_id)) {
        continue;
      }
      seenUploadIds.add(job.upload_id);
    }
    recent_jobs.push(job);
  }

  // Error uploads
  const errorJobsFetches = projectClients.map(async (pc) => {
    const results: any[] = [];

    try {
      const { activeInv, activeTx } = await getActiveErrors(pc, periodSince);

      for (const r of activeInv.slice(0, 100)) {
        results.push({
          id: r.id,
          upload_id: r.id,
          created_at: r.created_at,
          updated_at: r.updated_at,
          file_name: r.file_name,
          company_id: r.company_id,
          pipeline: r.document_category || "invoice",
          file_url: r.file_url,
          error_message: r.error_message,
          source: "invoice_uploads",
          project: pc.name,
          status: "ERROR",
        });
      }

      for (const r of activeTx.slice(0, 100)) {
        results.push({
          id: r.id,
          upload_id: r.id,
          created_at: r.created_at,
          updated_at: r.updated_at,
          file_name: r.file_name,
          company_id: r.company_id,
          pipeline: "transaction",
          file_url: r.file_url,
          error_message: r.error_message,
          source: "transaction_uploads",
          project: pc.name,
          status: "ERROR",
        });
      }
    } catch {}

    const companyIds = [...new Set(results.map((r: any) => r.company_id).filter(Boolean))];
    const companyNameMap = new Map<string, string>();
    if (companyIds.length > 0) {
      try {
        const { data: companies } = await pc.client
          .from("companies")
          .select("id, name")
          .in("id", companyIds);
        for (const c of (companies || [])) {
          companyNameMap.set(c.id, c.name);
        }
      } catch {}
    }

    const uploadIds = results.map(r => r.upload_id);
    const llmDetailsMap = new Map<string, { cost: number; worker_id: string; duration: number }>();
    if (uploadIds.length > 0) {
      try {
        const { data: llmCosts } = await pc.client
          .from("llm_koltsegek")
          .select("upload_id, estimated_cost_usd, worker_id, processing_duration_ms")
          .in("upload_id", uploadIds);
        for (const l of (llmCosts || [])) {
          if (l.upload_id) {
            const current = llmDetailsMap.get(l.upload_id) || { cost: 0, worker_id: l.worker_id, duration: 0 };
            current.cost += parseFloat(l.estimated_cost_usd) || 0;
            if (l.processing_duration_ms) {
              current.duration = Math.max(current.duration, l.processing_duration_ms);
            }
            if (l.worker_id) {
              current.worker_id = l.worker_id;
            }
            llmDetailsMap.set(l.upload_id, current);
          }
        }
      } catch {}
    }

    return results.map(r => {
      const llm = llmDetailsMap.get(r.upload_id);
      const fallbackDuration = new Date(r.updated_at).getTime() - new Date(r.created_at).getTime();
      const safeFallback = (fallbackDuration > 0 && fallbackDuration < 300_000) ? fallbackDuration : 0;
      return {
        ...r,
        company_name: companyNameMap.get(r.company_id) || null,
        estimated_cost_usd: llm?.cost || 0,
        worker_id: llm?.worker_id || `worker-${pc.name.toLowerCase()}`,
        processing_duration_ms: llm?.duration || safeFallback,
      };
    });
  });

  const errorJobsResults = await Promise.all(errorJobsFetches);
  const error_jobs = errorJobsResults
    .flat()
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  // Processing items
  const processingFetches = projectClients.map(async (pc) => {
    const results: any[] = [];
    
    try {
      const { data } = await pc.client
        .from("invoice_uploads")
        .select("id, file_name, company_id, processing_status, created_at, updated_at, document_category")
        .eq("processing_status", "processing")
        .order("updated_at", { ascending: false })
        .limit(50);
      for (const r of (data || [])) {
        results.push({ ...r, pipeline_type: "invoice" });
      }
    } catch (e) {
      console.warn(`[worker-status] invoice processing query failed for ${pc.name}:`, e);
    }

    try {
      const { data } = await pc.client
        .from("transaction_uploads")
        .select("id, file_name, company_id, processing_status, created_at, updated_at")
        .eq("processing_status", "processing")
        .order("updated_at", { ascending: false })
        .limit(50);
      for (const r of (data || [])) {
        results.push({
          ...r,
          pipeline_type: "transaction",
          document_category: "bank_statement",
          source: "upload",
        });
      }
    } catch (e) {
      console.warn(`[worker-status] transaction processing query failed for ${pc.name}:`, e);
    }

    try {
      const { data } = await pc.client
        .from("bank_statement_uploads")
        .select("id, file_name, company_id, processing_status, created_at, updated_at")
        .eq("processing_status", "processing")
        .order("updated_at", { ascending: false })
        .limit(50);
      for (const r of (data || [])) {
        results.push({
          ...r,
          pipeline_type: "bank_statement",
          document_category: "bank_statement",
          source: "bank_statement_uploads",
        });
      }
    } catch {}

    try {
      const { data } = await pc.client
        .from("report_uploads")
        .select("id, file_name, company_id, processing_status, created_at, updated_at")
        .eq("processing_status", "processing")
        .order("updated_at", { ascending: false })
        .limit(50);
      for (const r of (data || [])) {
        results.push({
          ...r,
          pipeline_type: "report",
          document_category: "report",
          source: "report_uploads",
        });
      }
    } catch {}

    try {
      const { data } = await pc.client
        .from("gl_upload_notifications")
        .select("id, file_name, company_id, processing_status, created_at, updated_at")
        .eq("processing_status", "processing")
        .order("updated_at", { ascending: false })
        .limit(50);
      for (const r of (data || [])) {
        results.push({
          ...r,
          pipeline_type: "gl_journal",
          document_category: "general_ledger",
          source: "gl_upload_notifications",
        });
      }
    } catch {}

    try {
      const { data } = await pc.client
        .from("accounty_uploads")
        .select("id, file_name, company_id, status, created_at, updated_at")
        .eq("status", "processing")
        .order("updated_at", { ascending: false })
        .limit(50);
      for (const r of (data || [])) {
        results.push({
          ...r,
          pipeline_type: "accounty",
          document_category: "accounty_upload",
          processing_status: r.status,
          source: "accounty_uploads",
        });
      }
    } catch {}

    const companyIds = [...new Set(results.map((r: any) => r.company_id).filter(Boolean))];
    let companyNameMap = new Map<string, string>();
    if (companyIds.length > 0) {
      try {
        const { data: companies } = await pc.client
          .from("companies")
          .select("id, name")
          .in("id", companyIds);
        for (const c of (companies || [])) {
          companyNameMap.set(c.id, c.name);
        }
      } catch {}
    }

    return results.map((r: any) => ({
      id: r.id,
      file_name: r.file_name,
      company_name: companyNameMap.get(r.company_id) || null,
      company_id: r.company_id,
      pipeline_type: r.pipeline_type,
      started_at: r.updated_at,
      created_at: r.created_at,
      document_category: r.document_category || 'unknown',
      source: r.source || 'upload',
      elapsed_sec: Math.floor((now.getTime() - new Date(r.updated_at).getTime()) / 1000),
      project: pc.name,
    }));
  });
  const processingResults = await Promise.all(processingFetches);
  const active_processing = processingResults.flat().sort((a, b) => a.elapsed_sec - b.elapsed_sec);

  // Summary KPIs
  const totalJobs24h = Array.from(pipelineMap.values()).reduce((s, p) => s + p.jobs, 0);
  const totalCost24h = Array.from(pipelineMap.values()).reduce((s, p) => s + p.totalCost, 0);
  const totalQueuePending = queues.reduce((s, q) => s + (q.queue_length || 0), 0);

  return {
    containers,
    queues,
    pipelines,
    recent_jobs,
    error_jobs,
    active_processing,
    summary: {
      healthy_containers: containers.filter((c: any) => c.is_healthy).length,
      total_containers: containers.length,
      total_queue_pending: totalQueuePending,
      total_processing: active_processing.length,
      total_jobs_24h: totalJobs24h,
      total_cost_24h: Math.round(totalCost24h * 100) / 100,
      total_errors_24h: totalErrors24h,
    },
  };
}
