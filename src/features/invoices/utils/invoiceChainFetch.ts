import { supabase } from '@/integrations/supabase/client';
import { normalizeInvoiceNumber } from '@/lib/invoiceMatchingUtils';
import { INVOICE_TYPE_LABELS } from '@/types/invoices';

export interface InvoiceChainItem {
  id: string;
  bizonylatsorszam: string;
  invoice_type?: string | null;
  image_url?: string | null;
  melleklet_url?: string | null;
  attachments?: any[] | null;
  reference_number?: string | null;
  elolegszamla_hivatkozas?: string | null;
  relationRole?: string;
  isCurrent?: boolean;
}

export function parseInvoiceReferences(raw?: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

export function matchesReference(refField: string | null | undefined, targetNum: string): boolean {
  if (!refField || !targetNum) return false;
  const targetNorm = normalizeInvoiceNumber(targetNum);
  if (!targetNorm) return false;
  const tokens = parseInvoiceReferences(refField);
  return tokens.some(t => normalizeInvoiceNumber(t) === targetNorm);
}

export function getInvoiceRoleBadge(type?: string | null, isReferencedParent?: boolean): string {
  if (!type) return isReferencedParent ? 'Alapszámla' : 'Számla';
  switch (type) {
    case 'sztorno_szla':
    case 'storno':
      return 'Sztornó';
    case 'vegszamla':
      return 'Végszámla';
    case 'elolegszamla':
    case 'eloleg_szla':
      return 'Előleg';
    case 'helyesbito_szla':
    case 'helyesbito_szamla':
      return 'Helyesbítő';
    case 'dijbekero':
    case 'proforma':
    case 'dijbekero_proforma':
      return 'Díjbekérő';
    case 'sima_szla':
    case 'sima_szamla':
      return isReferencedParent ? 'Alapszámla' : 'Számla';
    case 'egyszerusitett_szamla':
    case 'egyszerusitett_szla':
      return 'Egysz. számla';
    default:
      return INVOICE_TYPE_LABELS[type] || (isReferencedParent ? 'Alapszámla' : 'Számla');
  }
}

export async function fetchInvoiceChain(params: {
  invoiceId?: string;
  bizonylatsorszam?: string;
  companyId?: string;
  referenceNumber?: string | null;
  elolegszamlaHivatkozas?: string | null;
  invoiceType?: string | null;
}): Promise<{
  currentDbInvoice: any | null;
  companionInvoices: InvoiceChainItem[];
  currentRole: string;
}> {
  const { invoiceId, bizonylatsorszam } = params;

  // 1. Fetch current invoice from DB to get fresh company_id, reference_number, elolegszamla_hivatkozas, attachments, etc.
  let currentDbInvoice: any = null;
  let invQuery = supabase
    .from('invoices')
    .select('id, company_id, bizonylatsorszam, reference_number, elolegszamla_hivatkozas, invoice_type, image_url, melleklet_url, attachments');

  if (invoiceId) {
    invQuery = invQuery.or(`id.eq.${invoiceId}${bizonylatsorszam ? `,bizonylatsorszam.eq.${bizonylatsorszam}` : ''}`);
  } else if (bizonylatsorszam) {
    invQuery = invQuery.eq('bizonylatsorszam', bizonylatsorszam);
  } else {
    return { currentDbInvoice: null, companionInvoices: [], currentRole: 'Számla' };
  }

  const { data: dbData } = await invQuery.maybeSingle();
  if (dbData) {
    currentDbInvoice = dbData;
  }

  const companyId = currentDbInvoice?.company_id || params.companyId;
  const currentNum = currentDbInvoice?.bizonylatsorszam || bizonylatsorszam;
  const currentType = currentDbInvoice?.invoice_type || params.invoiceType;
  const currentRefNum = currentDbInvoice?.reference_number ?? params.referenceNumber;
  const currentElolegRef = currentDbInvoice?.elolegszamla_hivatkozas ?? params.elolegszamlaHivatkozas;

  if (!companyId || !currentNum) {
    return {
      currentDbInvoice,
      companionInvoices: [],
      currentRole: getInvoiceRoleBadge(currentType, false),
    };
  }

  const currentId = currentDbInvoice?.id || invoiceId;
  const visitedIds = new Set<string>();
  if (currentId) visitedIds.add(currentId);

  const collectedMap = new Map<string, any>();

  // Extract initial parent references
  const initialParentRefs = [
    ...parseInvoiceReferences(currentRefNum),
    ...parseInvoiceReferences(currentElolegRef),
  ];

  // Helper to execute query
  const runPass = async (targetNums: string[], parentRefs: string[]) => {
    if (targetNums.length === 0 && parentRefs.length === 0) return [];

    const orParts: string[] = [];
    for (const num of targetNums) {
      const clean = num.replace(/[,;]/g, '').trim();
      if (clean) {
        orParts.push(`reference_number.ilike.%${clean}%`);
        orParts.push(`elolegszamla_hivatkozas.ilike.%${clean}%`);
      }
    }
    for (const ref of parentRefs) {
      const clean = ref.replace(/[,;]/g, '').trim();
      if (clean) {
        orParts.push(`bizonylatsorszam.eq.${clean}`);
      }
    }

    if (orParts.length === 0) return [];

    let q = supabase
      .from('invoices')
      .select('id, company_id, bizonylatsorszam, reference_number, elolegszamla_hivatkozas, invoice_type, image_url, melleklet_url, attachments')
      .eq('company_id', companyId);

    if (visitedIds.size > 0) {
      q = q.not('id', 'in', `(${Array.from(visitedIds).join(',')})`);
    }

    q = q.or(orParts.join(','));

    const { data, error } = await q;
    if (error || !data) {
      console.warn('Invoice chain query error:', error);
      return [];
    }
    return data;
  };

  // PASS 1: Direct relatives of current invoice
  const pass1Candidates = await runPass([currentNum], initialParentRefs);

  // Filter with strict matching in TS
  const pass1Verified: any[] = [];
  for (const row of pass1Candidates) {
    if (!row.bizonylatsorszam || visitedIds.has(row.id)) continue;

    const isDirectParent = initialParentRefs.some(
      ref => normalizeInvoiceNumber(ref) === normalizeInvoiceNumber(row.bizonylatsorszam)
    );
    const isDirectChild =
      matchesReference(row.reference_number, currentNum) ||
      matchesReference(row.elolegszamla_hivatkozas, currentNum);

    if (isDirectParent || isDirectChild) {
      visitedIds.add(row.id);
      pass1Verified.push(row);
      collectedMap.set(row.id, row);
    }
  }

  // PASS 2: Multi-hop relatives (siblings, grandchild stornos, etc.)
  if (pass1Verified.length > 0) {
    const unvisitedRefs: string[] = [];
    const unvisitedChildSearchNums: string[] = [];

    for (const row of pass1Verified) {
      const refs = [
        ...parseInvoiceReferences(row.reference_number),
        ...parseInvoiceReferences(row.elolegszamla_hivatkozas),
      ];
      for (const r of refs) {
        const norm = normalizeInvoiceNumber(r);
        const alreadyKnown =
          normalizeInvoiceNumber(currentNum) === norm ||
          Array.from(collectedMap.values()).some(
            inv => normalizeInvoiceNumber(inv.bizonylatsorszam) === norm
          );
        if (!alreadyKnown) {
          unvisitedRefs.push(r);
        }
      }

      if (row.bizonylatsorszam) {
        unvisitedChildSearchNums.push(row.bizonylatsorszam);
      }
    }

    if (unvisitedRefs.length > 0 || unvisitedChildSearchNums.length > 0) {
      const pass2Candidates = await runPass(unvisitedChildSearchNums, unvisitedRefs);
      for (const row of pass2Candidates) {
        if (!row.bizonylatsorszam || visitedIds.has(row.id)) continue;

        const isParentOfChild = unvisitedRefs.some(
          ref => normalizeInvoiceNumber(ref) === normalizeInvoiceNumber(row.bizonylatsorszam)
        );
        const isChildOfAny = unvisitedChildSearchNums.some(
          num =>
            matchesReference(row.reference_number, num) ||
            matchesReference(row.elolegszamla_hivatkozas, num)
        );

        if (isParentOfChild || isChildOfAny) {
          visitedIds.add(row.id);
          collectedMap.set(row.id, row);
        }
      }
    }
  }

  const allCompanions = Array.from(collectedMap.values());

  // Check if current invoice is referenced as a parent by any companion
  const isCurrentReferenced = allCompanions.some(
    comp =>
      matchesReference(comp.reference_number, currentNum) ||
      matchesReference(comp.elolegszamla_hivatkozas, currentNum)
  );

  const currentRole = getInvoiceRoleBadge(currentType, isCurrentReferenced);

  // Map and sort companions
  // Lifecycle order: Előleg (10) -> Alapszámla (20) -> Végszámla (30) -> Helyesbítő (40) -> Sztornó (50) -> Other (60)
  const getRank = (type?: string | null): number => {
    switch (type) {
      case 'elolegszamla':
      case 'eloleg_szla':
        return 10;
      case 'sima_szla':
      case 'sima_szamla':
        return 20;
      case 'vegszamla':
        return 30;
      case 'helyesbito_szla':
      case 'helyesbito_szamla':
        return 40;
      case 'sztorno_szla':
      case 'storno':
        return 50;
      default:
        return 60;
    }
  };

  const companionItems: InvoiceChainItem[] = allCompanions.map(comp => {
    // Check if comp is referenced by another companion or by current invoice
    const isCompReferenced =
      matchesReference(currentRefNum, comp.bizonylatsorszam) ||
      matchesReference(currentElolegRef, comp.bizonylatsorszam) ||
      allCompanions.some(
        other =>
          other.id !== comp.id &&
          (matchesReference(other.reference_number, comp.bizonylatsorszam) ||
            matchesReference(other.elolegszamla_hivatkozas, comp.bizonylatsorszam))
      );

    return {
      id: comp.id,
      bizonylatsorszam: comp.bizonylatsorszam,
      invoice_type: comp.invoice_type,
      image_url: comp.image_url,
      melleklet_url: comp.melleklet_url,
      attachments: comp.attachments,
      reference_number: comp.reference_number,
      elolegszamla_hivatkozas: comp.elolegszamla_hivatkozas,
      relationRole: getInvoiceRoleBadge(comp.invoice_type, isCompReferenced),
      isCurrent: false,
    };
  });

  companionItems.sort((a, b) => getRank(a.invoice_type) - getRank(b.invoice_type));

  return {
    currentDbInvoice,
    companionInvoices: companionItems,
    currentRole,
  };
}
