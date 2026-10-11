export type VatTemplateField =
  | 'entryNumber'
  | 'journalType'
  | 'vatDueDate'
  | 'invoiceNumber'
  | 'partnerCode'
  | 'partnerName'
  | 'description'
  | 'vatRateLabel'
  | 'netAmount'
  | 'vatAmount'
  | 'grossAmount'
  | 'returnRowCode'
  | 'netGlAccount'
  | 'vatGlAccount'
  | 'grossGlAccount'
  | 'payableNetAmount'
  | 'payableVatAmount'
  | 'deductibleNetAmount'
  | 'deductibleVatAmount'
  | 'netVatPosition'
  | 'custom';

export type VatTemplateFormat = 'text' | 'currency' | 'date' | 'number';

export type VatTemplateAlign = 'left' | 'center' | 'right';

export interface VatTemplateColumn {
  id: string;
  key: string;
  label: string;
  width?: string;
  align: VatTemplateAlign;
  field: VatTemplateField;
  format?: VatTemplateFormat;
  required?: boolean;
}

export interface VatViewTemplate {
  id: string;
  company_id?: string | null;
  accounting_firm_id?: string | null;
  name: string;
  template_type: 'builtin' | 'custom';
  description?: string | null;
  columns: VatTemplateColumn[];
  source_file_name?: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface VatSampleRow {
  id: string;
  entryNumber?: string;
  journalType?: string;
  vatDueDate?: string;
  invoiceNumber?: string;
  partnerCode?: string;
  partnerName?: string;
  description?: string;
  vatRateLabel?: string;
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
  returnRowCode?: string;
  netGlAccount?: string;
  vatGlAccount?: string;
  grossGlAccount?: string;
  payableNetAmount?: number;
  payableVatAmount?: number;
  deductibleNetAmount?: number;
  deductibleVatAmount?: number;
  netVatPosition?: number;
}

export const DEFAULT_VAT_SAMPLE_ROWS: VatSampleRow[] = [
  {
    id: 'sample_1',
    entryNumber: 'SZ26/000101',
    journalType: 'szállító',
    vatDueDate: '2026-03-12',
    invoiceNumber: 'BESZ-2026/0412',
    partnerCode: '14829301-2-41',
    partnerName: 'Office Depot Kft.',
    description: 'Irodaszerek beszerzése',
    vatRateLabel: '27%-os',
    netAmount: 120000,
    vatAmount: 32400,
    grossAmount: 152400,
    returnRowCode: '64',
    netGlAccount: '529T',
    vatGlAccount: '466T',
    grossGlAccount: '4541K',
    deductibleNetAmount: 120000,
    deductibleVatAmount: 32400,
    payableNetAmount: 0,
    payableVatAmount: 0,
    netVatPosition: -32400,
  },
  {
    id: 'sample_2',
    entryNumber: 'K26/000215',
    journalType: 'vevő',
    vatDueDate: '2026-03-15',
    invoiceNumber: 'SZ-2026/0890',
    partnerCode: '25419821-2-42',
    partnerName: 'Magyar Telekom Nyrt.',
    description: 'IT tanácsadási szolgáltatás',
    vatRateLabel: '27%-os',
    netAmount: 850000,
    vatAmount: 229500,
    grossAmount: 1079500,
    returnRowCode: '01',
    netGlAccount: '911K',
    vatGlAccount: '467K',
    grossGlAccount: '311T',
    payableNetAmount: 850000,
    payableVatAmount: 229500,
    deductibleNetAmount: 0,
    deductibleVatAmount: 0,
    netVatPosition: 229500,
  },
  {
    id: 'sample_3',
    entryNumber: 'SZ26/000108',
    journalType: 'szállító',
    vatDueDate: '2026-03-20',
    invoiceNumber: 'V-2026/0074',
    partnerCode: '18920412-2-43',
    partnerName: 'EuroSteel Profil Kft.',
    description: 'Acélipari termékek fordított adózás (FAD)',
    vatRateLabel: 'FAD (27%)',
    netAmount: 450000,
    vatAmount: 121500,
    grossAmount: 571500,
    returnRowCode: '29 / 66',
    netGlAccount: '529T',
    vatGlAccount: '4666T / 4676K',
    grossGlAccount: '4541K',
    payableNetAmount: 450000,
    payableVatAmount: 121500,
    deductibleNetAmount: 450000,
    deductibleVatAmount: 121500,
    netVatPosition: 0,
  },
  {
    id: 'sample_4',
    entryNumber: 'K26/000219',
    journalType: 'vevő',
    vatDueDate: '2026-03-25',
    invoiceNumber: 'SZ-2026/0912',
    partnerCode: 'DE301928410',
    partnerName: 'Hansa Logistics GmbH',
    description: 'Közösségi adómentes értékesítés (A60)',
    vatRateLabel: 'mentes',
    netAmount: 1200000,
    vatAmount: 0,
    grossAmount: 1200000,
    returnRowCode: '05',
    netGlAccount: '911K',
    vatGlAccount: '—',
    grossGlAccount: '311T',
    payableNetAmount: 1200000,
    payableVatAmount: 0,
    deductibleNetAmount: 0,
    deductibleVatAmount: 0,
    netVatPosition: 0,
  },
  {
    id: 'sample_5',
    entryNumber: 'P26/000032',
    journalType: 'pénztár',
    vatDueDate: '2026-03-28',
    invoiceNumber: 'KP-2026/015',
    partnerCode: '29102931-1-41',
    partnerName: 'MOL Nyrt.',
    description: 'Gépjármű üzemanyag készpénzes számla',
    vatRateLabel: '27%-os',
    netAmount: 28000,
    vatAmount: 7560,
    grossAmount: 35560,
    returnRowCode: '64',
    netGlAccount: '529T',
    vatGlAccount: '466T',
    grossGlAccount: '3811T',
    deductibleNetAmount: 28000,
    deductibleVatAmount: 7560,
    payableNetAmount: 0,
    payableVatAmount: 0,
    netVatPosition: -7560,
  }
];
