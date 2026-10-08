export type GlAccountType = 'group' | 'detail';
export type SubledgerType = 'none' | 'partner' | 'detail';

export interface GlAccountRecord {
  id: string;
  preset_id: string;
  company_id: string | null;
  gl_number: string;
  short_name: string;
  description: string | null;
  parent_id: string | null;
  currency: string | null;
  is_multicurrency: boolean;
  subledger_type: SubledgerType;
  is_open_item_managed: boolean;
  account_type: GlAccountType;
  created_at?: string | null;
  updated_at?: string | null;
}
