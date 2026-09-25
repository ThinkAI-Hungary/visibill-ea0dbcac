export type AccountingPolicyStatus = 'uploaded' | 'processing' | 'processed' | 'error' | 'archived';

export interface CompanyAccountingPolicy {
  id: string;
  company_id: string;
  version: number;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  status: AccountingPolicyStatus;
  extracted_summary?: string | null;
  error_message?: string | null;
  uploaded_by?: string | null;
  effective_from?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type AccountingRuleCategory = 'fixed_assets' | 'petty_cash' | 'currency' | 'inventory_gl';

export type AccountingRuleStatus = 'draft' | 'active' | 'inactive' | 'archived';

export interface CompanyAccountingRule {
  id: string;
  company_id: string;
  policy_id?: string | null;
  rule_category: AccountingRuleCategory;
  rule_key: string;
  rule_name: string;
  rule_value: Record<string, any>;
  description?: string | null;
  source_quote?: string | null;
  status: AccountingRuleStatus;
  user_overridden: boolean;
  created_at: string;
  updated_at: string;
}

export interface RuleCategoryMeta {
  key: AccountingRuleCategory;
  label: string;
  description: string;
  iconName: string;
}

export const ACCOUNTING_RULE_CATEGORIES: RuleCategoryMeta[] = [
  {
    key: 'fixed_assets',
    label: 'Tárgyi eszközök és Értékcsökkenés',
    description: 'Kisértékű eszközök értékhatára, amortizációs kulcsok és maradványérték',
    iconName: 'Package',
  },
  {
    key: 'petty_cash',
    label: 'Pénzkezelési és Házipénztár szabályzat',
    description: 'Napi záró keretösszeg, egyedi kifizetési limitek és ellenőrzési rend',
    iconName: 'Coins',
  },
  {
    key: 'currency',
    label: 'Devizaértékelés és Árfolyamok',
    description: 'Választott árfolyam forrása (MNB / bank) és év végi átértékelési küszöb',
    iconName: 'Landmark',
  },
  {
    key: 'inventory_gl',
    label: 'Számlakontírozás és Készletértékelés',
    description: 'FIFO / átlagár készletértékelés, költségnemek és fizetési határidők',
    iconName: 'FileSpreadsheet',
  },
];
