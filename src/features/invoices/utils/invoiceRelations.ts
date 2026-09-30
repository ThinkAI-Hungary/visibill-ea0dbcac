import { 
  normalizeInvoiceNumber, 
  extractBaseTax,
  isNavAndSubmittedInvoiceMatch,
  evaluateNavAndSubmittedSuggestedMatch,
  isForeignSubmittedInvoice,
  type SuggestedMatchCandidateResult,
} from '@/lib/invoiceMatchingUtils';
import type { NavInvoice, SubmittedInvoice } from '../types';

export interface LinkedInvoiceWithRelation extends SubmittedInvoice {
  relationDirection: 'parent' | 'child';
}

export interface SuggestedSubmittedInvoiceWithScore extends SubmittedInvoice {
  suggestedScore: number;
  suggestedReason: string;
  isSuffixMatch: boolean;
}

export function buildNavToSubmittedMap(
  submittedInvoices: SubmittedInvoice[],
  paginatedNavInvoices: NavInvoice[]
): Map<string, SubmittedInvoice[]> {
  const map = new Map<string, SubmittedInvoice[]>();
  const byNum = new Map<string, SubmittedInvoice[]>();

  submittedInvoices.forEach(inv => {
    if (inv.bizonylatsorszam) {
      const key = normalizeInvoiceNumber(inv.bizonylatsorszam);
      const existing = byNum.get(key) || [];
      existing.push(inv);
      byNum.set(key, existing);
    }
  });

  paginatedNavInvoices.forEach(nav => {
    const key = normalizeInvoiceNumber(nav.invoice_number);
    const candidates = byNum.get(key) || [];
    const verified = candidates.filter(sub => isNavAndSubmittedInvoiceMatch(nav, sub));
    if (verified.length > 0) {
      map.set(key, verified);
    } else {
      // Számlalánc-örökítés (díjbekérő / előlegszámla / közös tranzakció híd)
      const isOutbound = nav.invoice_direction === 'OUTBOUND';
      const navTax = extractBaseTax(isOutbound ? nav.customer_tax_number : nav.supplier_tax_number);
      const navGross = Math.abs(Number(nav.invoice_gross_amount || 0));

      const chainMatches = submittedInvoices.filter(sub => {
        // 1. Azonos tranzakció ID
        if ((nav as any).transaction_id && (sub as any).transaction_id && (nav as any).transaction_id === (sub as any).transaction_id) {
          return true;
        }
        // 2. Díjbekérő / Előleg lánc azonos partnerrel és összeggel
        if (
          sub.invoice_direction === nav.invoice_direction &&
          ['dijbekero_proforma', 'dijbekero', 'elolegszamla'].includes(sub.invoice_type || '')
        ) {
          const subTax = extractBaseTax(isOutbound ? sub.vevo_vat_id : sub.elado_vat_id);
          const taxMatch = navTax && subTax ? navTax === subTax : false;
          const subGross = Math.abs(Number(sub.brutto_vegosszeg || 0));
          const amountMatch = Math.abs(subGross - navGross) < 1.0;

          if (taxMatch && amountMatch) {
            return true;
          }
        }
        return false;
      });

      if (chainMatches.length > 0) {
        map.set(key, chainMatches);
      }
    }
  });

  return map;
}

export function buildSubmittedToNavMap(
  submittedInvoices: SubmittedInvoice[],
  paginatedNavInvoices: NavInvoice[]
): Map<string, NavInvoice[]> {
  const map = new Map<string, NavInvoice[]>();
  const byNum = new Map<string, NavInvoice[]>();

  paginatedNavInvoices.forEach(inv => {
    const key = normalizeInvoiceNumber(inv.invoice_number);
    const existing = byNum.get(key) || [];
    existing.push(inv);
    byNum.set(key, existing);
  });

  submittedInvoices.forEach(sub => {
    if (sub.bizonylatsorszam) {
      const key = normalizeInvoiceNumber(sub.bizonylatsorszam);
      const candidates = byNum.get(key) || [];
      const verified = candidates.filter(nav => isNavAndSubmittedInvoiceMatch(nav, sub));
      if (verified.length > 0) {
        map.set(key, verified);
      } else {
        // Számlalánc feloldás fordított irányban
        const isOutbound = sub.invoice_direction === 'OUTBOUND';
        const subTax = extractBaseTax(isOutbound ? sub.vevo_vat_id : sub.elado_vat_id);
        const subGross = Math.abs(Number(sub.brutto_vegosszeg || 0));

        const chainMatches = paginatedNavInvoices.filter(nav => {
          if ((sub as any).transaction_id && (nav as any).transaction_id && (sub as any).transaction_id === (nav as any).transaction_id) {
            return true;
          }
          if (
            nav.invoice_direction === sub.invoice_direction &&
            ['dijbekero_proforma', 'dijbekero', 'elolegszamla'].includes(sub.invoice_type || '')
          ) {
            const navTax = extractBaseTax(isOutbound ? nav.customer_tax_number : nav.supplier_tax_number);
            const taxMatch = subTax && navTax ? subTax === navTax : false;
            const navGross = Math.abs(Number(nav.invoice_gross_amount || 0));
            const amountMatch = Math.abs(navGross - subGross) < 1.0;
            return taxMatch && amountMatch;
          }
          return false;
        });

        if (chainMatches.length > 0) {
          map.set(key, chainMatches);
        }
      }
    }
  });

  return map;
}

