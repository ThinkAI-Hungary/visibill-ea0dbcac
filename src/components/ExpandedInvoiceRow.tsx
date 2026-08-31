/**
 * ExpandedInvoiceRow Facade.
 * Delegates to the modular ExpandedInvoiceRow in src/features/invoices/components/expanded-row/.
 * Maintains 100% backward compatibility for all existing table consumers.
 */
export {
  ExpandedInvoiceRow as default,
  ExpandedInvoiceRow,
} from '@/features/invoices/components/expanded-row';

export type {
  MatchedSubmittedInvoice,
  MatchedNavInvoice,
  MatchedTransaction,
  LinkedInvoice,
  MatchedCourierReport,
  ExpandedInvoiceRowProps,
} from '@/features/invoices/components/expanded-row';
