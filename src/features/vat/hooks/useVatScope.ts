import { useState, useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { VatScope, VatFrequency } from '../types';

export interface UseVatScopeParams {
  companyId?: string | null;
  year?: number;
  month?: number;
  frequency?: VatFrequency;
}

export interface MissingImageDeductions {
  missingNetEft: number;
  missingVatEft: number;
  missing27BaseEft: number;
  missing27TaxEft: number;
  missing18BaseEft: number;
  missing18TaxEft: number;
  missing5BaseEft: number;
  missing5TaxEft: number;
  missingFadBaseEft: number;
  missingFadTaxEft: number;
  missingExemptBaseEft: number;
}

export interface UseVatScopeResult {
  vatScope: VatScope;
  setVatScope: (newScope: VatScope) => void;
  totalInboundCount: number;
  withImageInboundCount: number;
  missingImageCount: number;
  missingDeductions?: MissingImageDeductions;
  isLoadingCounts: boolean;
}

/**
 * useVatScope
 * ============================================================================
 * Manages the VAT processing scope ('all' vs 'with_image') with two-way URL
 * query parameter (?vat_scope=...) and localStorage persistence.
 * Computes live invoice counts and missing image counts for the selected period.
 * ============================================================================
 */
export function useVatScope({
  companyId,
  year,
  month,
  frequency = 'H',
}: UseVatScopeParams = {}): UseVatScopeResult {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlScope = searchParams.get('vat_scope') as VatScope | null;

  const storageKey = companyId ? `visibill_vat_scope_${companyId}` : 'visibill_vat_scope';

  const [scopeState, setScopeState] = useState<VatScope>(() => {
    if (urlScope === 'all' || urlScope === 'with_image') return urlScope;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved === 'all' || saved === 'with_image') return saved;
    } catch {
      // ignore storage access errors
    }
    return 'all';
  });

  // Sync state if URL changes externally
  useEffect(() => {
    if (urlScope === 'all' || urlScope === 'with_image') {
      if (urlScope !== scopeState) {
        setScopeState(urlScope);
      }
    }
  }, [urlScope]);

  const setVatScope = useCallback(
    (newScope: VatScope) => {
      setScopeState(newScope);
      try {
        localStorage.setItem(storageKey, newScope);
      } catch {
        // ignore
      }

      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (newScope === 'all') {
            next.delete('vat_scope');
          } else {
            next.set('vat_scope', newScope);
          }
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams, storageKey]
  );

  // Compute period dates for counts
  const { dateFrom, dateTo } = useMemo(() => {
    if (!year || !month) return { dateFrom: '', dateTo: '' };
    if (frequency === 'H') {
      const from = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return { dateFrom: from, dateTo: to };
    } else if (frequency === 'N') {
      const startMonth = (month - 1) * 3 + 1;
      const from = `${year}-${String(startMonth).padStart(2, '0')}-01`;
      const endMonth = startMonth + 2;
      const lastDay = new Date(year, endMonth, 0).getDate();
      const to = `${year}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return { dateFrom: from, dateTo: to };
    } else {
      return { dateFrom: `${year}-01-01`, dateTo: `${year}-12-31` };
    }
  }, [year, month, frequency]);

  // Query live inbound counts
  const { data: countsData, isLoading: isLoadingCounts } = useQuery({
    queryKey: ['vat_scope_inbound_counts', companyId, dateFrom, dateTo],
    queryFn: async () => {
      if (!companyId || !dateFrom || !dateTo) {
        return { total: 0, withImage: 0, missing: 0 };
      }

      const [navRes, subRes] = await Promise.all([
        supabase
          .from('nav_invoices')
          .select('id, invoice_number, invoice_net_amount, invoice_vat_amount, vat_row_override, is_reverse_charge')
          .eq('company_id', companyId)
          .eq('invoice_direction', 'INBOUND')
          .or(`invoice_delivery_date.gte.${dateFrom},and(invoice_delivery_date.is.null,invoice_issue_date.gte.${dateFrom})`)
          .or(`invoice_delivery_date.lte.${dateTo},and(invoice_delivery_date.is.null,invoice_issue_date.lte.${dateTo})`)
          .limit(5000),
        supabase
          .from('invoices')
          .select('id, bizonylatsorszam, adoalap_osszesen, afa_osszeg_osszesen, vat_row_override, is_reverse_charge, forditott_adozas, image_url, melleklet_url, invoice_uploads_id, attachments')
          .eq('company_id', companyId)
          .or('invoice_direction.eq.INBOUND,invoice_direction.is.null')
          .or(`teljesites_datuma.gte.${dateFrom},and(teljesites_datuma.is.null,kibocsatas_datuma.gte.${dateFrom})`)
          .or(`teljesites_datuma.lte.${dateTo},and(teljesites_datuma.is.null,kibocsatas_datuma.lte.${dateTo})`)
          .limit(5000),
      ]);

      const navInvs = navRes.data || [];
      const subInvs = subRes.data || [];

      const norm = (s?: string | null) => (s || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();

      // Map of submitted invoices with actual images
      const subWithImageByNum = new Map<string, boolean>();
      subInvs.forEach((s) => {
        const hasImg = Boolean(
          s.image_url ||
            s.melleklet_url ||
            s.invoice_uploads_id ||
            (Array.isArray(s.attachments) && s.attachments.length > 0)
        );
        if (hasImg && s.bizonylatsorszam) {
          subWithImageByNum.set(norm(s.bizonylatsorszam), true);
        }
      });

      const navNumbers = new Set<string>();
      let navWithImage = 0;

      let missing27Base = 0;
      let missing27Tax = 0;
      let missing18Base = 0;
      let missing18Tax = 0;
      let missing5Base = 0;
      let missing5Tax = 0;
      let missingFadBase = 0;
      let missingFadTax = 0;
      let missingExemptBase = 0;
      let totalMissingNet = 0;
      let totalMissingTax = 0;

      const classifyMissing = (net: number, vat: number, isFad: boolean, vatRowOverride?: string | null) => {
        totalMissingNet += net;
        totalMissingTax += vat;

        if (isFad) {
          const fadTax = vat > 0 ? vat : Math.round(net * 0.27);
          missingFadBase += net;
          missingFadTax += fadTax;
          return;
        }

        const rate = net > 0 ? vat / net : 0;
        const percent = Math.round(rate * 100);

        if (vatRowOverride === '66' || percent >= 24) {
          missing27Base += net;
          missing27Tax += vat;
        } else if (vatRowOverride === '65' || (percent >= 14 && percent <= 20)) {
          missing18Base += net;
          missing18Tax += vat;
        } else if (vatRowOverride === '64' || (percent >= 4 && percent <= 7)) {
          missing5Base += net;
          missing5Tax += vat;
        } else {
          missingExemptBase += net;
        }
      };

      navInvs.forEach((n) => {
        const num = norm(n.invoice_number);
        if (num) {
          navNumbers.add(num);
          if (subWithImageByNum.has(num)) {
            navWithImage++;
          } else {
            const net = Number(n.invoice_net_amount || 0);
            const vat = Number(n.invoice_vat_amount || 0);
            const isFad = Boolean(n.is_reverse_charge) || n.vat_row_override === '29' || n.vat_row_override === '04';
            classifyMissing(net, vat, isFad, n.vat_row_override);
          }
        }
      });

      // Standalone submitted invoices with image not present in nav_invoices
      let standaloneWithImage = 0;
      subInvs.forEach((s) => {
        const num = norm(s.bizonylatsorszam);
        const hasImg = Boolean(
          s.image_url ||
            s.melleklet_url ||
            s.invoice_uploads_id ||
            (Array.isArray(s.attachments) && s.attachments.length > 0)
        );
        if (num && !navNumbers.has(num)) {
          if (hasImg) {
            standaloneWithImage++;
          } else {
            const net = Number(s.adoalap_osszesen || 0);
            const vat = Number(s.afa_osszeg_osszesen || 0);
            const isFad =
              Boolean(s.is_reverse_charge) ||
              Boolean((s as any).forditott_adozas) ||
              s.vat_row_override === '29' ||
              s.vat_row_override === '04';
            classifyMissing(net, vat, isFad, s.vat_row_override);
          }
        }
      });

      const totalUniqueInbounds = navNumbers.size + standaloneWithImage;
      const totalWithImage = navWithImage + standaloneWithImage;
      const missing = Math.max(0, totalUniqueInbounds - totalWithImage);

      const deductions: MissingImageDeductions = {
        missingNetEft: Math.round(totalMissingNet / 1000),
        missingVatEft: Math.round(totalMissingTax / 1000),
        missing27BaseEft: Math.round(missing27Base / 1000),
        missing27TaxEft: Math.round(missing27Tax / 1000),
        missing18BaseEft: Math.round(missing18Base / 1000),
        missing18TaxEft: Math.round(missing18Tax / 1000),
        missing5BaseEft: Math.round(missing5Base / 1000),
        missing5TaxEft: Math.round(missing5Tax / 1000),
        missingFadBaseEft: Math.round(missingFadBase / 1000),
        missingFadTaxEft: Math.round(missingFadTax / 1000),
        missingExemptBaseEft: Math.round(missingExemptBase / 1000),
      };

      return {
        total: totalUniqueInbounds,
        withImage: totalWithImage,
        missing,
        deductions,
      };
    },
    enabled: Boolean(companyId && dateFrom && dateTo),
    staleTime: 30_000,
  });

  return {
    vatScope: scopeState,
    setVatScope,
    totalInboundCount: countsData?.total ?? 0,
    withImageInboundCount: countsData?.withImage ?? 0,
    missingImageCount: countsData?.missing ?? 0,
    missingDeductions: countsData?.deductions,
    isLoadingCounts,
  };
}
