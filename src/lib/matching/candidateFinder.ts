import { AvailableInvoice, AvailableTransaction } from './types';

/**
 * Approximate exchange rates for frontend heuristic candidate sorting & tolerance filtering only.
 */
export const APPROX_FX_RATES: Record<string, number> = {
  EUR: 395,
  USD: 370,
  GBP: 470,
  CHF: 420,
};

/**
 * Converts any currency amount to HUF using approximate FX rates for similarity comparison.
 */
export function toHuf(amount: number, currency?: string | null): number {
  const ccy = (currency || 'HUF').toUpperCase();
  if (ccy !== 'HUF' && APPROX_FX_RATES[ccy]) {
    return amount * APPROX_FX_RATES[ccy];
  }
  return amount;
}

export function isSameCurrency(ccyA?: string | null, ccyB?: string | null): boolean {
  return (ccyA || 'HUF').toUpperCase() === (ccyB || 'HUF').toUpperCase();
}

export interface FilterInvoiceCandidatesParams {
  availableInvoices: AvailableInvoice[];
  serverSearchResults?: AvailableInvoice[];
  search?: string;
  transactionAmount?: number;
  transactionCurrency?: string | null;
  minShowCount?: number;
}

/**
 * Filters and sorts invoice candidates for a transaction.
 * Follows P-018:
 * - When searching: text/amount search with priority on same currency & amount proximity.
 * - When not searching: tolerance filter (±30% same currency, ±50% cross-currency).
 * - Minimum 10 invoices guarantee (sorted by proximity) to avoid confusing empty states.
 */
export function filterAndSortInvoiceCandidates({
  availableInvoices,
  serverSearchResults = [],
  search = '',
  transactionAmount = 0,
  transactionCurrency = 'HUF',
  minShowCount = 10,
}: FilterInvoiceCandidatesParams): AvailableInvoice[] {
  const txAmt = Math.abs(transactionAmount || 0);
  const query = search.trim();
  const txCcy = (transactionCurrency || 'HUF').toUpperCase();

  // ── No search: filter by amount tolerance ──
  if (!query) {
    let list = [...availableInvoices];
    if (txAmt > 0) {
      const filtered = list.filter(inv => {
        const invCcy = (inv.penznem || 'HUF').toUpperCase();
        const isSameCcy = isSameCurrency(txCcy, invCcy);

        const invAmt = isSameCcy
          ? Math.abs(inv.brutto_vegosszeg || 0)
          : Math.abs(toHuf(inv.brutto_vegosszeg || 0, inv.penznem));
        const txComp = isSameCcy
          ? txAmt
          : toHuf(txAmt, txCcy);

        const diff = Math.abs(invAmt - txComp);
        const tolerance = isSameCcy ? 0.30 : 0.50;
        return diff / txComp <= tolerance;
      });

      if (filtered.length >= minShowCount) {
        list = filtered;
      } else {
        // Sort full list by amount proximity, prioritize same currency
        const sorted = [...list].sort((a, b) => {
          const aSame = isSameCurrency(a.penznem, txCcy);
          const bSame = isSameCurrency(b.penznem, txCcy);
          if (aSame !== bSame) return aSame ? -1 : 1;

          const aAmt = aSame ? Math.abs(a.brutto_vegosszeg || 0) : toHuf(Math.abs(a.brutto_vegosszeg || 0), a.penznem);
          const bAmt = bSame ? Math.abs(b.brutto_vegosszeg || 0) : toHuf(Math.abs(b.brutto_vegosszeg || 0), b.penznem);
          const txComp = aSame ? txAmt : toHuf(txAmt, txCcy);
          return Math.abs(aAmt - txComp) - Math.abs(bAmt - txComp);
        });
        list = sorted.slice(0, Math.max(minShowCount, filtered.length));
      }
    }
    return list;
  }

  // ── Searching: merge server and local search results ──
  const searchLower = query.toLowerCase();
  const searchNormalized = query.replace(',', '.');

  const localMatches = availableInvoices.filter(inv => {
    if (inv.bizonylatsorszam?.toLowerCase().includes(searchLower)) return true;
    if (inv.elado_nev?.toLowerCase().includes(searchLower)) return true;

    if (inv.brutto_vegosszeg != null) {
      const amt = inv.brutto_vegosszeg;
      const amtStr = amt.toString();
      const amtFixed2 = amt.toFixed(2);
      const amtInt = Math.round(amt).toString();
      if (amtStr.includes(searchNormalized) || amtFixed2.includes(searchNormalized) || amtInt.includes(searchNormalized)) return true;
      if (amtStr.includes(query) || amtFixed2.includes(query)) return true;
    }
    return false;
  });

  const seenIds = new Set<string>();
  const merged: AvailableInvoice[] = [];
  [...serverSearchResults, ...localMatches].forEach(item => {
    if (!seenIds.has(item.id)) {
      seenIds.add(item.id);
      merged.push(item);
    }
  });

  merged.sort((a, b) => {
    const aCcy = (a.penznem || 'HUF').toUpperCase();
    const bCcy = (b.penznem || 'HUF').toUpperCase();
    const aSame = aCcy === txCcy;
    const bSame = bCcy === txCcy;
    if (aSame !== bSame) return aSame ? -1 : 1;

    const aAmt = aSame ? Math.abs(a.brutto_vegosszeg || 0) : toHuf(Math.abs(a.brutto_vegosszeg || 0), a.penznem);
    const bAmt = bSame ? Math.abs(b.brutto_vegosszeg || 0) : toHuf(Math.abs(b.brutto_vegosszeg || 0), b.penznem);
    const txComp = aSame ? txAmt : toHuf(txAmt, txCcy);
    const diffA = Math.abs(aAmt - txComp);
    const diffB = Math.abs(bAmt - txComp);
    return diffA - diffB;
  });

  return merged;
}

