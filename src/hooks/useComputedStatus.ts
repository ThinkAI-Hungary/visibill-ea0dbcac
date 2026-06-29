/**
 * Universal Computed Status utilities.
 *
 * Payment status for salary/invoices is derived from the presence of `transaction_id`.
 * Match status for transactions is derived from `matched_invoice_id` + special cases.
 */

// ── Salary / Invoices ────────────────────────────────────────────────

export type PaymentStatus = 'paid' | 'pending';

export function computePaymentStatus(transactionId: string | null | undefined): PaymentStatus {
  return transactionId ? 'paid' : 'pending';
}

export function getPaymentStatusBadge(transactionId: string | null | undefined) {
  const status = computePaymentStatus(transactionId);
  if (status === 'paid') {
    return {
      label: 'Fizetve',
      className: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/20',
    };
  }
  return {
    label: 'Nyitott',
    className: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/20',
  };
}

// ── Transactions ─────────────────────────────────────────────────────

export type MatchStatus = 'matched' | 'suggested' | 'unmatched' | 'no_invoice' | 'invoice_missing' | 'auto_settled';

interface TransactionLike {
  matched_invoice_id: string | null;
  is_verified?: boolean | null;
  confidence_score?: number | null;
  match_type?: string | null;
  type?: string | null;
}

const CASH_TYPES = [
  'atm készpénzfelvét',
  'pénztári kp felvét',
  'pénztári kp befizetés',
  'kp befizetés atm-en keresztül',
];

export function computeMatchStatus(transaction: TransactionLike): MatchStatus {
  const t = transaction.type?.toLowerCase().trim() ?? '';

  // Manual status flags — checked first, these override everything
  if (transaction.match_type === 'no_invoice') return 'no_invoice';
  if (transaction.match_type === 'invoice_missing') return 'invoice_missing';

  // Auto-settled: categories that don't need an invoice
  if (
    transaction.match_type === 'no_match_category' ||
    CASH_TYPES.includes(t) ||
    t === 'bankköltség' ||
    t === 'járulékok/adók' ||
    t === 'bérek'
  ) {
    return 'auto_settled';
  }

  if (transaction.is_verified && transaction.matched_invoice_id) {
    return 'matched';
  }
  if (transaction.matched_invoice_id && !transaction.is_verified) {
    return 'suggested';
  }
  return 'unmatched';
}
