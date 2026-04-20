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

export interface TaoTemplate {
  id: string;
  name: string;
  tao_rate_percent: number;
  category_code: string | null;
  created_at: string;
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
  tao_template_id: string | null;
  tao_rate_override: number | null;
  location_id: string | null;
  activated_by_user_id: string | null;
  activated_by_name: string | null;
  gl_account_id: string | null;
  source_invoice_id: string | null;
  source_invoice_type: 'submitted' | 'nav' | null;
  source_invoice_number: string | null;
  supplier_name: string | null;
  status: 'active' | 'disposed' | 'sold' | 'missing';
  documents: Array<{ name: string; url: string; type: string }>;
  created_at: string;
  updated_at: string;
  // Joined fields
  location?: CompanyLocation;
  tao_template?: TaoTemplate;
  gl_account?: { id: string; gl_number: string; short_name: string };
}

export interface AssetEvent {
  id: string;
  asset_id: string;
  company_id: string;
  user_id: string;
  event_type: 'activation' | 'transfer' | 'reactivation' | 'disposal' | 'inventory_check' | 'value_change' | 'document_upload';
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
