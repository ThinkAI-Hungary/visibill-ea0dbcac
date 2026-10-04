import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Search,
  X,
  FileX2,
  ChevronDown,
  ChevronRight,
  Info,
  Building2,
  Calendar,
  Layers,
  ArrowUpDown,
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import type { VatFrequency } from '../types';

export interface NonDeclarableItem {
  id: string;
  source: 'nav' | 'app';
  invoice_number: string;
  partner_name: string;
  partner_tax_number?: string | null;
  date: string;
  line_description: string;
  net_amount: number;
  vat_amount: number;
  gross_amount: number;
  reason: 'AAM' | 'TAM' | 'DRS' | 'EXCLUDED' | 'OTHER';
  reasonLabel: string;
  badgeClass: string;
}

interface VatNonDeclarableItemsSectionProps {
  companyId?: string;
  year: number;
  month: number;
  frequency: VatFrequency;
  isCroatia?: boolean;
}

export function VatNonDeclarableItemsSection({
  companyId,
  year,
  month,
  frequency,
  isCroatia = false,
}: VatNonDeclarableItemsSectionProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'AAM' | 'TAM' | 'DRS' | 'OTHER'>('ALL');
  const [isExpanded, setIsExpanded] = useState(true);

  // Compute period date range
  const { dateFrom, dateTo } = useMemo(() => {
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

  // Fetch non-declarable inbound items
  const { data: items = [], isLoading } = useQuery<NonDeclarableItem[]>({
    queryKey: ['vat_non_declarable_items', companyId, dateFrom, dateTo],
    queryFn: async () => {
      if (!companyId || !dateFrom || !dateTo) return [];

      // 1. Fetch inbound NAV invoices with items
      const { data: navInvs, error: navErr } = await supabase
        .from('nav_invoices')
        .select(`
          id, invoice_number, supplier_name, supplier_tax_number, invoice_delivery_date, invoice_issue_date,
          invoice_net_amount, invoice_vat_amount, is_reverse_charge, vat_row_override,
          nav_invoice_items(id, line_number, line_description, net_amount, vat_amount, vat_rate, exclude_from_accounting)
        `)
        .eq('company_id', companyId)
        .eq('invoice_direction', 'INBOUND')
        .or(`and(invoice_delivery_date.gte.${dateFrom},invoice_delivery_date.lte.${dateTo}),and(invoice_delivery_date.is.null,invoice_issue_date.gte.${dateFrom},invoice_issue_date.lte.${dateTo})`);

      if (navErr) {
        console.error('Error fetching nav_invoices for non-declarable items:', navErr);
      }

      // 2. Fetch inbound uploaded/manual invoices with items
      const { data: appInvs, error: appErr } = await supabase
        .from('invoices')
        .select(`
          id, bizonylatsorszam, elado_nev, elado_vat_id, teljesites_datuma, kibocsatas_datuma,
          adoalap_osszesen, afa_osszeg_osszesen, exclude_from_accounting, forditott_adozas, vat_row_override,
          invoice_items(id, line_number, line_description, net_amount, vat_amount, vat_rate, exclude_from_accounting)
        `)
        .eq('company_id', companyId)
        .eq('invoice_direction', 'INBOUND')
        .or(`and(teljesites_datuma.gte.${dateFrom},teljesites_datuma.lte.${dateTo}),and(teljesites_datuma.is.null,kibocsatas_datuma.gte.${dateFrom},kibocsatas_datuma.lte.${dateTo})`);

      if (appErr) {
        console.error('Error fetching invoices for non-declarable items:', appErr);
      }

      const list: NonDeclarableItem[] = [];
      const seenInvoiceNumbers = new Set<string>();

      // Process NAV invoices
      for (const ni of navInvs || []) {
        const normNum = (ni.invoice_number || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        if (normNum) seenInvoiceNumbers.add(normNum);

        const sTax = ni.supplier_tax_number || '';
        const digits = sTax.replace(/\D/g, '');
        const isTaxAam = digits.length >= 9 && digits.substring(8, 9) === '1';
        const sName = (ni.supplier_name || '').toLowerCase();
        const isNameAam = sName.includes('alanyi adómentes') || sName.includes('alanyi mentes') || sName.includes('(aam)');
        const isInsurance = sName.includes('biztosító') || sName.includes('biztositó') || sName.includes('biztosítás') ||
          sName.includes('generali') || sName.includes('allianz') || sName.includes('groupama') || sName.includes('uniqa');

        const navItems = ni.nav_invoice_items && ni.nav_invoice_items.length > 0 ? ni.nav_invoice_items : null;

        if (navItems) {
          for (const it of navItems) {
            const net = Number(it.net_amount || 0);
            const vat = Number(it.vat_amount || 0);
            const desc = (it.line_description || '').toLowerCase();
            const rate = String(it.vat_rate || '').toLowerCase();

            // Reverse charge items are handled in Row 29/66, not here
            if (ni.is_reverse_charge || rate.includes('fad') || ni.vat_row_override === '29') {
              continue;
            }

            const isDrs = desc.includes('visszavált') || desc.includes('visszavalt') || desc.includes('drs') ||
              desc.includes('betétdíj') || desc.includes('betetdij') || desc.includes('palackdíj');
            const isItemAam = isTaxAam || isNameAam || rate === 'aam' || rate.includes('alanyi');
            const isItemTam = isInsurance || rate === 'tam' || desc.includes('biztosítás') || desc.includes('biztositas');
            const isExcl = it.exclude_from_accounting === true;
            const isZeroVat = vat === 0 && net !== 0;

            if (isDrs || isItemAam || isItemTam || isExcl || isZeroVat) {
              let reason: 'AAM' | 'TAM' | 'DRS' | 'EXCLUDED' | 'OTHER' = 'OTHER';
              let reasonLabel = 'Bevallásban nem szereplő beszerzés';
              let badgeClass = 'bg-muted text-muted-foreground border-border/40';

              if (isDrs) {
                reason = 'DRS';
                reasonLabel = 'DRS visszaváltási díj (Áfa tv. 77. §)';
                badgeClass = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
              } else if (isItemAam) {
                reason = 'AAM';
                reasonLabel = 'Alanyi adómentes (AAM) beszerzés';
                badgeClass = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
              } else if (isItemTam) {
                reason = 'TAM';
                reasonLabel = 'Tárgyi adómentes (TAM) biztosítás/pénzügyi';
                badgeClass = 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20';
              } else if (isExcl) {
                reason = 'EXCLUDED';
                reasonLabel = 'Könyvelésből/ÁFÁ-ból kizárva';
                badgeClass = 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';
              } else {
                reason = 'OTHER';
                reasonLabel = 'Levonási jog nélküli egyéb beszerzés (0% ÁFA)';
                badgeClass = 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20';
              }

              list.push({
                id: it.id || `${ni.id}-${it.line_number}`,
                source: 'nav',
                invoice_number: ni.invoice_number,
                partner_name: ni.supplier_name || 'Ismeretlen partner',
                partner_tax_number: ni.supplier_tax_number,
                date: ni.invoice_delivery_date || ni.invoice_issue_date || '',
                line_description: it.line_description || 'Számlatétel',
                net_amount: net,
                vat_amount: vat,
                gross_amount: net + vat,
                reason,
                reasonLabel,
                badgeClass,
              });
            }
          }
        } else {
          // Invoice header only
          const net = Number(ni.invoice_net_amount || 0);
          const vat = Number(ni.invoice_vat_amount || 0);
          if (vat === 0 && net !== 0) {
            const isItemAam = isTaxAam || isNameAam;
            const isItemTam = isInsurance;

            list.push({
              id: ni.id,
              source: 'nav',
              invoice_number: ni.invoice_number,
              partner_name: ni.supplier_name || 'Ismeretlen partner',
              partner_tax_number: ni.supplier_tax_number,
              date: ni.invoice_delivery_date || ni.invoice_issue_date || '',
              line_description: 'Számla tételek összesen',
              net_amount: net,
              vat_amount: vat,
              gross_amount: net + vat,
              reason: isItemAam ? 'AAM' : isItemTam ? 'TAM' : 'OTHER',
              reasonLabel: isItemAam ? 'Alanyi adómentes (AAM) beszerzés' : isItemTam ? 'Tárgyi adómentes (TAM) biztosítás' : 'Levonási jog nélküli beszerzés',
              badgeClass: isItemAam ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
            });
          }
        }
      }

      // Process uploaded invoices (dedupe if already parsed from NAV)
      for (const inv of appInvs || []) {
        const normNum = (inv.bizonylatsorszam || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        if (normNum && seenInvoiceNumbers.has(normNum)) {
          continue; // Already processed via NAV
        }

        const sTax = inv.elado_vat_id || '';
        const digits = sTax.replace(/\D/g, '');
        const isTaxAam = digits.length >= 9 && digits.substring(8, 9) === '1';
        const sName = (inv.elado_nev || '').toLowerCase();
        const isNameAam = sName.includes('alanyi adómentes') || sName.includes('alanyi mentes') || sName.includes('(aam)');
        const isInsurance = sName.includes('biztosító') || sName.includes('biztositó') || sName.includes('biztosítás') ||
          sName.includes('generali') || sName.includes('allianz') || sName.includes('groupama') || sName.includes('uniqa');

        const invItems = inv.invoice_items && inv.invoice_items.length > 0 ? inv.invoice_items : null;

        if (invItems) {
          for (const it of invItems) {
            const net = Number(it.net_amount || 0);
            const vat = Number(it.vat_amount || 0);
            const desc = (it.line_description || '').toLowerCase();
            const rate = String(it.vat_rate || '').toLowerCase();

            if (inv.forditott_adozas || rate.includes('fad') || inv.vat_row_override === '29') {
              continue;
            }

            const isDrs = desc.includes('visszavált') || desc.includes('visszavalt') || desc.includes('drs') ||
              desc.includes('betétdíj') || desc.includes('betetdij') || desc.includes('palackdíj');
            const isItemAam = isTaxAam || isNameAam || rate === 'aam' || rate.includes('alanyi');
            const isItemTam = isInsurance || rate === 'tam' || desc.includes('biztosítás') || desc.includes('biztositas');
            const isExcl = it.exclude_from_accounting === true || inv.exclude_from_accounting === true;
            const isZeroVat = vat === 0 && net !== 0;

            if (isDrs || isItemAam || isItemTam || isExcl || isZeroVat) {
              let reason: 'AAM' | 'TAM' | 'DRS' | 'EXCLUDED' | 'OTHER' = 'OTHER';
              let reasonLabel = 'Bevallásban nem szereplő beszerzés';
              let badgeClass = 'bg-muted text-muted-foreground border-border/40';

              if (isDrs) {
                reason = 'DRS';
                reasonLabel = 'DRS visszaváltási díj (Áfa tv. 77. §)';
                badgeClass = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
              } else if (isItemAam) {
                reason = 'AAM';
                reasonLabel = 'Alanyi adómentes (AAM) beszerzés';
                badgeClass = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
              } else if (isItemTam) {
                reason = 'TAM';
                reasonLabel = 'Tárgyi adómentes (TAM) biztosítás/pénzügyi';
                badgeClass = 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20';
              } else if (isExcl) {
                reason = 'EXCLUDED';
                reasonLabel = 'Könyvelésből/ÁFÁ-ból kizárva';
                badgeClass = 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';
              } else {
                reason = 'OTHER';
                reasonLabel = 'Levonási jog nélküli egyéb beszerzés (0% ÁFA)';
                badgeClass = 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20';
              }

              list.push({
                id: it.id || `${inv.id}-${it.line_number}`,
                source: 'app',
                invoice_number: inv.bizonylatsorszam,
                partner_name: inv.elado_nev || 'Ismeretlen partner',
                partner_tax_number: inv.elado_vat_id,
                date: inv.teljesites_datuma || inv.kibocsatas_datuma || '',
                line_description: it.line_description || 'Számlatétel',
                net_amount: net,
                vat_amount: vat,
                gross_amount: net + vat,
                reason,
                reasonLabel,
                badgeClass,
              });
            }
          }
        } else {
          const net = Number(inv.adoalap_osszesen || 0);
          const vat = Number(inv.afa_osszeg_osszesen || 0);
          if (vat === 0 && net !== 0) {
            const isItemAam = isTaxAam || isNameAam;
            const isItemTam = isInsurance;

            list.push({
              id: inv.id,
              source: 'app',
              invoice_number: inv.bizonylatsorszam,
              partner_name: inv.elado_nev || 'Ismeretlen partner',
              partner_tax_number: inv.elado_vat_id,
              date: inv.teljesites_datuma || inv.kibocsatas_datuma || '',
              line_description: 'Számla tételek összesen',
              net_amount: net,
              vat_amount: vat,
              gross_amount: net + vat,
              reason: isItemAam ? 'AAM' : isItemTam ? 'TAM' : 'OTHER',
              reasonLabel: isItemAam ? 'Alanyi adómentes (AAM) beszerzés' : isItemTam ? 'Tárgyi adómentes (TAM) biztosítás' : 'Levonási jog nélküli beszerzés',
              badgeClass: isItemAam ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
            });
          }
        }
      }

      return list.sort((a, b) => (b.net_amount - a.net_amount));
    },
    enabled: !!companyId,
  });

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (selectedFilter !== 'ALL' && item.reason !== selectedFilter) {
        return false;
      }
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const numMatch = (item.invoice_number || '').toLowerCase().includes(q);
        const nameMatch = (item.partner_name || '').toLowerCase().includes(q);
        const taxMatch = (item.partner_tax_number || '').toLowerCase().includes(q);
        const descMatch = (item.line_description || '').toLowerCase().includes(q);
        if (!numMatch && !nameMatch && !taxMatch && !descMatch) {
          return false;
        }
      }
      return true;
    });
  }, [items, selectedFilter, searchTerm]);

  const totalNet = useMemo(() => {
    return filteredItems.reduce((sum, it) => sum + it.net_amount, 0);
  }, [filteredItems]);

  const totalAllNet = useMemo(() => {
    return items.reduce((sum, it) => sum + it.net_amount, 0);
  }, [items]);

  const countsByReason = useMemo(() => {
    const counts = { AAM: 0, TAM: 0, DRS: 0, OTHER: 0 };
    items.forEach((it) => {
      if (it.reason === 'AAM') counts.AAM++;
      else if (it.reason === 'TAM') counts.TAM++;
      else if (it.reason === 'DRS') counts.DRS++;
      else counts.OTHER++;
    });
    return counts;
  }, [items]);

  return (
    <Card className="border-border/60 overflow-hidden">
      <CardHeader className="pb-3 border-b border-border/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-muted/5">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Összecsukás' : 'Lenyitás'}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <FileX2 className="w-4 h-4 text-muted-foreground/70" />
              Bevallásban nem szereplő tételek
              <Badge variant="secondary" className="text-xs font-mono">
                {filteredItems.length === items.length
                  ? `${items.length} tétel`
                  : `${filteredItems.length} / ${items.length} tétel`}
              </Badge>
              {items.length > 0 && (
                <Badge variant="outline" className="text-xs font-mono font-medium text-foreground/80">
                  {formatCurrency(totalNet, isCroatia ? 'EUR' : 'HUF')}
                </Badge>
              )}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Olyan belföldi bejövő tételek (AAM alanyi mentes, TAM biztosítás, DRS betétdíj), amelyekhez nem kapcsolódik levonható ÁFA, így nem kerülnek be a 2665-ös bevallás soraiba.
            </p>
          </div>
        </div>

        {items.length > 0 && isExpanded && (
          <div className="relative w-full sm:w-64 print:hidden">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Keresés partner/számla/tétel..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-8 text-xs bg-muted/30 focus:bg-background transition-colors"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={() => setSearchTerm('')}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </CardHeader>

      {isExpanded && (
        <CardContent className="p-0">
          {/* Quick Filter Tabs */}
          {items.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-border/30 bg-muted/10 text-xs">
              <span className="text-muted-foreground font-medium flex items-center gap-1 mr-1">
                <Layers className="w-3.5 h-3.5" />
                Szűrés:
              </span>
              <Button
                size="sm"
                variant={selectedFilter === 'ALL' ? 'default' : 'outline'}
                className="h-6 text-xs px-2.5 rounded-full"
                onClick={() => setSelectedFilter('ALL')}
              >
                Mind ({items.length})
              </Button>
              {countsByReason.AAM > 0 && (
                <Button
                  size="sm"
                  variant={selectedFilter === 'AAM' ? 'default' : 'outline'}
                  className={cn(
                    'h-6 text-xs px-2.5 rounded-full',
                    selectedFilter === 'AAM' ? 'bg-emerald-600 text-white' : 'text-emerald-600 dark:text-emerald-400'
                  )}
                  onClick={() => setSelectedFilter('AAM')}
                >
                  Alanyi mentes ({countsByReason.AAM})
                </Button>
              )}
              {countsByReason.TAM > 0 && (
                <Button
                  size="sm"
                  variant={selectedFilter === 'TAM' ? 'default' : 'outline'}
                  className={cn(
                    'h-6 text-xs px-2.5 rounded-full',
                    selectedFilter === 'TAM' ? 'bg-sky-600 text-white' : 'text-sky-600 dark:text-sky-400'
                  )}
                  onClick={() => setSelectedFilter('TAM')}
                >
                  Biztosítás / TAM ({countsByReason.TAM})
                </Button>
              )}
              {countsByReason.DRS > 0 && (
                <Button
                  size="sm"
                  variant={selectedFilter === 'DRS' ? 'default' : 'outline'}
                  className={cn(
                    'h-6 text-xs px-2.5 rounded-full',
                    selectedFilter === 'DRS' ? 'bg-amber-600 text-white' : 'text-amber-600 dark:text-amber-400'
                  )}
                  onClick={() => setSelectedFilter('DRS')}
                >
                  DRS betétdíj ({countsByReason.DRS})
                </Button>
              )}
              {countsByReason.OTHER > 0 && (
                <Button
                  size="sm"
                  variant={selectedFilter === 'OTHER' ? 'default' : 'outline'}
                  className="h-6 text-xs px-2.5 rounded-full"
                  onClick={() => setSelectedFilter('OTHER')}
                >
                  Egyéb ({countsByReason.OTHER})
                </Button>
              )}
            </div>
          )}

          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Tételek betöltése...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {items.length === 0
                ? 'Nincsenek bevallásból kizárt tételek ebben az időszakban.'
                : 'Nincs találat a megadott keresési feltételekre.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/40 bg-muted/20 text-muted-foreground font-medium">
                    <th className="py-2 px-4 text-left">Bizonylatszám</th>
                    <th className="py-2 px-4 text-left">Partner</th>
                    <th className="py-2 px-4 text-left">Dátum</th>
                    <th className="py-2 px-4 text-left">Tétel megnevezése</th>
                    <th className="py-2 px-4 text-left">Indoklás / Besorolás</th>
                    <th className="py-2 px-4 text-right">Nettó összeg</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {filteredItems.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-muted/15 transition-colors group"
                    >
                      <td className="py-2.5 px-4 font-mono font-medium text-foreground/90 whitespace-nowrap">
                        {item.invoice_number}
                      </td>
                      <td className="py-2.5 px-4 max-w-[200px] truncate">
                        <div className="font-medium text-foreground/90 truncate" title={item.partner_name}>
                          {item.partner_name}
                        </div>
                        {item.partner_tax_number && (
                          <div className="font-mono text-[10px] text-muted-foreground/70">
                            {item.partner_tax_number}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-muted-foreground whitespace-nowrap">
                        {item.date || '-'}
                      </td>
                      <td className="py-2.5 px-4 text-foreground/80 max-w-[280px] truncate" title={item.line_description}>
                        {item.line_description}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span
                          className={cn(
                            'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border',
                            item.badgeClass
                          )}
                        >
                          {item.reasonLabel}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-medium tabular-nums whitespace-nowrap">
                        {formatCurrency(item.net_amount, isCroatia ? 'EUR' : 'HUF')}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border/50 bg-muted/15 font-semibold text-xs">
                    <td colSpan={5} className="py-2.5 px-4 text-right text-muted-foreground">
                      Összesen ({filteredItems.length} tétel):
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-foreground">
                      {formatCurrency(totalNet, isCroatia ? 'EUR' : 'HUF')}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
