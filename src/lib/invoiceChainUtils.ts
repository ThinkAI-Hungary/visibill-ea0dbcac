/**
 * Számlaláncolat (Invoice Chaining) segédfüggvények.
 *
 * Rekurzívan bejárja az egymásra hivatkozó számlákat mindkét irányban
 * (szülő → gyerek és gyerek → szülő), körkörös hivatkozás elleni védelemmel.
 */

export interface ChainableInvoice {
  id: string;
  /** Hivatkozott (szülő) számla azonosítója, ha van */
  parent_invoice_id?: string | null;
}

export interface InvoiceChainResult {
  /** Az összes megtalált számla a láncban, rendezve (szülő → gyerek irányba) */
  chain: ChainableInvoice[];
  /** Hiányzó hivatkozások: olyan ID-k, amikre hivatkoznak, de nem találhatók a listában */
  missingIds: string[];
}

/**
 * Megkeresi az összes egymásra hivatkozó számlát mindkét irányban.
 *
 * @param allInvoices - Az összes elérhető számla
 * @param startInvoice - A kiindulási számla
 * @returns A teljes lánc és a hiányzó hivatkozások
 */
export function buildInvoiceChain(
  allInvoices: ChainableInvoice[],
  startInvoice: ChainableInvoice
): InvoiceChainResult {
  const byId = new Map<string, ChainableInvoice>();
  for (const inv of allInvoices) {
    byId.set(inv.id, inv);
  }

  const visited = new Set<string>();
  const chain: ChainableInvoice[] = [];
  const missingIds: string[] = [];

  // ── Traverse upward (child → parent) ──
  function walkUp(invoice: ChainableInvoice) {
    if (visited.has(invoice.id)) return; // circular protection
    visited.add(invoice.id);

    if (invoice.parent_invoice_id) {
      const parent = byId.get(invoice.parent_invoice_id);
      if (parent) {
        walkUp(parent);
      } else {
        missingIds.push(invoice.parent_invoice_id);
      }
    }

    chain.push(invoice);
  }

  // ── Traverse downward (parent → children) ──
  function walkDown(parentId: string) {
    const children = allInvoices.filter(
      (inv) => inv.parent_invoice_id === parentId && !visited.has(inv.id)
    );

    for (const child of children) {
      if (visited.has(child.id)) continue; // circular protection
      visited.add(child.id);
      chain.push(child);
      walkDown(child.id);
    }
  }

  // Start: walk up from the start invoice to find the root
  walkUp(startInvoice);

  // Then walk down from every visited node to find all children
  const visitedAfterUp = [...visited];
  for (const id of visitedAfterUp) {
    walkDown(id);
  }

  return { chain, missingIds };
}
