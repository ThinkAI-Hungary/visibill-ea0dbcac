import { normalizeInvoiceNumber, isNavAndSubmittedInvoiceMatch } from '@/lib/invoiceMatchingUtils';
import type { NavInvoice, SubmittedInvoice } from '../types';

export interface LinkedInvoiceWithRelation extends SubmittedInvoice {
  relationDirection: 'parent' | 'child';
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
      }
    }
  });

  return map;
}

export function buildLinkedInvoicesMap(
  submittedInvoices: SubmittedInvoice[],
  linkedInvoicesPool: SubmittedInvoice[]
) {
  const allInvoices = [...submittedInvoices, ...linkedInvoicesPool];
  const byBizonylat = new Map<string, SubmittedInvoice[]>();
  const byReference = new Map<string, SubmittedInvoice[]>();

  allInvoices.forEach(inv => {
    if (inv.bizonylatsorszam) {
      const key = normalizeInvoiceNumber(inv.bizonylatsorszam);
      const arr = byBizonylat.get(key) || [];
      arr.push(inv);
      byBizonylat.set(key, arr);
    }
    if (inv.reference_number) {
      const refs = inv.reference_number.split(',').map(r => r.trim()).filter(Boolean);
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
      const refs = inv.elolegszamla_hivatkozas.split(',').map(r => r.trim()).filter(Boolean);
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
  const linked: LinkedInvoiceWithRelation[] = [];
  const visited = new Set([invoice.id]);

  const getParentRefs = (inv: SubmittedInvoice): string[] => {
    const refs: string[] = [];
    if (inv.reference_number) {
      inv.reference_number.split(',').map(r => r.trim()).filter(Boolean).forEach(r => refs.push(r));
    }
    if (inv.elolegszamla_hivatkozas) {
      inv.elolegszamla_hivatkozas.split(',').map(r => r.trim()).filter(Boolean).forEach(r => refs.push(r));
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
