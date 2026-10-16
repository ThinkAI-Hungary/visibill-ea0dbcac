export interface CompanyLocation {
  id: string;
  company_id: string;
  name: string;
  address: string;
  location_type: 'headquarters' | 'branch';
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface CompanySubLocation {
  id: string;
  company_id: string;
  location_id: string;
  parent_id: string | null;
  name: string;
  code: string | null;
  description: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  children?: CompanySubLocation[];
  parent?: { id: string; name: string; code?: string | null };
  location?: CompanyLocation;
}

export interface AssetCustodian {
  id: string;
  first_name: string;
  last_name: string;
  full_name?: string;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  employee_number?: string | null;
}

export const ASSET_GROUP_LABELS: Record<string, string> = {
  machines: 'Műszaki berendezések, gépek',
  equipment: 'Egyéb berendezések, felszerelések',
  vehicles: 'Járművek',
  real_estate: 'Ingatlanok',
  rights: 'Vagyoni értékű jogok',
  investments: 'Beruházások, felújítások',
};

export function formatCustodianName(custodian?: AssetCustodian | { first_name: string; last_name: string; full_name?: string } | null): string {
  if (!custodian) return '';
  if (custodian.full_name) return custodian.full_name;
  return `${custodian.last_name || ''} ${custodian.first_name || ''}`.trim();
}

export interface AssetCostCenter {
  id: string;
  code: string;
  name: string;
  responsible?: string | null;
}

export interface TaoTemplate {
  id: string;
  name: string;
  tao_rate_percent: number;
  category_code: string | null;
  created_at: string;
}

export interface AssetProject {
  id: string;
  name: string;
  project_code: string | null;
  color: string | null;
  icon: string | null;
}

export interface DevelopmentReserve {
  id: string;
  company_id: string;
  user_id: string | null;
  creation_year: number;
  reserve_amount: number;
  expiration_date: string;
  description: string | null;
  gl_account_id: string | null;
  created_at: string;
  updated_at: string;
  // Computed / joined fields
  utilized_amount?: number;
  remaining_amount?: number;
  status?: 'active' | 'exhausted' | 'expired';
}

export type DisposalStatus = 'none' | 'pending_approval' | 'approved' | 'rejected';

export type DisposalReasonType = 'sale' | 'scrapping' | 'inventory_shortage' | 'donation';

/** Selejtezési bizottság (fixed_assets.disposal_committee). */
export interface DisposalCommittee {
  chair: string;
  members: string[];
}

/** Hulladékkezelési adatok (fixed_assets.disposal_waste_info). */
export interface DisposalWasteInfo {
  hazardous: boolean;
  handler?: string;
  waste_code?: string;
  handover_date?: string;
}

/** Jogcím-specifikus kivezetési adatok (fixed_assets.disposal_details). */
export interface DisposalDetails {
  technical_reason?: string;
  /** Értékesítés: nettó eladási ár (Ft). */
  sale_value?: number;
  buyer_name?: string;
  /** Értékesítés: az eladási bevétel (T 311/384 → K 961) a kivezetési tételben könyvelődjön-e. */
  book_sale_revenue?: boolean;
  /** Értékesítés: ellenszámla (vevők 311 vagy bank 384). */
  sale_counter?: 'customer' | 'bank';
  /** Leltárhiány: felelős dolgozó és követelt kártérítés. */
  liable_employee_id?: string;
  liable_employee_name?: string;
  compensation_amount?: number;
  /** Térítés nélküli átadás: átvevő. */
  recipient_name?: string;
  notes?: string;
  /** A kérelemkor megadott tervezett kivezetési dátum és indoklás (request_asset_disposal). */
  requested_disposal_date?: string;
  reason?: string;
  requested_by?: string;
  requested_at?: string;
  /** Jóváhagyás (approve_asset_disposal) és elutasítás (reject_asset_disposal) nyoma. */
  approved_by?: string;
  approved_at?: string;
  document_id?: string;
  journal_number?: number;
  rejected_by?: string;
  rejected_at?: string;
  rejection_reason?: string;
}

export interface FixedAsset {
  id: string;
  company_id: string;
  user_id: string;
  inventory_number: string;
  name: string;
  description: string | null;
  vtsz_teszor: string | null;
  acquisition_value: number;
  residual_value: number;
  currency: string;
  purchase_date: string;
  activation_date: string;
  disposal_date: string | null;
  useful_life_months: number;
  depreciation_method: string;
  performance_unit: string | null;
  total_planned_performance: number | null;
  depreciation_schedule: number[] | null;
  tao_template_id: string | null;
  tao_rate_override: number | null;
  location_id: string | null;
  sub_location_id?: string | null;
  custodian_id?: string | null;
  cost_center_id?: string | null;
  project_id: string | null;
  activated_by_user_id: string | null;
  activated_by_name: string | null;
  gl_account_id: string | null;
  development_reserve_id: string | null;
  development_reserve_amount: number;
  source_invoice_id: string | null;
  source_invoice_type: 'submitted' | 'nav' | null;
  source_invoice_number: string | null;
  supplier_name: string | null;
  status: 'active' | 'disposed' | 'sold' | 'missing';
  disposal_status: DisposalStatus;
  disposal_reason_type: DisposalReasonType | null;
  disposal_committee: DisposalCommittee | null;
  disposal_waste_info: DisposalWasteInfo | null;
  disposal_details: DisposalDetails | null;
  disposal_journal_entry_id: string | null;
  documents: Array<{ name: string; url: string; type: string }>;
  created_at: string;
  updated_at: string;
  grant_project_id?: string | null;
  // Kiterjesztett törzsadatok (Phase 4)
  tax_depreciation_base?: number | null;
  grant_depreciation_base?: number | null;
  grant_depreciation_rate?: number | null;
  grant_depreciation_method?: string | null;
  opening_accumulated_depreciation?: number | null;
  opening_tax_depreciation?: number | null;
  last_depreciation_date?: string | null;
  depreciation_rate_percent?: number | null;
  property_registry_number?: string | null;
  license_plate?: string | null;
  vin_chassis_number?: string | null;
  // Beruházási adókedvezmény és 4 éves védelem (Phase 5)
  has_tax_credit?: boolean;
  tax_credit_type?: 'KKV_BERUHAZAS' | 'FEJLESZTESI_ADOKEDVEZMENY' | 'ENERGIAHATEKONYSAGI' | string | null;
  tax_credit_retention_until?: string | null;
  // Joined fields
  location?: CompanyLocation;
  sub_location?: CompanySubLocation;
  custodian?: AssetCustodian;
  cost_center?: AssetCostCenter;
  project?: AssetProject;
  grant_project?: GrantProject;
  components?: FixedAssetComponent[];
  tao_template?: TaoTemplate;
  gl_account?: { id: string; gl_number: string; short_name: string };
  development_reserve?: DevelopmentReserve;
  reserve_allocations?: FixedAssetReserveAllocation[];
  // Computed / Analytical fields
  acquisition_date?: string;
  gross_value?: number;
  accumulated_depreciation?: number;
  net_book_value?: number;
  annual_depreciation_rate?: number;
  asset_group?: string;
}

export interface FixedAssetReserveAllocation {
  id: string;
  company_id: string;
  asset_id: string;
  reserve_id: string;
  allocated_amount: number;
  created_at: string;
  reserve?: DevelopmentReserve;
}

export type AssetEventType =
  | 'activation'
  | 'transfer'
  | 'project_transfer'
  | 'reactivation'
  | 'disposal'
  | 'disposal_requested'
  | 'disposal_approved'
  | 'disposal_rejected'
  | 'inventory_check'
  | 'value_change'
  | 'document_upload'
  | 'performance_log'
  | 'unplanned_depreciation'
  | 'unplanned_depreciation_reversal'
  | 'contribution_in_kind'
  | 'free_transfer_out'
  | 'free_transfer_in';

export interface AssetEvent {
  id: string;
  asset_id: string;
  company_id: string;
  user_id: string;
  event_type: AssetEventType;
  event_date: string;
  description: string | null;
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  created_at: string;
}

export interface DepreciationResult {
  accounting: {
    monthly: number;
    accumulated: number;
    bookValue: number;
    ratePercent: number;
  };
  tax: {
    monthly: number;
    accumulated: number;
    bookValue: number;
    ratePercent: number;
    taxBase?: number;
    developmentReserveDeduction?: number;
  };
  grant?: {
    monthly: number;
    accumulated: number;
    bookValue: number;
    ratePercent: number;
    grantBase: number;
  };
}

export type AssetStatus = FixedAsset['status'];

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  active: 'Aktív',
  disposed: 'Selejtezve',
  sold: 'Értékesítve',
  missing: 'Hiányzik',
};

