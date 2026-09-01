import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getProjectClients } from "../utils/multiProject.ts";

export async function buildLLMCosts(admin: ReturnType<typeof createClient>, period: string) {
  console.log(`[buildLLMCosts] ENTRY period=${period} ts=${new Date().toISOString()}`);
  const now = new Date();
  const periodMs: Record<string, number> = {
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
    "90d": 90 * 24 * 60 * 60 * 1000,
  };
  const ms = periodMs[period];
  const since = ms ? new Date(now.getTime() - ms).toISOString() : null;
  const sinceTs = since ? since : null;

  const projectClients = getProjectClients(admin);

  // Use SECURITY DEFINER RPC for each project — bypasses both RLS AND PostgREST max_rows limit.
  const fetches = projectClients.map(async (pc) => {
    try {
      const rpcCall = sinceTs
        ? pc.client.rpc('get_llm_cost_full_agg', { since_date: sinceTs })
        : pc.client.rpc('get_llm_cost_full_agg');
      const { data: rpcRaw, error } = await rpcCall;
      if (error) {
        console.warn(`[buildLLMCosts] ${pc.name} RPC error: code=${error.code} msg=${error.message} detail=${error.details}`);
        throw error;
      }
      const agg = Array.isArray(rpcRaw) ? (rpcRaw[0] || {}) : (rpcRaw || {});
      console.log(`[buildLLMCosts] ${pc.name}: raw_type=${Array.isArray(rpcRaw)?'array':'obj'} total_cost=${agg?.total_cost} total_jobs=${agg?.total_jobs} sinceTs=${sinceTs}`);
      return { project: pc.name, agg, client: pc.client };
    } catch (e: any) {
      console.warn(`[llm-costs] RPC exception for ${pc.name}: ${e?.message || String(e)}`);
      return { project: pc.name, agg: {}, client: pc.client };
    }
  });

  const results = await Promise.all(fetches);

  let totalCost = 0, totalJobs = 0, totalInputTokens = 0, totalOutputTokens = 0;
  const pipelineAgg = new Map<string, { cost: number; jobs: number }>();
  const projectAgg = new Map<string, { cost: number; jobs: number }>();
  const companyAgg = new Map<string, { name: string; cost: number; jobs: number; project: string }>();
  const modelAgg = new Map<string, { cost: number; jobs: number; tokens: number }>();
  const dailyAgg = new Map<string, number>();

  const allCompanyIds = new Set<string>();
  for (const { agg } of results) {
    for (const tc of (agg.top_companies || [])) {
      if (tc.company_id) allCompanyIds.add(tc.company_id);
    }
  }

  const companyNameMap = new Map<string, string>();
  if (allCompanyIds.size > 0) {
    try {
      const { data: companies } = await admin
        .from("companies").select("id, name").in("id", [...allCompanyIds]);
      for (const c of (companies || [])) companyNameMap.set(c.id, c.name);
    } catch {}
  }

  for (const { project, agg } of results) {
    const pc_cost = Number(agg.total_cost || 0);
    const pc_jobs = Number(agg.total_jobs || 0);
    const pc_input = Number(agg.total_input_tokens || 0);
    const pc_output = Number(agg.total_output_tokens || 0);

    totalCost += pc_cost;
    totalJobs += pc_jobs;
    totalInputTokens += pc_input;
    totalOutputTokens += pc_output;

    projectAgg.set(project, { cost: pc_cost, jobs: pc_jobs });

    for (const [pipeline, pd] of Object.entries(agg.by_pipeline || {})) {
      const existing = pipelineAgg.get(pipeline) || { cost: 0, jobs: 0 };
      pipelineAgg.set(pipeline, { cost: existing.cost + Number((pd as any).cost || 0), jobs: existing.jobs + Number((pd as any).jobs || 0) });
    }

    for (const [model, md] of Object.entries(agg.by_model || {})) {
      const existing = modelAgg.get(model) || { cost: 0, jobs: 0, tokens: 0 };
      modelAgg.set(model, { cost: existing.cost + Number((md as any).cost || 0), jobs: existing.jobs + Number((md as any).jobs || 0), tokens: existing.tokens + Number((md as any).tokens || 0) });
    }

    for (const tc of (agg.top_companies || [])) {
      if (!tc.company_id) continue;
      const cKey = `${project}:${tc.company_id}`;
      const name = tc.company_name || companyNameMap.get(tc.company_id) || tc.company_id.substring(0, 8);
      const existing = companyAgg.get(cKey) || { name, cost: 0, jobs: 0, project };
      companyAgg.set(cKey, { name, cost: existing.cost + Number(tc.cost || 0), jobs: existing.jobs + Number(tc.jobs || 0), project });
    }

    for (const dd of (agg.daily_trend || [])) {
      const dk = dd.day;
      dailyAgg.set(dk, (dailyAgg.get(dk) || 0) + Number(dd.cost || 0));
    }
  }

  const by_pipeline = Array.from(pipelineAgg.entries())
    .map(([pipeline, d]) => ({
      pipeline,
      cost: Math.round(d.cost * 10000) / 10000,
      jobs: d.jobs,
      pct: totalCost > 0 ? Math.round((d.cost / totalCost) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.cost - a.cost);

  const by_project = Array.from(projectAgg.entries())
    .map(([project, d]) => ({
      project,
      cost: Math.round(d.cost * 10000) / 10000,
      jobs: d.jobs,
      pct: totalCost > 0 ? Math.round((d.cost / totalCost) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.cost - a.cost);

  const top_companies = Array.from(companyAgg.values())
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 3)
    .map((c) => ({
      name: c.name,
      project: c.project,
      cost: Math.round(c.cost * 10000) / 10000,
      jobs: c.jobs,
    }));

  const dayCount = ms ? Math.min(Math.ceil(ms / (24 * 60 * 60 * 1000)), 90) : 30;
  const daily_trend: { date: string; cost: number }[] = [];
  for (let i = dayCount - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dk = d.toISOString().substring(0, 10);
    daily_trend.push({ date: dk, cost: Math.round((dailyAgg.get(dk) || 0) * 10000) / 10000 });
  }

  const by_model = Array.from(modelAgg.entries())
    .map(([model, d]) => ({
      model,
      cost: Math.round(d.cost * 10000) / 10000,
      jobs: d.jobs,
      avg_tokens: d.jobs > 0 ? Math.round(d.tokens / d.jobs) : 0,
      pct: totalCost > 0 ? Math.round((d.cost / totalCost) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.cost - a.cost);

  console.log(`[buildLLMCosts] DONE period=${period}: totalCost=${totalCost.toFixed(4)}, totalJobs=${totalJobs}`);

  return {
    kpi: {
      total_cost: Math.round(totalCost * 10000) / 10000,
      total_jobs: totalJobs,
      avg_cost_per_job: totalJobs > 0 ? Math.round((totalCost / totalJobs) * 10000) / 10000 : 0,
      total_tokens: totalInputTokens + totalOutputTokens,
      total_input_tokens: totalInputTokens,
      total_output_tokens: totalOutputTokens,
    },
    by_pipeline,
    by_project,
    top_companies,
    daily_trend,
    by_model,
    period,
  };
}
