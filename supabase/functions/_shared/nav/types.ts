// =============================================================================
// NAV Online Számla v3 – Típusdefiníciók
// =============================================================================

export interface NavCredentials {
  nav_username: string;
  nav_password: string;
  nav_tax_number: string;
  nav_sign_key: string;
  nav_exchange_key: string;
  software_id?: string;
  software_dev_name?: string;
  software_dev_contact?: string;
  software_dev_country_code?: string;
  is_test_environment?: boolean;
  company_id?: string;
}

export type NavInvoiceDirection = 'INBOUND' | 'OUTBOUND';

export interface NavSyncOptions {
  direction: NavInvoiceDirection;
  dateFrom: string; // YYYY-MM-DD
  dateTo: string;   // YYYY-MM-DD
  page?: number;
  companyId?: string;
  additionalFilters?: {
    partnerTaxNumber?: string;
    invoiceNumber?: string;
  };
}

export interface NavInvoiceDigest {
  invoice_number: string;
  invoice_operation: string;
  supplier_tax_number: string;
  customer_tax_number: string;
  invoice_issue_date: string;
  invoice_delivery_date: string;
  invoice_net_amount: number;
  invoice_vat_amount: number;
  invoice_gross_amount: number;
  payment_method: string;
  currency: string;
  supplier_name?: string;
  customer_name?: string;
  payment_date?: string;
}

export interface InvoiceLineItem {
  lineNumber: number;
  lineDescription?: string;
  quantity?: number;
  unitOfMeasure?: string;
  unitPrice?: number;
  netAmount?: number;
  vatRate?: string;
  vatAmount?: number;
  grossAmount?: number;
  productCode?: string;
  lineDeliveryPeriodFrom?: string;
  lineDeliveryPeriodTo?: string;
}

export interface InvoiceDetails {
  supplierName?: string;
  supplierAddress?: string;
  customerName?: string;
  customerAddress?: string;
  paymentDate?: string;
  invoiceGrossAmount?: number;
  lineItems?: InvoiceLineItem[];
  isCashAccounting?: boolean;
  originalInvoiceNumber?: string;
}

export interface NavValidationResult {
  valid: boolean;
  status: 'valid' | 'invalid' | 'error';
  message: string;
  error?: string | null;
  requestId: string;
  env: 'prod' | 'test';
  details?: string;
  diagnostics?: Record<string, any>;
}

export interface NavSyncResult {
  success: boolean;
  totalFetched: number;
  totalInserted: number;
  syncLogId?: string;
  invoices: NavInvoiceDigest[];
  errors?: string[];
  page?: number;
}