export const ASSET_STATUS_COLORS: Record<AssetStatus, string> = {
  active: 'bg-success/10 text-success',
  disposed: 'bg-destructive/10 text-destructive',
  sold: 'bg-warning/10 text-warning',
  missing: 'bg-muted text-muted-foreground',
};

export const DISPOSAL_STATUS_LABELS: Record<DisposalStatus, string> = {
  none: 'Nincs kivezetés',
  pending_approval: 'Jóváhagyásra vár',
  approved: 'Jóváhagyva',
  rejected: 'Elutasítva',
};

export const DISPOSAL_REASON_LABELS: Record<DisposalReasonType, string> = {
  sale: 'Értékesítés',
  scrapping: 'Selejtezés',
  inventory_shortage: 'Leltárhiány',
  donation: 'Térítés nélküli átadás',
};

// =============================================================================
// Phase 3: Pályázati projektek és alkatrész-komponensek
// =============================================================================

export type GrantProjectStatus = 'active' | 'completed' | 'audit_in_progress' | 'closed';

export const GRANT_PROJECT_STATUS_LABELS: Record<GrantProjectStatus, string> = {
  active: 'Aktív projekt',
  completed: 'Megvalósult',
  audit_in_progress: 'Audit / Ellenőrzés alatt',
  closed: 'Lezárt',
};