export function buildNavToSuggestedSubmittedMap(
  submittedInvoices: SubmittedInvoice[],
  paginatedNavInvoices: NavInvoice[],
  exactNavToSubmittedMap: Map<string, SubmittedInvoice[]>
): Map<string, SuggestedSubmittedInvoiceWithScore[]> {
  const map = new Map<string, SuggestedSubmittedInvoiceWithScore[]>();

  // Collect all submitted invoice IDs that already have an exact match with any NAV invoice
  const alreadyMatchedSubmittedIds = new Set<string>();
  exactNavToSubmittedMap.forEach((subs) => {
    subs.forEach((sub) => {
      if (sub.id) alreadyMatchedSubmittedIds.add(sub.id);
    });
  });

  // Candidate pool: only domestic submitted invoices not already strictly matched, not already verified, and not foreign
  const pool = submittedInvoices.filter(
    (sub) =>
      sub.nav_status !== 'verified' &&
      sub.nav_status !== 'not_applicable' &&
      !isForeignSubmittedInvoice(sub) &&
      !alreadyMatchedSubmittedIds.has(sub.id)
  );
  if (pool.length === 0) return map;

  // Index candidate pool by base tax number for instant O(1) candidate lookup
  // INBOUND: external partner is seller (elado_vat_id)
  // OUTBOUND: external partner is buyer (vevo_vat_id)
  const poolByTax = new Map<string, SubmittedInvoice[]>();
  for (const sub of pool) {
    const isOutbound = sub.invoice_direction === 'OUTBOUND';
    const tax = extractBaseTax(isOutbound ? sub.vevo_vat_id : sub.elado_vat_id);
    if (tax) {
      const list = poolByTax.get(tax) || [];
      list.push(sub);
      poolByTax.set(tax, list);
    }
  }

  paginatedNavInvoices.forEach((nav) => {
    const navKey = normalizeInvoiceNumber(nav.invoice_number);
    // If exact match already exists for this NAV invoice, no suggestions needed
    if ((exactNavToSubmittedMap.get(navKey)?.length ?? 0) > 0) {
      return;
    }

    const isOutbound = nav.invoice_direction === 'OUTBOUND';
    const navTax = extractBaseTax(isOutbound ? nav.customer_tax_number : nav.supplier_tax_number);
    if (!navTax) return;

    const candidates = poolByTax.get(navTax);
    if (!candidates || candidates.length === 0) return;

    const suggestions: SuggestedSubmittedInvoiceWithScore[] = [];

    for (const sub of candidates) {
      const evalResult = evaluateNavAndSubmittedSuggestedMatch(
        {
          id: nav.id,
          invoice_number: nav.invoice_number,
          invoice_direction: nav.invoice_direction,
          supplier_name: nav.supplier_name,
          supplier_tax_number: nav.supplier_tax_number,
          customer_name: nav.customer_name,
          customer_tax_number: nav.customer_tax_number,
          invoice_gross_amount: nav.invoice_gross_amount,
          currency: nav.currency,
          invoice_issue_date: nav.invoice_issue_date,
          invoice_delivery_date: nav.invoice_delivery_date,
        },
        {
          id: sub.id,
          bizonylatsorszam: sub.bizonylatsorszam,
          invoice_direction: sub.invoice_direction,
          elado_nev: sub.elado_nev,
          elado_vat_id: sub.elado_vat_id,
          vevo_nev: sub.vevo_nev,
          vevo_vat_id: sub.vevo_vat_id,
          brutto_vegosszeg: sub.brutto_vegosszeg,
          penznem: sub.penznem,
          nav_invoice_id: sub.nav_invoice_id,
          kibocsatas_datuma: sub.kibocsatas_datuma,
          teljesites_datuma: sub.teljesites_datuma,
        }
      );

      if (evalResult.isMatch) {
        suggestions.push({
          ...sub,
          suggestedScore: evalResult.score,
          suggestedReason: evalResult.reason,
          isSuffixMatch: evalResult.isSuffixMatch,
        });
      }
    }

    if (suggestions.length > 0) {
      // Sort highest score first
      suggestions.sort((a, b) => b.suggestedScore - a.suggestedScore);
      map.set(navKey, suggestions);
    }
  });

  return map;
}


