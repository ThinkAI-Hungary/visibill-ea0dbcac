import type { NavInvoice, SubmittedInvoice, TransactionRecord, Partner, Category, Project } from '@/hooks/useInvoiceData';
import type { InvoiceTab, InvoiceFilters, InvoiceKpiSummary, KpiFilterType } from '@/hooks/useInvoiceFilters';
import type { ExportableInvoice, ExportLevel } from '@/components/invoices/InvoiceDataExportDialog';
import type { NettingGroup } from '@/hooks/useNettingDetection';

export type {
  NavInvoice,
  SubmittedInvoice,
  TransactionRecord,
  Partner,
  Category,
  Project,
  InvoiceTab,
  InvoiceFilters,
  InvoiceKpiSummary,
  KpiFilterType,
  ExportableInvoice,
  ExportLevel,
  NettingGroup,
};

// ── Tab slug ↔ InvoiceTab mapping ──
export const TAB_SLUGS = ['outbound_nav', 'inbound_nav', 'submitted_inbound', 'submitted_outbound'] as const;
export type TabSlug = typeof TAB_SLUGS[number];

export const SLUG_TO_TAB: Record<TabSlug, InvoiceTab> = {
  outbound_nav: 'OUTBOUND',
  inbound_nav: 'INBOUND',
  submitted_inbound: 'SUBMITTED_INBOUND',
  submitted_outbound: 'SUBMITTED_OUTBOUND',
};

export const TAB_TO_SLUG: Record<InvoiceTab, TabSlug> = {
  OUTBOUND: 'outbound_nav',
  INBOUND: 'inbound_nav',
  SUBMITTED_INBOUND: 'submitted_inbound',
  SUBMITTED_OUTBOUND: 'submitted_outbound',
};

// ── URL-based invoice deep-linking actions ──
export type InvoiceAction = 'items' | 'view' | 'edit' | 'files';