export const GRANT_PROJECT_STATUS_COLORS: Record<GrantProjectStatus, string> = {
  active: 'bg-primary/10 text-primary border-primary/20',
  completed: 'bg-success/10 text-success border-success/20',
  audit_in_progress: 'bg-warning/10 text-warning border-warning/20',
  closed: 'bg-muted text-muted-foreground border-muted-foreground/20',
};

export interface GrantProject {
  id: string;
  company_id: string;
  name: string;
  code: string;
  grantor: string | null;
  contract_number: string | null;
  eligible_cost: number;
  grant_amount: number;
  intensity_rate: number;
  own_contribution: number;
  advance_amount: number;
  disbursed_amount: number;
  maintenance_period_years: number;
  maintenance_end_date: string | null;
  status: GrantProjectStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Computed / Aggregated in UI
  allocated_asset_grant?: number;
  allocated_asset_count?: number;
  released_deferral_amount?: number;
}

export interface CreateGrantProjectInput {
  company_id: string;
  name: string;
  code: string;
  grantor?: string;
  contract_number?: string;
  eligible_cost?: number;
  grant_amount: number;
  intensity_rate: number;
  own_contribution?: number;
  advance_amount?: number;
  disbursed_amount?: number;
  maintenance_period_years?: number;
  maintenance_end_date?: string;
  status?: GrantProjectStatus;
  notes?: string;
}

export type ComponentType = 'initial' | 'addition' | 'upgrade' | 'replacement';

export const COMPONENT_TYPE_LABELS: Record<ComponentType, string> = {
  initial: 'Alapbeszerzés / Eredeti komponens',
  addition: 'Utólagos kiegészítés',
  upgrade: 'Korszerűsítés / Ráaktiválás',
  replacement: 'Fődarab-csere',
};

export interface FixedAssetComponent {
  id: string;
  company_id: string;
  fixed_asset_id: string;
  name: string;
  component_type: ComponentType;
  activation_date: string;
  gross_value: number;
  grant_project_id: string | null;
  grant_funding_amount: number;
  own_funding_amount: number;
  grant_ratio_percent: number;
  useful_life_months: number | null;
  depreciation_rate: number | null;
  gl_asset_account: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  grant_project?: GrantProject;
}

export interface CreateFixedAssetComponentInput {
  company_id: string;
  fixed_asset_id: string;
  name: string;
  component_type?: ComponentType;
  activation_date: string;
  gross_value: number;
  grant_project_id?: string | null;
  grant_funding_amount?: number;
  own_funding_amount?: number;
  grant_ratio_percent?: number;
  useful_life_months?: number | null;
  depreciation_rate?: number | null;
  gl_asset_account?: string | null;
  notes?: string | null;
}
