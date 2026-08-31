/**
 * Core type definitions for the Unified DocumentEngine.
 */

export type DocumentType =
  | 'payslip'
  | 'cash_receipt'
  | 'vat_return'
  | 'annual_report'
  | 'payroll_m30'
  | 'payroll_contributions'
  | 'payroll_wage_cost'
  | 'payroll_payment_list'
  | 'payroll_t1041'
  | 'payroll_exit_sheet'
  | 'payroll_disbursement_voucher'
  | 'table_export'
  | 'custom';

export type ExportFormat = 'pdf' | 'xml' | 'csv' | 'xlsx' | 'html';

export type PageOrientation = 'portrait' | 'landscape';

export interface DocumentMetadata {
  title: string;
  subtitle?: string;
  companyName?: string;
  companyTaxNumber?: string;
  companyAddress?: string;
  period?: string;
  generatedAt?: Date | string;
  author?: string;
  filename?: string;
  orientation?: PageOrientation;
  themeColor?: [number, number, number]; // RGB tuple, e.g. [15, 116, 103] for Visibill emerald
}

export interface TableColumn {
  header: string;
  key: string;
  align?: 'left' | 'center' | 'right';
  width?: number;
  format?: 'text' | 'number' | 'currency' | 'date' | 'percent';
}

export interface TableSection {
  type: 'table';
  title?: string;
  subtitle?: string;
  columns?: TableColumn[];
  headers?: string[];
  rows: (string | number | boolean | null | undefined)[][];
  footers?: { label: string; value: string | number }[];
  highlightLastRow?: boolean;
}

export interface KeyValueSection {
  type: 'key-value';
  title?: string;
  items: { label: string; value: string | number; highlight?: boolean }[];
  columnsCount?: 2 | 3 | 4;
}

export interface TextSection {
  type: 'text';
  title?: string;
  content: string;
  style?: 'normal' | 'callout' | 'legal' | 'signature';
}

export interface CustomHtmlSection {
  type: 'html';
  html: string;
}

export type DocumentSection = TableSection | KeyValueSection | TextSection | CustomHtmlSection;

export interface DocumentDescriptor {
  type: DocumentType;
  metadata: DocumentMetadata;
  sections: DocumentSection[];
  rawPayload?: Record<string, any>;
}

export interface ExportResult {
  filename: string;
  format: ExportFormat;
  blob?: Blob;
  url?: string;
  contentString?: string;
  success: boolean;
  sizeBytes?: number;
}
