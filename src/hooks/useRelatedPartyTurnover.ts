import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type {
  RelatedPartyTurnoverItem,
  RelatedPartyTurnoverTotals,
  RelatedPartyInvoiceItem,
  RelationType,
} from '@/types/related-parties';

export interface UseRelatedPartyTurnoverParams {
  companyId?: string;
  year?: number;
  dateFrom?: string;
  dateTo?: string;
}

const CASH_PAYMENT_KEYWORDS = ['készpénz', 'keszpenz', 'cash', 'penztar', 'pénztár', 'kp'];

export function isCashPayment(method: string | null | undefined): boolean {
  if (!method) return false;
  const m = method.toLowerCase().trim();
  return CASH_PAYMENT_KEYWORDS.some(kw => m.includes(kw));
}

export function useRelatedPartyTurnover(params: UseRelatedPartyTurnoverParams) {
  const { companyId, year, dateFrom, dateTo } = params;

  return useQuery({
    queryKey: ['relatedPartyTurnover', companyId, year, dateFrom, dateTo],
    queryFn: async (): Promise<{ items: RelatedPartyTurnoverItem[]; totals: RelatedPartyTurnoverTotals }> => {
      if (!companyId) {
        return {
          items: [],
          totals: {
            partnerCount: 0,
            totalOutboundGross: 0,
            totalInboundGross: 0,
            totalGrossTurnover: 0,
            totalNetBalance: 0,
            cashExceededPartnerCount: 0,
            transferPricingRequiredCount: 0,
          },
        };
      }

      // 1. Cég saját adatainak és adószámának lekérése
      const { data: company, error: compErr } = await supabase
        .from('companies')
        .select('id, name, tax_number')
        .eq('id', companyId)
        .single();

      if (compErr) throw compErr;

      const ownCleanTax = (company?.tax_number || '').replace(/-/g, '').replace(/^HU/i, '').substring(0, 8);

      // 2. Kapcsolt partnerek lekérése
      const { data: relatedPartners, error: partnersErr } = await supabase
        .from('partners')
        .select(`
          id,
          name,
          tax_number,
          related_party,
          relation_type,
          ownership_percent,
          valid_from,
          valid_to,
          parent_partner_id,
          custom_gl_account_id,
          related_party_notes,
          parent_partner:parent_partner_id(id, name),
          custom_gl_account:custom_gl_account_id(id, gl_number, short_name)
        `)
        .eq('company_id', companyId)
        .eq('related_party', true)
        .order('name', { ascending: true });

      if (partnersErr) throw partnersErr;
      if (!relatedPartners || relatedPartners.length === 0) {
        return {
          items: [],
          totals: {
            partnerCount: 0,
            totalOutboundGross: 0,
            totalInboundGross: 0,
            totalGrossTurnover: 0,
            totalNetBalance: 0,
            cashExceededPartnerCount: 0,
            transferPricingRequiredCount: 0,
          },
        };
      }

      // Partner adószám térkép
      const partnerMapByTax = new Map<string, any>();
      const partnerMapByName = new Map<string, any>();

      relatedPartners.forEach(p => {
        if (p.tax_number) {
          const clean = p.tax_number.startsWith('FOREIGN:')
            ? p.tax_number
            : p.tax_number.replace(/-/g, '').replace(/^HU/i, '').substring(0, 8);
          partnerMapByTax.set(clean, p);
        }
        if (p.name) {
          partnerMapByName.set(p.name.toLowerCase().trim(), p);
        }
      });

      // 3. Dátumhatárok beállítása
      const effectiveFrom = dateFrom || (year ? `${year}-01-01` : undefined);
      const effectiveTo = dateTo || (year ? `${year}-12-31` : undefined);

      // 4. Számlák lekérése párhuzamosan (nav_invoices és uploaded invoices)
      let navQuery = supabase
        .from('nav_invoices')
        .select('id, invoice_number, issue_date, delivery_date, payment_due_date, supplier_tax_number, supplier_name, customer_tax_number, customer_name, net_amount, vat_amount, gross_amount, currency, payment_method, is_settled')
        .eq('company_id', companyId);

      if (effectiveFrom) navQuery = navQuery.gte('delivery_date', effectiveFrom);
      if (effectiveTo) navQuery = navQuery.lte('delivery_date', effectiveTo);

      let upQuery = supabase
        .from('invoices')
        .select('id, sorszam, szamla_kelte, teljesites_datuma, fizetesi_hatarido, elado_vat_id, elado_nev, vevo_vat_id, vevo_nev, fizetendo_osszeg, afa_osszeg, fizetesi_mod, statusz')
        .eq('company_id', companyId);

      if (effectiveFrom) upQuery = upQuery.gte('teljesites_datuma', effectiveFrom);
      if (effectiveTo) upQuery = upQuery.lte('teljesites_datuma', effectiveTo);

      const [{ data: navInvoices, error: navErr }, { data: upInvoices, error: upErr }] = await Promise.all([
        navQuery,
        upQuery,
      ]);

      if (navErr) console.warn('Nav invoices query error:', navErr);
      if (upErr) console.warn('Uploaded invoices query error:', upErr);

      // 5. Számlák hozzárendelése a kapcsolt partnerekhez
      const partnerInvoicesMap = new Map<string, RelatedPartyInvoiceItem[]>();
      relatedPartners.forEach(p => partnerInvoicesMap.set(p.id, []));

      // 5a. NAV számlák feldolgozása
      (navInvoices || []).forEach(nav => {
        const suppTax = (nav.supplier_tax_number || '').replace(/-/g, '').replace(/^HU/i, '').substring(0, 8);
        const custTax = (nav.customer_tax_number || '').replace(/-/g, '').replace(/^HU/i, '').substring(0, 8);

        const isSupplierRelated = partnerMapByTax.get(suppTax);
        const isCustomerRelated = partnerMapByTax.get(custTax);

        const matchedPartner = isSupplierRelated || isCustomerRelated ||
          partnerMapByName.get((nav.supplier_name || '').toLowerCase().trim()) ||
          partnerMapByName.get((nav.customer_name || '').toLowerCase().trim());

        if (!matchedPartner) return;

        // Érvényességi időszak ellenőrzése
        const deliveryDate = nav.delivery_date || nav.issue_date;
        if (matchedPartner.valid_from && deliveryDate < matchedPartner.valid_from) return;
        if (matchedPartner.valid_to && deliveryDate > matchedPartner.valid_to) return;

        // Irány meghatározása: ha a saját cégünk a vevő -> inbound (beszállítói számla a kapcsolt partnertől)
        // ha a saját cégünk az eladó -> outbound (vevői számla a kapcsolt partnernek)
        const isOutbound = suppTax === ownCleanTax;
        const direction: 'inbound' | 'outbound' = isOutbound ? 'outbound' : 'inbound';
        const isCash = isCashPayment(nav.payment_method);

        const item: RelatedPartyInvoiceItem = {
          id: nav.id,
          source: 'nav',
          invoice_number: nav.invoice_number,
          issue_date: nav.issue_date,
          delivery_date: nav.delivery_date,
          due_date: nav.payment_due_date,
          direction,
          net_amount: Number(nav.net_amount) || 0,
          vat_amount: Number(nav.vat_amount) || 0,
          gross_amount: Number(nav.gross_amount) || 0,
          currency: nav.currency || 'HUF',
          payment_method: nav.payment_method || 'Átutalás',
          is_cash: isCash,
          paid: !!nav.is_settled,
        };

        const list = partnerInvoicesMap.get(matchedPartner.id) || [];
        list.push(item);
        partnerInvoicesMap.set(matchedPartner.id, list);
      });

      // 5b. Feltöltött számlák feldolgozása (duplikáció kiszűrése sorszám alapján)
      (upInvoices || []).forEach(up => {
        const suppTax = (up.elado_vat_id || '').replace(/-/g, '').replace(/^HU/i, '').substring(0, 8);
        const custTax = (up.vevo_vat_id || '').replace(/-/g, '').replace(/^HU/i, '').substring(0, 8);

        const isSupplierRelated = partnerMapByTax.get(suppTax);
        const isCustomerRelated = partnerMapByTax.get(custTax);

        const matchedPartner = isSupplierRelated || isCustomerRelated ||
          partnerMapByName.get((up.elado_nev || '').toLowerCase().trim()) ||
          partnerMapByName.get((up.vevo_nev || '').toLowerCase().trim());

        if (!matchedPartner) return;

        const deliveryDate = up.teljesites_datuma || up.szamla_kelte;
        if (matchedPartner.valid_from && deliveryDate < matchedPartner.valid_from) return;
        if (matchedPartner.valid_to && deliveryDate > matchedPartner.valid_to) return;

        const list = partnerInvoicesMap.get(matchedPartner.id) || [];
        // Ha NAV-ból már benne van ugyanez a számlasorszám, nem duplázzuk
        if (list.some(i => i.invoice_number === up.sorszam)) return;

        const isOutbound = suppTax === ownCleanTax;
        const direction: 'inbound' | 'outbound' = isOutbound ? 'outbound' : 'inbound';
        const isCash = isCashPayment(up.fizetesi_mod);
        const gross = Number(up.fizetendo_osszeg) || 0;
        const vat = Number(up.afa_osszeg) || 0;
        const net = Math.max(0, gross - vat);

        const item: RelatedPartyInvoiceItem = {
          id: up.id,
          source: 'uploaded',
          invoice_number: up.sorszam,
          issue_date: up.szamla_kelte,
          delivery_date: up.teljesites_datuma,
          due_date: up.fizetesi_hatarido,
          direction,
          net_amount: net,
          vat_amount: vat,
          gross_amount: gross,
          currency: 'HUF',
          payment_method: up.fizetesi_mod || 'Átutalás',
          is_cash: isCash,
          paid: up.statusz === 'paid',
        };

        list.push(item);
        partnerInvoicesMap.set(matchedPartner.id, list);
      });

      // 6. Összesítések kiszámítása partnerenként
      const currentMonthPrefix = new Date().toISOString().slice(0, 7); // pl. '2026-09'

      const items: RelatedPartyTurnoverItem[] = relatedPartners.map(p => {
        const invs = partnerInvoicesMap.get(p.id) || [];

        let outboundCount = 0;
        let outboundNet = 0;
        let outboundVat = 0;
        let outboundGross = 0;

        let inboundCount = 0;
        let inboundNet = 0;
        let inboundVat = 0;
        let inboundGross = 0;

        let monthlyCashGross = 0;

        invs.forEach(inv => {
          if (inv.direction === 'outbound') {
            outboundCount++;
            outboundNet += inv.net_amount;
            outboundVat += inv.vat_amount;
            outboundGross += inv.gross_amount;
          } else {
            inboundCount++;
            inboundNet += inv.net_amount;
            inboundVat += inv.vat_amount;
            inboundGross += inv.gross_amount;
          }

          // Készpénzes forgalom figyelése az aktuális hónapra
          if (inv.is_cash && inv.delivery_date?.startsWith(currentMonthPrefix)) {
            monthlyCashGross += inv.gross_amount;
          }
        });

        const totalGrossTurnover = outboundGross + inboundGross;
        const netBalance = outboundGross - inboundGross;
        const isCashLimitExceeded = monthlyCashGross > 1500000;
        const isTransferPricingDocRequired = totalGrossTurnover >= 100000000;

        return {
          partnerId: p.id,
          partnerName: p.name,
          taxNumber: p.tax_number,
          relationType: (p.relation_type as RelationType) || 'sister',
          ownershipPercent: p.ownership_percent,
          validFrom: p.valid_from,
          validTo: p.valid_to,
          parentPartnerName: (p.parent_partner as any)?.name || null,
          customGlAccount: (p.custom_gl_account as any) || null,
          outboundCount,
          outboundNet: Math.round(outboundNet),
          outboundVat: Math.round(outboundVat),
          outboundGross: Math.round(outboundGross),
          inboundCount,
          inboundNet: Math.round(inboundNet),
          inboundVat: Math.round(inboundVat),
          inboundGross: Math.round(inboundGross),
          totalGrossTurnover: Math.round(totalGrossTurnover),
          netBalance: Math.round(netBalance),
          monthlyCashGross: Math.round(monthlyCashGross),
          isCashLimitExceeded,
          isTransferPricingDocRequired,
          invoices: invs.sort((a, b) => (b.delivery_date || '').localeCompare(a.delivery_date || '')),
        };
      });

      // 7. Globális összesítők
      let totalOutboundGross = 0;
      let totalInboundGross = 0;
      let cashExceededPartnerCount = 0;
      let transferPricingRequiredCount = 0;

      items.forEach(it => {
        totalOutboundGross += it.outboundGross;
        totalInboundGross += it.inboundGross;
        if (it.isCashLimitExceeded) cashExceededPartnerCount++;
        if (it.isTransferPricingDocRequired) transferPricingRequiredCount++;
      });

      const totals: RelatedPartyTurnoverTotals = {
        partnerCount: items.length,
        totalOutboundGross,
        totalInboundGross,
        totalGrossTurnover: totalOutboundGross + totalInboundGross,
        totalNetBalance: totalOutboundGross - totalInboundGross,
        cashExceededPartnerCount,
        transferPricingRequiredCount,
      };

      return { items, totals };
    },
    enabled: !!companyId,
    staleTime: 60 * 1000,
  });
}
