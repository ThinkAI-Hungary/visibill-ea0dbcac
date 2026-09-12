import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileSpreadsheet, ChevronDown, ChevronRight, ChevronLeft, Layers, FileText, Loader2 } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { exportVatCollectorAnalyticsExcel, VatCollectorGroup } from '@/lib/glExport';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

interface VatCollectorAnalyticsViewProps {
  year?: number;
  periodMonth?: number;
}

export function VatCollectorAnalyticsView({ year = new Date().getFullYear(), periodMonth }: VatCollectorAnalyticsViewProps) {
  const { t } = useTranslation(['accounting', 'common']);
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const [expandedCodes, setExpandedCodes] = useState<Set<string>>(new Set(['25', '05', 'FAD']));
  const [isExporting, setIsExporting] = useState(false);

  // Pagination states
  const [pageSize, setPageSize] = useState<number>(20);
  const [groupPages, setGroupPages] = useState<Record<string, number>>({});

  // Query invoice items with VAT codes
  const { data: rawItems = [], isLoading } = useQuery({
    queryKey: ['vatCollectorItems', selectedCompany?.id, year, periodMonth],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];

      const [navInvsRes, subInvsRes] = await Promise.all([
        supabase
          .from('nav_invoices')
          .select('id, invoice_number, supplier_name, customer_name, invoice_delivery_date, invoice_issue_date')
          .eq('company_id', selectedCompany.id),
        supabase
          .from('invoices')
          .select('id, bizonylatsorszam, elado_nev, vevo_nev, teljesites_datuma, kibocsatas_datuma')
          .eq('company_id', selectedCompany.id),
      ]);

      const navInvs = navInvsRes.data || [];
      const subInvs = subInvsRes.data || [];

      const navMap = new Map(navInvs.map((i) => [i.id, i]));
      const subMap = new Map(subInvs.map((i) => [i.id, i]));

      const navIds = navInvs.map((i) => i.id);
      const subIds = subInvs.map((i) => i.id);

      const [navItemsRes, subItemsRes] = await Promise.all([
        navIds.length > 0
          ? supabase
              .from('nav_invoice_items')
              .select('id, nav_invoice_id, net_amount, vat_amount, vat_rate')
              .in('nav_invoice_id', navIds)
          : Promise.resolve({ data: [] }),
        subIds.length > 0
          ? supabase
              .from('invoice_items')
              .select('id, invoice_id, net_amount, vat_amount, vat_rate')
              .in('invoice_id', subIds)
          : Promise.resolve({ data: [] }),
      ]);

      const items: any[] = [];

      const getCode = (rate: string | null) => {
        if (!rate) return '25';
        const u = rate.toUpperCase();
        if (u.includes('FAD')) return 'FAD';
        if (rate === '0.27' || rate === '27' || rate === '27.0' || rate === '27.00') return '25';
        if (rate === '0.05' || rate === '5' || rate === '5.0' || rate === '5.00') return '05';
        if (rate === '0.18' || rate === '18' || rate === '18.0' || rate === '18.00') return '18';
        if (u.includes('AAM')) return 'AAM';
        if (u.includes('TAM')) return 'TAM';
        return '25';
      };

      (navItemsRes.data || []).forEach((i: any) => {
        const inv = navMap.get(i.nav_invoice_id);
        const dateStr = inv?.invoice_delivery_date || inv?.invoice_issue_date || '';
        items.push({
          id: `nav_${i.id}`,
          code: getCode(i.vat_rate),
          invoice_number: inv?.invoice_number || 'Névtelen',
          partner_name: inv?.supplier_name || inv?.customer_name || 'Ismeretlen partner',
          fulfillment_date: dateStr,
          net_amount: Number(i.net_amount) || 0,
          vat_amount: Number(i.vat_amount) || 0,
          gross_amount: (Number(i.net_amount) || 0) + (Number(i.vat_amount) || 0),
        });
      });

      (subItemsRes.data || []).forEach((i: any) => {
        const inv = subMap.get(i.invoice_id);
        const dateStr = inv?.teljesites_datuma || inv?.kibocsatas_datuma || '';
        items.push({
          id: `sub_${i.id}`,
          code: getCode(i.vat_rate),
          invoice_number: inv?.bizonylatsorszam || 'Névtelen',
          partner_name: inv?.elado_nev || inv?.vevo_nev || 'Ismeretlen partner',
          fulfillment_date: dateStr,
          net_amount: Number(i.net_amount) || 0,
          vat_amount: Number(i.vat_amount) || 0,
          gross_amount: (Number(i.net_amount) || 0) + (Number(i.vat_amount) || 0),
        });
      });

      return items;
    },
    enabled: !!selectedCompany?.id,
  });

  const groups = useMemo<VatCollectorGroup[]>(() => {
    const map = new Map<string, VatCollectorGroup>();

    const getLabel = (c: string) => {
      switch (c) {
        case '25': return t('accounting:vat_return.analytics_view.codes.25', 'Normál belföldi 27% (Alapértelmezett NAV Gyűjtőkód 25)');
        case '05': return t('accounting:vat_return.analytics_view.codes.05', 'Kedvezményes belföldi 5%');
        case '18': return t('accounting:vat_return.analytics_view.codes.18', 'Kedvezményes belföldi 18%');
        case 'FAD': return t('accounting:vat_return.analytics_view.codes.FAD', 'Fordított adózás (FAD vas/acél, építőipar, mezőgazdaság)');
        case 'AAM': return t('accounting:vat_return.analytics_view.codes.AAM', 'Alanyi adómentes (AAM)');
        case 'TAM': return t('accounting:vat_return.analytics_view.codes.TAM', 'Tárgyi adómentes (TAM)');
        default: return t('accounting:vat_return.analytics_view.codes.custom', { code: c, defaultValue: `Különleges gyűjtőkód (${c})` });
      }
    };

    rawItems.forEach(item => {
      if (!map.has(item.code)) {
        map.set(item.code, {
          code: item.code,
          label: getLabel(item.code),
          items: [],
          total_net: 0,
          total_vat: 0,
          total_gross: 0,
        });
      }

      const grp = map.get(item.code)!;
      grp.items.push(item);
      grp.total_net += item.net_amount;
      grp.total_vat += item.vat_amount;
      grp.total_gross += item.gross_amount;
    });

    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [rawItems, t]);

  const toggleExpand = (code: string) => {
    setExpandedCodes(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const handleExport = async () => {
    if (groups.length === 0) return;
    setIsExporting(true);
    try {
      await exportVatCollectorAnalyticsExcel(groups, selectedCompany?.name || 'Cég');
      toast({
        title: t('accounting:vat_return.analytics_view.toast_export_success_title', 'Sikeres exportálás'),
        description: t('accounting:vat_return.analytics_view.toast_export_success_desc', 'Az ÁFA Gyűjtőkódos Analitika Excel fájl elkészült.')
      });
    } catch (e: any) {
      toast({ title: t('common:status.error', 'Export hiba'), description: e.message, variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  const totals = useMemo(() => {
    return groups.reduce((acc, g) => ({
      net: acc.net + g.total_net,
      vat: acc.vat + g.total_vat,
      gross: acc.gross + g.total_gross,
    }), { net: 0, vat: 0, gross: 0 });
  }, [groups]);

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
        <div>
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            {t('accounting:vat_return.analytics_view.card_title', 'ÁFA Gyűjtőkód Szerinti Analitikus Kimutatás')}
          </CardTitle>
          <CardDescription>
            {t('accounting:vat_return.analytics_view.card_description', 'NAV adóhatósági ellenőrzéseknek megfelelő bizonylat-analitika ÁFA gyűjtőkódonként csoportosítva (Fakov Kft. elvárás).')}
          </CardDescription>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground font-medium">{t('accounting:vat_return.analytics_view.items_per_page', 'Tétel / oldal:')}</span>
            <Select value={String(pageSize)} onValueChange={(val) => setPageSize(Number(val))}>
              <SelectTrigger className="w-[110px] h-8 text-xs bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">{t('accounting:vat_return.analytics_view.items_count', { count: 10, defaultValue: '10 tétel' })}</SelectItem>
                <SelectItem value="20">{t('accounting:vat_return.analytics_view.items_count', { count: 20, defaultValue: '20 tétel' })}</SelectItem>
                <SelectItem value="50">{t('accounting:vat_return.analytics_view.items_count', { count: 50, defaultValue: '50 tétel' })}</SelectItem>
                <SelectItem value="100">{t('accounting:vat_return.analytics_view.items_count', { count: 100, defaultValue: '100 tétel' })}</SelectItem>
                <SelectItem value="-1">{t('accounting:vat_return.analytics_view.all_items', 'Összes tétel')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleExport}
            disabled={isExporting || groups.length === 0}
            variant="outline"
            className="gap-2 border-primary/30 text-primary hover:bg-primary/10 cursor-pointer h-8 text-xs"
          >
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 text-emerald-600" />}
            {t('accounting:vat_return.analytics_view.export_excel', 'Export (Excel)')}
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="font-medium">{t('accounting:vat_return.analytics_view.empty', 'Nincsenek ÁFA gyűjtőkódos bizonylatok az adott időszakban.')}</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-12 text-center">{t('accounting:vat_return.analytics_view.col_breakdown', 'Bontás')}</TableHead>
                  <TableHead className="font-semibold">{t('accounting:vat_return.analytics_view.col_code_doc', 'ÁFA Gyűjtőkód / Bizonylatszám')}</TableHead>
                  <TableHead className="font-semibold">{t('accounting:vat_return.analytics_view.col_partner_name', 'Partner neve')}</TableHead>
                  <TableHead className="text-center font-semibold">{t('accounting:vat_return.analytics_view.col_fulfillment_date', 'Teljesítés dátuma')}</TableHead>
                  <TableHead className="text-right font-semibold">{t('accounting:vat_return.analytics_view.col_net_amount', 'Nettó alap')}</TableHead>
                  <TableHead className="text-right font-semibold">{t('accounting:vat_return.analytics_view.col_vat_amount', 'ÁFA összeg')}</TableHead>
                  <TableHead className="text-right font-semibold">{t('accounting:vat_return.analytics_view.col_gross_amount', 'Bruttó érték')}</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {groups.map(group => {
                  const isExpanded = expandedCodes.has(group.code);
                  const page = groupPages[group.code] || 1;
                  const totalGroupItems = group.items.length;
                  const totalPages = pageSize === -1 ? 1 : Math.ceil(totalGroupItems / pageSize);
                  const pagedItems = pageSize === -1 ? group.items : group.items.slice((page - 1) * pageSize, page * pageSize);

                  return (
                    <React.Fragment key={group.code}>
                      {/* Group Header Row */}
                      <TableRow
                        onClick={() => toggleExpand(group.code)}
                        className="bg-primary/5 hover:bg-primary/10 cursor-pointer transition-colors border-b border-border/30 font-semibold"
                      >
                        <TableCell className="text-center py-3">
                          {isExpanded ? <ChevronDown className="h-4 w-4 text-primary mx-auto" /> : <ChevronRight className="h-4 w-4 text-primary mx-auto" />}
                        </TableCell>
                        <TableCell colSpan={2} className="py-3">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono bg-primary/10 text-primary border-primary/30">
                              {t('accounting:vat_return.analytics_view.code_badge', { code: group.code, defaultValue: `Gyűjtőkód ${group.code}` })}
                            </Badge>
                            <span>{group.label}</span>
                            <span className="text-xs text-muted-foreground font-normal">
                              {t('accounting:vat_return.analytics_view.doc_count', { count: totalGroupItems, defaultValue: `(${totalGroupItems} bizonylat)` })}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-xs text-muted-foreground">-</TableCell>
                        <TableCell className="text-right font-mono text-foreground font-bold py-3">
                          {formatCurrency(group.total_net, 'HUF')}
                        </TableCell>
                        <TableCell className="text-right font-mono text-primary font-bold py-3">
                          {formatCurrency(group.total_vat, 'HUF')}
                        </TableCell>
                        <TableCell className="text-right font-mono text-foreground font-bold py-3">
                          {formatCurrency(group.total_gross, 'HUF')}
                        </TableCell>
                      </TableRow>

                      {/* Detail Item Rows */}
                      {isExpanded && pagedItems.map((item, index) => (
                        <TableRow key={item.id || `${item.invoice_number}_${index}`} className="hover:bg-muted/30 text-xs transition-colors">
                          <TableCell className="text-center text-muted-foreground/50">•</TableCell>
                          <TableCell className="font-mono font-medium pl-6">
                            {item.invoice_number}
                          </TableCell>
                          <TableCell className="font-medium text-muted-foreground">
                            {item.partner_name}
                          </TableCell>
                          <TableCell className="text-center font-mono text-muted-foreground">
                            {item.fulfillment_date ? item.fulfillment_date.substring(0, 10).replace(/-/g, '.') : '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums">
                            {formatCurrency(item.net_amount, 'HUF')}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-primary font-medium">
                            {formatCurrency(item.vat_amount, 'HUF')}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums font-medium">
                            {formatCurrency(item.gross_amount, 'HUF')}
                          </TableCell>
                        </TableRow>
                      ))}

                      {/* Group Pagination Bar */}
                      {isExpanded && totalGroupItems > (pageSize > 0 ? pageSize : totalGroupItems) && pageSize !== -1 && (
                        <TableRow className="bg-muted/20 hover:bg-muted/20 border-b border-border/30">
                          <TableCell colSpan={7} className="py-2 px-6">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <div>
                                {t('accounting:vat_return.analytics_view.pagination_info', {
                                  from: (page - 1) * pageSize + 1,
                                  to: Math.min(page * pageSize, totalGroupItems),
                                  total: totalGroupItems,
                                  defaultValue: `Megjelenítve: ${(page - 1) * pageSize + 1} - ${Math.min(page * pageSize, totalGroupItems)} / ${totalGroupItems} tétel`
                                })}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={page === 1}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setGroupPages(prev => ({ ...prev, [group.code]: page - 1 }));
                                  }}
                                  className="h-7 px-2 text-xs bg-background"
                                >
                                  <ChevronLeft className="h-3.5 w-3.5 mr-1" /> {t('common:actions.previous', 'Előző')}
                                </Button>
                                <span className="px-2 font-mono text-foreground">
                                  {t('accounting:vat_return.analytics_view.page_info', { page, total: totalPages, defaultValue: `${page} / ${totalPages} oldal` })}
                                </span>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={page >= totalPages}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setGroupPages(prev => ({ ...prev, [group.code]: page + 1 }));
                                  }}
                                  className="h-7 px-2 text-xs bg-background"
                                >
                                  {t('common:actions.next', 'Következő')} <ChevronRight className="h-3.5 w-3.5 ml-1" />
                                </Button>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}

                {/* Grand Total Row */}
                <TableRow className="bg-muted/80 font-bold border-t-2 border-border">
                  <TableCell colSpan={4} className="py-3 text-right">
                    {t('accounting:vat_return.analytics_view.grand_total', 'ÖSSZESEN (NAV ÁFA Analitika):')}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums py-3 text-base">
                    {formatCurrency(totals.net, 'HUF')}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums py-3 text-base text-primary">
                    {formatCurrency(totals.vat, 'HUF')}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums py-3 text-base">
                    {formatCurrency(totals.gross, 'HUF')}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
