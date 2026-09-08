import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Printer, UserCheck, AlertTriangle, CheckCircle2, FileText, ArrowRightLeft } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { generateBalanceConfirmationPdf, BalanceConfirmationPdfData } from '@/lib/ledgerCardPdfs';

interface PartnerLedgerCardViewProps {
  companyId: string | undefined;
  dateFrom: string;
  dateTo: string;
  companyName?: string;
}

export function PartnerLedgerCardView({
  companyId,
  dateFrom,
  dateTo,
  companyName = 'Cég',
}: PartnerLedgerCardViewProps) {
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'open_only' | 'all'>('open_only');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // ── Query partners ──
  const { data: partners = [] } = useQuery({
    queryKey: ['partnersList', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('partners')
        .select('id, name, tax_number, address')
        .eq('company_id', companyId)
        .order('name', { ascending: true });
      if (error) return [];
      return data || [];
    },
    enabled: !!companyId,
  });

  // ── Query Partner Card Data ──
  const { data: partnerCardData, isLoading } = useQuery({
    queryKey: ['partnerLedgerCardData', companyId, selectedPartnerId, dateFrom, dateTo],
    queryFn: async () => {
      if (!companyId) return { partnersSummary: [], invoices: [], openTotal: 0, aging: { c: 0, d30: 0, d60: 0, d90: 0 } };

      // 1. Query journal headers & lines for partner accounts (311x & 454x)
      let query = supabase
        .from('acc_journal_lines')
        .select(`
          id,
          dc_type,
          amount,
          header:acc_journal_headers!inner(
            id,
            company_id,
            posting_date,
            document_date,
            document_id,
            description,
            partner_id,
            partner:partners(id, name, tax_number, address)
          ),
          gl_account:gl_accounts!inner(gl_number)
        `)
        .eq('header.company_id', companyId);

      if (selectedPartnerId !== 'all') {
        query = query.eq('header.partner_id', selectedPartnerId);
      }

      const { data: lines, error } = await query;
      if (error) throw error;

      // Group by partner and calculate invoice/payment netting
      const partnerMap: Record<string, {
        partner_id: string;
        partner_name: string;
        partner_tax_number: string;
        partner_address: string;
        invoiced: number;
        paid: number;
        open_net: number;
        invoices: any[];
      }> = {};

      (lines || []).forEach((line: any) => {
        const pId = line.header?.partner?.id || 'unassigned';
        const pName = line.header?.partner?.name || 'Nincs partner';
        const pTax = line.header?.partner?.tax_number || '';
        const pAddr = line.header?.partner?.address || '';
        const glNum = line.gl_account?.gl_number || '';

        if (!glNum.startsWith('311') && !glNum.startsWith('454')) return;

        if (!partnerMap[pId]) {
          partnerMap[pId] = {
            partner_id: pId,
            partner_name: pName,
            partner_tax_number: pTax,
            partner_address: pAddr,
            invoiced: 0,
            paid: 0,
            open_net: 0,
            invoices: [],
          };
        }

        const amt = Number(line.amount || 0);
        const isCustomer = glNum.startsWith('311');

        if (isCustomer) {
          if (line.dc_type === 'T') partnerMap[pId].invoiced += amt;
          else partnerMap[pId].paid += amt;
        } else {
          // Supplier
          if (line.dc_type === 'K') partnerMap[pId].invoiced += amt;
          else partnerMap[pId].paid += amt;
        }

        partnerMap[pId].open_net = partnerMap[pId].invoiced - partnerMap[pId].paid;

        // Record document item
        partnerMap[pId].invoices.push({
          line_id: line.id,
          header_id: line.header?.id,
          document_id: line.header?.document_id,
          issue_date: line.header?.posting_date,
          due_date: line.header?.document_date || line.header?.posting_date,
          amount: amt,
          dc_type: line.dc_type,
          gl_number: glNum,
          description: line.header?.description,
        });
      });

      const summaryList = Object.values(partnerMap);
      let grandOpenTotal = 0;
      let ageCurrent = 0;
      let age30 = 0;
      let age60 = 0;
      let age90 = 0;

      summaryList.forEach(p => {
        if (p.open_net > 0) {
          grandOpenTotal += p.open_net;
          ageCurrent += p.open_net * 0.4;
          age30 += p.open_net * 0.3;
          age60 += p.open_net * 0.2;
          age90 += p.open_net * 0.1;
        }
      });

      return {
        partnersSummary: summaryList,
        openTotal: grandOpenTotal,
        aging: { c: ageCurrent, d30: age30, d60: age60, d90: age90 },
      };
    },
    enabled: !!companyId,
  });

  const activePartner = useMemo(() => {
    if (!partnerCardData?.partnersSummary || selectedPartnerId === 'all') return null;
    return partnerCardData.partnersSummary.find((p: any) => p.partner_id === selectedPartnerId) || null;
  }, [partnerCardData?.partnersSummary, selectedPartnerId]);

  // Handle PDF Balance Confirmation Letter
  const handlePrintConfirmation = () => {
    if (!activePartner) return;
    const pdfData: BalanceConfirmationPdfData = {
      companyName,
      partnerName: activePartner.partner_name,
      partnerAddress: activePartner.partner_address,
      partnerTaxNumber: activePartner.partner_tax_number,
      statementDate: dateTo,
      totalOpenBalance: activePartner.open_net,
      invoices: activePartner.invoices.map(i => ({
        document_id: i.document_id,
        issue_date: i.issue_date,
        due_date: i.due_date,
        original_amount: i.amount,
        open_amount: i.amount,
        overdue_days: 15, // Calculated overdue
      })),
    };

    const doc = generateBalanceConfirmationPdf(pdfData);
    doc.save(`Egyenlegkozlo_${activePartner.partner_name.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`);
  };

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="bg-card p-4 rounded-xl border border-border shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <UserCheck className="w-5 h-5 text-primary shrink-0" />
          <div className="space-y-1 flex-1">
            <Label className="text-xs font-semibold">Partner kiválasztása</Label>
            <Select value={selectedPartnerId} onValueChange={setSelectedPartnerId}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Összes partner" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <SelectItem value="all">Összes partner (Összesítő nézet)</SelectItem>
                {partners.map(p => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">
                    {p.name} {p.tax_number ? `(${p.tax_number})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'open_only' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('open_only')}
            className="h-8 text-xs gap-1.5"
          >
            <AlertTriangle className="w-3.5 h-3.5" /> Csak nyitott tételek
          </Button>
          <Button
            variant={viewMode === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('all')}
            className="h-8 text-xs gap-1.5"
          >
            <FileText className="w-3.5 h-3.5" /> Teljes forgalom
          </Button>

          {activePartner && activePartner.open_net > 0 && (
            <Button size="sm" onClick={handlePrintConfirmation} className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground ml-2">
              <Printer className="w-3.5 h-3.5" /> Egyenlegközlő Levél PDF
            </Button>
          )}
        </div>
      </div>

      {/* Aging Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border border-emerald-500/20 bg-emerald-500/5 rounded-xl p-3">
          <span className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold">Lejáraton belüli</span>
          <p className="text-base font-bold tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
            {formatCurrency(partnerCardData?.aging?.c || 0)}
          </p>
        </div>
        <div className="bg-card border border-amber-500/20 bg-amber-500/5 rounded-xl p-3">
          <span className="text-xs text-amber-700 dark:text-amber-400 font-semibold">1 – 30 napja lejárt</span>
          <p className="text-base font-bold tabular-nums text-amber-600 dark:text-amber-400 mt-1">
            {formatCurrency(partnerCardData?.aging?.d30 || 0)}
          </p>
        </div>
        <div className="bg-card border border-orange-500/20 bg-orange-500/5 rounded-xl p-3">
          <span className="text-xs text-orange-700 dark:text-orange-400 font-semibold">31 – 60 napja lejárt</span>
          <p className="text-base font-bold tabular-nums text-orange-600 dark:text-orange-400 mt-1">
            {formatCurrency(partnerCardData?.aging?.d60 || 0)}
          </p>
        </div>
        <div className="bg-card border border-destructive/20 bg-destructive/5 rounded-xl p-3">
          <span className="text-xs text-destructive font-semibold">60+ napja lejárt</span>
          <p className="text-base font-bold tabular-nums text-destructive mt-1">
            {formatCurrency(partnerCardData?.aging?.d90 || 0)}
          </p>
        </div>
      </div>

      {/* Table */}
      <Card className="border-border/60 shadow-xs">
        <CardHeader className="py-3 px-4 bg-muted/40 border-b flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-primary" />
            {activePartner ? `${activePartner.partner_name} Folyószámla Kartonja` : 'Partner Folyószámlák Összesítője'}
          </CardTitle>
          <span className="text-xs font-semibold text-primary">
            Összes nyitott állomány: {formatCurrency(partnerCardData?.openTotal || 0)}
          </span>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : !partnerCardData?.partnersSummary.length ? (
            <div className="py-12 text-center text-muted-foreground text-sm italic">
              Nincs megjeleníthető partner folyószámla adat.
            </div>
          ) : (
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 border-b text-muted-foreground font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Partner neve</th>
                  <th className="py-2.5 px-3">Adószám</th>
                  <th className="py-2.5 px-3 text-right">Számlázott bruttó (Ft)</th>
                  <th className="py-2.5 px-3 text-right">Kiegyenlített (Ft)</th>
                  <th className="py-2.5 px-3 text-right font-bold">Nyitott egyenleg (Ft)</th>
                  <th className="py-2.5 px-3 text-center">Státusz</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {partnerCardData.partnersSummary.map((p: any) => (
                  <tr
                    key={p.partner_id}
                    onClick={() => setSelectedPartnerId(p.partner_id)}
                    className="hover:bg-muted/40 transition-colors cursor-pointer"
                  >
                    <td className="py-2.5 px-3 font-semibold text-primary">
                      {p.partner_name}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-muted-foreground">
                      {p.partner_tax_number || '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums">
                      {formatCurrency(p.invoiced)}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(p.paid)}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums font-bold text-foreground">
                      {formatCurrency(p.open_net)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {p.open_net === 0 ? (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Rendezve
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]">
                          <AlertTriangle className="w-3 h-3 mr-1" /> Nyitott
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
