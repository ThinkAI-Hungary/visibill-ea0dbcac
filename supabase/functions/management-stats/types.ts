export type CompanyMemberRow = {
  company_id: string;
  user_id: string;
  role: string;
  created_at: string;
};

export type ProfileRow = {
  id: string;
  user_id: string;
  name: string | null;
  role: string;
};

export type CompanyRow = {
  id: string;
  name: string;
  tax_number: string | null;
  created_at: string;
};

export type ProjectClient = {
  name: string;
  client: any;
};

export const emptyOverview = {
  usersCount: 0,
  companiesCount: 0,
  companies: [],
  users: [],
  llmOverview: {
    totalMonthlyCostUsd: 0,
    totalMonthlyInputTokens: 0,
    totalMonthlyOutputTokens: 0,
    mostExpensiveCompany: null,
  },
};

export const emptyCompanyDetail = {
  invoiceCount: 0,
  submittedInvoiceCount: 0,
  navInvoiceCount: 0,
  members: [],
  lastActivity: null,
  llmCosts: {
    totalCostUsd: 0,
    totalTokens: 0,
    callCount: 0,
    totalRows: 0,
    details: [],
  },
};

export const emptyUserDetail = {
  companyCount: 0,
  companies: [],
};

export const emptyErrors = {
  totalErrors: 0,
  last24hErrors: 0,
  mostAffectedCompany: null,
  topErrorCategory: null,
  totalRows: 0,
  errors: [],
};

export const emptyFiles = {
  totalRows: 0,
  files: [],
  stats: {
    totalCount: 0,
    successCount: 0,
    errorCount: 0,
    pendingCount: 0,
  },
};

export const emptyWorkerStatus = {
  containers: [],
  queues: [],
  pipelines: [],
  recent_jobs: [],
  summary: {
    healthy_containers: 0,
    total_containers: 0,
    total_queue_pending: 0,
    total_jobs_24h: 0,
    total_cost_24h: 0,
    total_errors_24h: 0,
  },
};

export const emptyLLMCosts = {
  kpi: { total_cost: 0, total_jobs: 0, avg_cost_per_job: 0, total_tokens: 0 },
  by_pipeline: [],
  by_project: [],
  top_companies: [],
  daily_trend: [],
  by_model: [],
};

export function emptyForAction(action: string) {
  if (action === "company-detail") return emptyCompanyDetail;
  if (action === "user-detail") return emptyUserDetail;
  if (action === "errors") return emptyErrors;
  if (action === "files") return emptyFiles;
  if (action === "worker-status") return emptyWorkerStatus;
  if (action === "llm-costs") return emptyLLMCosts;
  return emptyOverview;
}