export function buildLinkedInvoicesMap(
  submittedInvoices: SubmittedInvoice[],
  linkedInvoicesPool: SubmittedInvoice[]
) {
  const uniqueInvoices = new Map<string, SubmittedInvoice>();
  (submittedInvoices || []).forEach(inv => {
    if (inv?.id) uniqueInvoices.set(inv.id, inv);
  });
  (linkedInvoicesPool || []).forEach(inv => {
    if (inv?.id && !uniqueInvoices.has(inv.id)) {
      uniqueInvoices.set(inv.id, inv);
    }
  });

  const allInvoices = Array.from(uniqueInvoices.values());
  const byBizonylat = new Map<string, SubmittedInvoice[]>();
  const byReference = new Map<string, SubmittedInvoice[]>();

  allInvoices.forEach(inv => {
    if (inv.bizonylatsorszam) {
      const key = normalizeInvoiceNumber(inv.bizonylatsorszam);
      const arr = byBizonylat.get(key) || [];
      if (!arr.some(x => x.id === inv.id)) {
        arr.push(inv);
      }
      byBizonylat.set(key, arr);
    }
    if (inv.reference_number) {
      const refs = inv.reference_number.split(/[,;\n]+/).map(r => r.trim()).filter(Boolean);
      refs.forEach(ref => {
        const key = normalizeInvoiceNumber(ref);
        const arr = byReference.get(key) || [];
        if (!arr.some(x => x.id === inv.id)) {
          arr.push(inv);
        }
        byReference.set(key, arr);
      });
    }
    if (inv.elolegszamla_hivatkozas) {
      const refs = inv.elolegszamla_hivatkozas.split(/[,;\n]+/).map(r => r.trim()).filter(Boolean);
      refs.forEach(ref => {
        const key = normalizeInvoiceNumber(ref);
        const arr = byReference.get(key) || [];
        if (!arr.some(x => x.id === inv.id)) {
          arr.push(inv);
        }
        byReference.set(key, arr);
      });
    }
  });

  return { byBizonylat, byReference };
}

export function resolveLinkedInvoices(
  invoice: SubmittedInvoice,
  linkedInvoicesMap: { byBizonylat: Map<string, SubmittedInvoice[]>; byReference: Map<string, SubmittedInvoice[]> }
): LinkedInvoiceWithRelation[] {
  if (!invoice || !linkedInvoicesMap) return [];
  const linked: LinkedInvoiceWithRelation[] = [];
  const visited = new Set([invoice.id]);

  const getParentRefs = (inv: SubmittedInvoice): string[] => {
    const refs: string[] = [];
    if (inv.reference_number) {
      inv.reference_number.split(/[,;\n]+/).map(r => r.trim()).filter(Boolean).forEach(r => refs.push(r));
    }
    if (inv.elolegszamla_hivatkozas) {
      inv.elolegszamla_hivatkozas.split(/[,;\n]+/).map(r => r.trim()).filter(Boolean).forEach(r => refs.push(r));
    }
    return refs;
  };

  // Traverse parents
  const parentQueue = getParentRefs(invoice);
  while (parentQueue.length > 0) {
    const ref = parentQueue.shift();
    if (!ref) continue;
    const parents = linkedInvoicesMap.byBizonylat.get(normalizeInvoiceNumber(ref)) || [];
    for (const parent of parents) {
      if (visited.has(parent.id)) continue;
      visited.add(parent.id);
      linked.push({ ...parent, relationDirection: 'parent' });
      getParentRefs(parent).forEach(r => parentQueue.push(r));
    }
  }

  // Traverse children
  if (invoice.bizonylatsorszam) {
    const childQueue = [invoice.bizonylatsorszam];
    while (childQueue.length > 0) {
      const parentNum = childQueue.shift();
      if (!parentNum) continue;
      const children = linkedInvoicesMap.byReference.get(normalizeInvoiceNumber(parentNum)) || [];
      for (const child of children) {
        if (visited.has(child.id)) continue;
        visited.add(child.id);
        linked.push({ ...child, relationDirection: 'child' });
        if (child.bizonylatsorszam) {
          childQueue.push(child.bizonylatsorszam);
        }
      }
    }
  }

  return linked;
}
