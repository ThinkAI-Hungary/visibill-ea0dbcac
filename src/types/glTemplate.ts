export type GlTemplateField =
  | 'id'
  | 'name'
  | 'balance'
  | 'debitTurnover'
  | 'creditTurnover'
  | 'balanceDebit'
  | 'balanceCredit'
  | 'partner'
  | 'invoiceNumber'
  | 'date'
  | 'custom';

export type GlTemplateFormat = 'text' | 'currency' | 'date' | 'number';

export type GlTemplateAlign = 'left' | 'center' | 'right';

export interface GlTemplateColumn {
  id: string;
  key: string;
  label: string;
  width?: string;
  align: GlTemplateAlign;
  field: GlTemplateField;
  format?: GlTemplateFormat;
  required?: boolean;
}

export interface GlViewTemplate {
  id: string;
  company_id?: string | null;
  accounting_firm_id?: string | null;
  name: string;
  template_type: 'builtin' | 'custom';
  description?: string | null;
  columns: GlTemplateColumn[];
  source_file_name?: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface GlSampleRow {
  id: string;
  name: string;
  balance: number;
  debitTurnover?: number;
  creditTurnover?: number;
  balanceDebit?: number;
  balanceCredit?: number;
  partner?: string | null;
  invoiceNumber?: string | null;
  date?: string | null;
  depth?: number;
  isRoot?: boolean;
}

export const DEFAULT_SAMPLE_ROWS: GlSampleRow[] = [
  {
    id: '1',
    name: '1. BEFEKTETETT ESZKÖZÖK',
    balance: 14500000,
    debitTurnover: 14500000,
    creditTurnover: 0,
    balanceDebit: 14500000,
    balanceCredit: 0,
    depth: 0,
    isRoot: true,
  },
  {
    id: '111',
    name: 'Pénztár',
    balance: 420000,
    debitTurnover: 1250000,
    creditTurnover: 830000,
    balanceDebit: 420000,
    balanceCredit: 0,
    date: '2026-03-31',
    invoiceNumber: 'P-2026/012',
    partner: 'Készpénzes forgalom',
    depth: 1,
    isRoot: false,
  },
  {
    id: '311',
    name: 'Belföldi vevők',
    balance: 2850000,
    debitTurnover: 5400000,
    creditTurnover: 2550000,
    balanceDebit: 2850000,
    balanceCredit: 0,
    date: '2026-04-12',
    invoiceNumber: 'SZ-2026/089',
    partner: 'Alpha Trade Kft.',
    depth: 1,
    isRoot: false,
  },
  {
    id: '454',
    name: 'Belföldi szállítók',
    balance: -1680000,
    debitTurnover: 1920000,
    creditTurnover: 3600000,
    balanceDebit: 0,
    balanceCredit: 1680000,
    date: '2026-04-10',
    invoiceNumber: 'BESZ-2026/411',
    partner: 'Omega Logisztika Zrt.',
    depth: 1,
    isRoot: false,
  },
  {
    id: '511',
    name: 'Bérköltség',
    balance: 3200000,
    debitTurnover: 3200000,
    creditTurnover: 0,
    balanceDebit: 3200000,
    balanceCredit: 0,
    date: '2026-03-31',
    invoiceNumber: 'BER-2026/03',
    partner: 'Havi bérfeladás',
    depth: 1,
    isRoot: false,
  },
  {
    id: '911',
    name: 'Belföldi értékesítés árbevétele',
    balance: -7500000,
    debitTurnover: 0,
    creditTurnover: 7500000,
    balanceDebit: 0,
    balanceCredit: 7500000,
    date: '2026-04-15',
    invoiceNumber: 'SZ-2026/092',
    partner: 'Delta Partnerek',
    depth: 1,
    isRoot: false,
  }
];
