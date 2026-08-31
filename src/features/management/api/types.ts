export interface OverviewData {
  usersCount: number;
  totalErrors?: number;
  mostErrorCompany?: { id: string; name: string; errorCount: number } | null;
  mostErrorUser?: { id: string; name: string; email: string; errorCount: number } | null;
  companiesCount: number;
  companies: Array<{
    id: string;
    name: string;
    tax_number: string | null;
    created_at: string;
    members: Array<{ name: string; role: string }>;
    monthlyCostUsd: number;
    invoiceCount: number;
    navInvoiceCount: number;
    transactionCount: number;
    payrollCount: number;
    hasEaisyBooks: boolean;
  }>;
  users: Array<{
    id: string;
    user_id: string;
    name: string;
    email: string;
    created_at: string;
    companies: Array<{ id: string; name: string; role: string }>;
  }>;
  llmOverview: {
    totalMonthlyCostUsd: number;
    totalMonthlyInputTokens: number;
    totalMonthlyOutputTokens: number;
    mostExpensiveCompany: {
      id: string;
      name: string;
      totalCostUsd: number;
      monthlyCostUsd: number;
      project?: string;
    } | null;
  };
}

export interface CompanyDetail {
  invoiceCount: number;
  submittedInvoiceCount: number;
  navInvoiceCount: number;
  members: Array<{
    user_id: string;
    name: string;
    email: string;
    role: string;
    joined_at: string;
  }>;
  lastActivity: {
    action: string;
    entity: string;
    entity_name: string;
    user_name: string;
    created_at: string;
  } | null;
  llmCosts: {
    totalCostUsd: number;
    totalTokens: number;
    callCount: number;
    totalRows: number;
    details: Array<{
      input_tokens: number;
      output_tokens: number;
      total_tokens: number;
      estimated_cost_usd: number;
      model_name: string;
      created_at: string;
      user_name?: string;
      file_name?: string | null;
    }>;
  };
}

export interface UserDetail {
  companyCount: number;
  companies: Array<{ id: string; name: string; role: string }>;
}

export interface ErrorRow {
  id: string;
  created_at: string;
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
  project?: string;
}

export interface ErrorsData {
  totalErrors: number;
  last24hErrors: number;
  mostAffectedCompany: { id: string; name: string; errorCount: number } | null;
  mostAffectedUser: { id: string; name: string; errorCount: number } | null;
  topErrorCategory: { category: string; label: string; count: number } | null;
  totalRows: number;
  errors: ErrorRow[];
}

export type SuperadminModuleKey =
  // eaisybill
  | 'invoices' | 'nav_invoices' | 'transactions' | 'gl_journal_entries'
  | 'salary' | 'petty_cash_entries' | 'uploads' | 'app_error_logs'
  | 'categories' | 'projects' | 'partners' | 'fixed_assets' | 'shipments' | 'annual_reports'
  // eaisyBooks
  | 'accounty_missing_items' | 'accounty_deadlines' | 'accounty_employees' | 'accounty_payroll_cycles'
  | 'accounty_assignments' | 'accounty_tax_profiles' | 'accounty_filings' | 'accounty_tao_yearly'
  | 'accounty_audit_log' | 'accounty_documents' | 'accounty_templates' | 'accounty_job_codes' | 'accounty_legal_updates';

export interface SuperadminModuleData {
  module: string;
  totalCount: number;
  rows: Record<string, unknown>[];
  page: number;
  pageSize: number;
  error?: string;
}

export type LlmSortCol = 'created_at' | 'input_tokens' | 'output_tokens' | 'estimated_cost_usd';

export interface LlmPageResult {
  llmCosts: {
    totalRows: number;
    details: Array<{
      input_tokens: number;
      output_tokens: number;
      total_tokens: number;
      estimated_cost_usd: number;
      model_name: string;
      created_at: string;
      user_name?: string;
      file_name?: string | null;
    }>;
  };
}

export type ErrorSortCol = 'created_at' | 'source' | 'error_category';

export type ControlCenterTab = 'errors' | 'permissions' | 'files' | 'worker' | 'users';

export interface ControlCenterUser {
  id: string;
  user_id: string;
  name: string;
  email: string;
  created_at: string;
  companies: Array<{ id: string; name: string; role: string }>;
}

export interface FileRow {
  id: string;
  created_at: string;
  updated_at: string | null;
  file_name: string;
  file_size: number | null;
  file_url: string | null;
  file_type: string | null;
  file_type_label?: string;
  mime_type?: string | null;
  status?: string;
  upload_status?: string | null;
  processing_status?: string | null;
  error_message: string | null;
  company_id: string | null;
  company_name: string | null;
  user_id: string | null;
  user_name: string | null;
  user_email?: string | null;
  source_table: string;
  processed_at?: string | null;
  project?: string;
  fallback_from_invoice_upload_id?: string | null;
  fallback_from_transaction_upload_id?: string | null;
}

export interface FilesData {
  totalFiles: number;
  processingFiles: number;
  errorFiles: number;
  doneFiles: number;
  topCompany: { id: string; name: string; fileCount: number } | null;
  totalRows: number;
  files: FileRow[];
}

export type FileSortCol = 'created_at' | 'file_name' | 'file_size' | 'company_name' | 'status' | 'updated_at';

export type StatusCategory = 'success' | 'pending' | 'error' | 'redirected' | 'dismissed' | 'unknown';

export interface UserPermissionsData {
  userId: string;
  permissions: Array<{
    platform: 'eaisybill' | 'eaisybooks';
    entityId: string;
    entityName: string;
    module: string;
    canRead: boolean;
    canWrite: boolean;
    isOverride?: boolean;
  }>;
}

export interface WorkerStatusData {
  containers?: Array<{
    container_name: string;
    worker_id: string;
    status: 'healthy' | 'unhealthy' | 'dead';
    last_heartbeat: string;
    uptime_seconds?: number;
    meta?: Record<string, unknown>;
  }>;
  queues?: Array<{
    queue_name: string;
    depth: number;
    pending_count: number;
    active_count: number;
    dead_letter_count: number;
    latency_ms?: number;
  }>;
  pipelines?: Array<{
    pipeline_name: string;
    total_24h: number;
    success_24h: number;
    failed_24h: number;
    avg_duration_ms: number;
    sparkline_7d: number[];
  }>;
  recent_jobs?: Array<{
    job_id: string;
    pipeline: string;
    status: string;
    created_at: string;
    duration_ms: number;
    error_message?: string | null;
    company_name?: string | null;
  }>;
  error_jobs?: Array<{
    job_id: string;
    pipeline: string;
    error_message: string;
    created_at: string;
    company_name?: string | null;
  }>;
}