export interface FilterTransactionCandidatesParams {
  availableTransactions: AvailableTransaction[];
  search?: string;
  invoiceAmount?: number;
  invoiceCurrency?: string | null;
}

/**
 * Filters and sorts transaction candidates for an invoice (used in useTransactionMatcher & ExpandedInvoiceRow).
 */
export function filterAndSortTransactionCandidates({
  availableTransactions,
  search = '',
  invoiceAmount = 0,
  invoiceCurrency = 'HUF',
}: FilterTransactionCandidatesParams): AvailableTransaction[] {
  const invAmt = Math.abs(invoiceAmount || 0);
  const invCcy = (invoiceCurrency || 'HUF').toUpperCase();
  let list = [...availableTransactions];

  if (!search) {
    if (invAmt > 0) {
      list = list.filter(tx => {
        const txHuf = Math.abs(toHuf(tx.amount || 0, tx.currency));
        const invHuf = Math.abs(toHuf(invAmt, invCcy));
        const diff = Math.abs(txHuf - invHuf);
        const isCross = !isSameCurrency(tx.currency, invCcy);
        const tolerance = isCross ? 0.50 : 0.30;
        return diff / invHuf <= tolerance;
      });
    }
  } else {
    const searchLower = search.toLowerCase();
    const searchNormalized = search.replace(',', '.');

    list = availableTransactions.filter(tx => {
      if (tx.description?.toLowerCase().includes(searchLower)) return true;
      if (tx.type?.toLowerCase().includes(searchLower)) return true;

      if (tx.amount != null) {
        const amt = Math.abs(tx.amount);
        const amtStr = amt.toString();
        const amtFixed2 = amt.toFixed(2);
        const amtInt = Math.round(amt).toString();
        if (amtStr.includes(searchNormalized) || amtFixed2.includes(searchNormalized) || amtInt.includes(searchNormalized)) return true;
        if (amtStr.includes(search) || amtFixed2.includes(search)) return true;
      }

      if (tx.transaction_date?.includes(search)) return true;
      return false;
    });
  }

  const invHuf = Math.abs(toHuf(invAmt, invCcy));
  list.sort((a, b) => {
    const aHuf = Math.abs(toHuf(a.amount || 0, a.currency));
    const bHuf = Math.abs(toHuf(b.amount || 0, b.currency));
    const diffA = Math.abs(aHuf - invHuf);
    const diffB = Math.abs(bHuf - invHuf);
    return diffA - diffB;
  });

  return list;
}
