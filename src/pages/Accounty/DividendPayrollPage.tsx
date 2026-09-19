import React, { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Coins, ArrowLeft, ChevronRight, Plus, Printer, CheckCircle2,
  AlertCircle, FileText, Trash2, Check, BookOpen, ShieldCheck,
  Search, ExternalLink, Calendar, Calculator, Info, Loader2
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useDateRange } from '@/contexts/DateRangeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAccountyClients } from '@/hooks/accounty';
import { usePayrollEmployees } from '@/hooks/usePayrollData';
import { toast } from '@/hooks/use-toast';
import {
  useDividends, useCreateDividend, useUpdateDividend, useDeleteDividend,
  calculateDividendTaxes, SZOCHO_ANNUAL_CAP_2026, type DividendRecord
} from '@/hooks/useDividends';
import { postDividendToLedger } from '@/lib/payroll/dividendAutoPoster';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';

export default function DividendPayrollPage() {
  const { companyId, dateRange } = useParams<{ companyId: string; dateRange: string }>();
  const navigate = useNavigate();
  const { dateFromFormatted, dateToFormatted } = useDateRange();
  const effectiveDateRange = dateRange || `${dateFromFormatted}_${dateToFormatted}`;

  const { data: allClients } = useAccountyClients();
  const currentClient = allClients?.find(c => c.companyId === companyId);
  const { data: employees = [] } = usePayrollEmployees(companyId || '');

  const { data: dividends = [], isLoading } = useDividends(companyId || '');
  const createMutation = useCreateDividend();
  const updateMutation = useUpdateDividend();
  const deleteMutation = useDeleteDividend();

  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [postingId, setPostingId] = useState<string | null>(null);

  // Search & filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | DividendRecord['status']>('all');

  // Dialog state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isLedgerGuideOpen, setIsLedgerGuideOpen] = useState(false);

  // New Dividend Form State
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [memberName, setMemberName] = useState('');
  const [memberTaxId, setMemberTaxId] = useState('');
  const [resolutionNumber, setResolutionNumber] = useState(`1/${new Date().getFullYear()}. (TH)`);
  const [declarationDate, setDeclarationDate] = useState(new Date().toISOString().slice(0, 10));
  const [payoutDate, setPayoutDate] = useState(new Date().toISOString().slice(0, 10));
  const [grossAmount, setGrossAmount] = useState<number>(2_500_000);
  const [hasReachedSzochoCap, setHasReachedSzochoCap] = useState(false);
  const [priorIncomeForCap, setPriorIncomeForCap] = useState<number>(0);
  const [notes, setNotes] = useState('');

  // Handle employee selection in dialog
  const handleSelectEmployee = (empId: string) => {
    setSelectedEmployeeId(empId);
    if (!empId) return;
    const emp = employees.find(e => e.id === empId);
    if (emp) {
      setMemberName(`${emp.last_name} ${emp.first_name}`.trim());
      if (emp.tax_id) setMemberTaxId(emp.tax_id);
    }
  };

  // Live tax calculations for dialog
  const liveCalc = useMemo(() => {
    return calculateDividendTaxes({
      grossAmount,
      hasReachedSzochoCap,
      priorIncomeForCap,
    });
  }, [grossAmount, hasReachedSzochoCap, priorIncomeForCap]);

  // Overall KPIs
  const kpis = useMemo(() => {
    const totalGross = dividends.reduce((s, d) => s + Number(d.gross_amount || 0), 0);
    const totalSzja = dividends.reduce((s, d) => s + Number(d.szja_amount || 0), 0);
    const totalSzocho = dividends.reduce((s, d) => s + Number(d.szocho_amount || 0), 0);
    const totalNet = dividends.reduce((s, d) => s + Number(d.net_amount || 0), 0);
    const count = dividends.length;
    return { totalGross, totalSzja, totalSzocho, totalNet, count };
  }, [dividends]);

  // Filtered list
  const filteredDividends = useMemo(() => {
    return dividends.filter(d => {
      const matchSearch = d.member_name.toLowerCase().includes(searchQuery.toLowerCase())
        || (d.member_tax_id && d.member_tax_id.includes(searchQuery))
        || (d.resolution_number && d.resolution_number.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchStatus = statusFilter === 'all' || d.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [dividends, searchQuery, statusFilter]);

  // Handle Save
  const handleSaveDividend = async () => {
    if (!companyId || !memberName.trim() || !memberTaxId.trim() || grossAmount <= 0) return;

    await createMutation.mutateAsync({
      company_id: companyId,
      member_name: memberName.trim(),
      member_tax_id: memberTaxId.trim(),
      declaration_date: declarationDate,
      payout_date: payoutDate || null,
      gross_amount: liveCalc.grossAmount,
      has_reached_szocho_cap: hasReachedSzochoCap,
      szja_rate: 0.15,
      szja_amount: liveCalc.szjaAmount,
      szocho_rate: 0.13,
      szocho_amount: liveCalc.szochoAmount,
      net_amount: liveCalc.netAmount,
      status: 'approved',
      resolution_number: resolutionNumber.trim() || null,
      notes: notes.trim() || null,
    });

    setIsAddOpen(false);
    // Reset defaults
    setGrossAmount(2_500_000);
    setHasReachedSzochoCap(false);
    setPriorIncomeForCap(0);
    setNotes('');
  };

  const handlePostToLedger = async (d: DividendRecord) => {
    if (!companyId) return;
    setPostingId(d.id);
    try {
      const res = await postDividendToLedger(d, companyId, user?.id);
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ['accounty_dividends', companyId] });
        queryClient.invalidateQueries({ queryKey: ['acc_journal_headers', companyId] });
        queryClient.invalidateQueries({ queryKey: ['gl_accounts'] });
        queryClient.invalidateQueries({ queryKey: ['gl_account_card'] });
        queryClient.invalidateQueries({ queryKey: ['gl_balances'] });
        toast({
          title: 'Főkönyvbe könyvelve',
          description: res.message,
        });
      } else {
        toast({
          title: 'Hiba a könyvelésnél',
          description: res.message,
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Hiba',
        description: err.message || 'Váratlan hiba történt a könyvelés során.',
        variant: 'destructive',
      });
    } finally {
      setPostingId(null);
    }
  };

  // Status step handler
  const handleStatusChange = async (d: DividendRecord, nextStatus: DividendRecord['status']) => {
    if (!companyId) return;
    if (nextStatus === 'posted') {
      await handlePostToLedger(d);
      return;
    }
    await updateMutation.mutateAsync({
      id: d.id,
      companyId,
      status: nextStatus,
    });
  };

  // Print single certificate
  const handlePrintCertificate = (d: DividendRecord) => {
    const compName = currentClient?.name || 'Társaság';
    const compTax = currentClient?.taxNumber || '–';

    const html = `<!DOCTYPE html>
<html lang="hu">
<head>
<meta charset="UTF-8">
<title>Osztalék és Adóigazolás - ${d.member_name}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Outfit:wght@600;700;800&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 20mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', sans-serif; font-size: 11pt; color: #1e293b; line-height: 1.6; padding: 20px; }
  .header { border-bottom: 2px solid #0f7467; padding-bottom: 12px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
  .title { font-family: 'Outfit', sans-serif; font-size: 20pt; font-weight: 800; color: #0f7467; text-transform: uppercase; }
  .company-info { font-size: 10pt; color: #64748b; text-align: right; }
  .section { margin-bottom: 20px; }
  .section-title { font-family: 'Outfit', sans-serif; font-size: 11pt; font-weight: 700; text-transform: uppercase; color: #0f7467; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  th, td { padding: 8px 12px; border: 1px solid #cbd5e1; text-align: left; }
  th { background-color: #f1f5f9; font-weight: 600; font-size: 10pt; }
  td.right { text-align: right; font-family: 'Courier New', monospace; font-weight: 600; }
  .highlight { background-color: #f0fdf4; font-weight: 700; }
  .stamp-box { margin-top: 60px; display: flex; justify-content: space-between; }
  .stamp-line { width: 220px; border-top: 1px solid #1e293b; text-align: center; font-size: 9pt; padding-top: 6px; }
  .legal-note { font-size: 9pt; color: #64748b; margin-top: 24px; text-align: justify; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">Adó- és Kifizetési Igazolás</div>
      <div style="font-size: 11pt; font-weight: 600; color: #334155;">Megállapított és kifizetett tagi osztalékról</div>
    </div>
    <div class="company-info">
      <strong>${compName}</strong><br>
      Adószám: ${compTax}<br>
      Kelt: ${new Date().toLocaleDateString('hu-HU')}
    </div>
  </div>

  <div class="section">
    <div class="section-title">Magánszemély / Tag Adatai</div>
    <table>
      <tr><th style="width: 35%;">Név</th><td><strong>${d.member_name}</strong></td></tr>
      <tr><th>Adóazonosító jel</th><td>${d.member_tax_id}</td></tr>
      <tr><th>Határozatszám</th><td>${d.resolution_number || '–'}</td></tr>
      <tr><th>Megállapítás dátuma</th><td>${d.declaration_date}</td></tr>
      <tr><th>Kifizetés dátuma</th><td>${d.payout_date || '–'}</td></tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Osztalékelszámolás és Levont Adók</div>
    <table>
      <thead>
        <tr><th>Jogcím / Megnevezés</th><th style="width: 25%;">Kulcs</th><th class="right" style="width: 30%;">Összeg (Ft)</th></tr>
      </thead>
      <tbody>
        <tr><td>Bruttó megállapított osztalék (Szja tv. 66. §)</td><td>–</td><td class="right">${d.gross_amount.toLocaleString('hu-HU')}</td></tr>
        <tr><td>Levont Személyi jövedelemadó (SZJA)</td><td>15%</td><td class="right" style="color: #dc2626;">-${d.szja_amount.toLocaleString('hu-HU')}</td></tr>
        <tr>
          <td>
            Levont Szociális hozzájárulási adó (SZOCHO)<br>
            <small style="color: #64748b;">${d.has_reached_szocho_cap ? 'A magánszemély nyilatkozata alapján az adóévi 24× minimálbér plafon (7 747 200 Ft) elérve.' : 'Szocho tv. 1. § (5) bek. szerinti adófizetés.'}</small>
          </td>
          <td>${d.has_reached_szocho_cap ? '0% (mentes)' : '13%'}</td>
          <td class="right" style="color: #dc2626;">-${d.szocho_amount.toLocaleString('hu-HU')}</td>
        </tr>
        <tr class="highlight">
          <td><strong>NETTÓ KIFIZETENDŐ ÖSSZEG</strong></td>
          <td>–</td>
          <td class="right" style="color: #0f7467; font-size: 13pt;">${d.net_amount.toLocaleString('hu-HU')} Ft</td>
        </tr>
      </tbody>
    </table>
  </div>

  <p class="legal-note">
    Ez az igazolás a személyi jövedelemadóról szóló 1995. évi CXVII. törvény (Szja tv.) és a szociális hozzájárulási adóról szóló 2018. évi LII. törvény rendelkezései alapján került kiállításra. A kifizető az adókat levonta, és a hatályos szabályok szerint bevallja a Nemzeti Adó- és Vámhivatal felé a havi adó- és járulékbevallásában (NAV 08-as nyomtatvány).
  </p>
  <p class="legal-note" style="margin-top: 8px; font-style: italic; background-color: #f8fafc; padding: 8px; border: 1px dashed #cbd5e1; border-radius: 4px;">
    <strong>Tájékoztatás évközi jövedelemváltozásról (SZOCHO visszaigénylés):</strong> Amennyiben a magánszemély más jogviszonyból (különösen munkaviszonyból) származó jövedelme az adóév későbbi időszakában eléri a 2026-os SZOCHO felső korlátot (7 747 200 Ft / 24× minimálbér), a jelen kifizetéskor levont szociális hozzájárulási adó utólagosan túlvontnak minősül, és a magánszemély az éves 26SZJA személyi jövedelemadó bevallásában azt közvetlenül visszaigényelheti a NAV-tól.
  </p>

  <div class="stamp-box">
    <div class="stamp-line">Kifizető cégszerű aláírása / bélyegzője</div>
    <div class="stamp-line">Magánszemély aláírása (Átvétel kelte: ________)</div>
  </div>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    w?.focus();
  };

  return (
    <div className="w-full space-y-6 page-animate pb-12">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link to={`/eaisybooks/${companyId}/${effectiveDateRange}/payroll`} className="hover:text-primary transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Bérszámfejtés áttekintő
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground font-medium">Osztalék Számfejtés és Adózás</span>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-emerald-600 to-teal-700 rounded-xl shadow-md shadow-emerald-500/20 text-white">
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Osztalék Számfejtés</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                2026 Adóév
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tagi jóváhagyott osztalékok elszámolása, 15% SZJA és 13% SZOCHO (24× minimálbér plafonnal), adóigazolások kiadása.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/${companyId}/${effectiveDateRange}/general-ledger`)}
            className="flex items-center gap-1.5 text-xs shadow-xs"
          >
            <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
            Főkönyv
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/${companyId}/${effectiveDateRange}/journals`)}
            className="flex items-center gap-1.5 text-xs shadow-xs"
          >
            <BookOpen className="w-3.5 h-3.5 text-purple-600" />
            Vegyes napló
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsLedgerGuideOpen(true)}
            className="flex items-center gap-1.5 text-xs shadow-xs"
          >
            <Info className="w-3.5 h-3.5 text-blue-600" />
            Kontírozási útmutató
          </Button>

          <Button
            size="sm"
            onClick={() => setIsAddOpen(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-1.5 text-xs shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Új osztalék felvétele
          </Button>
        </div>
      </div>

      {/* SZOCHO Cap 2026 Info Banner */}
      <div className="bg-gradient-to-r from-teal-50/80 to-emerald-50/80 dark:from-teal-950/20 dark:to-emerald-950/20 border border-teal-200 dark:border-teal-800/40 rounded-xl p-4 flex items-start sm:items-center justify-between gap-4 shadow-soft">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-teal-600 text-white rounded-lg shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground font-semibold">2026-os SZOCHO Felső Korlát Szabály (Szoc. tv. 1. §): </strong>
            Az adóévben a magánszemély által fizetendő SZOCHO felső határa a minimálbér 24-szerese:
            <span className="font-mono font-bold text-teal-700 dark:text-teal-300 ml-1">
              24 × 322 800 Ft = {SZOCHO_ANNUAL_CAP_2026.toLocaleString('hu-HU')} Ft
            </span> (max. <span className="font-mono font-bold">1 007 136 Ft</span> adóteher). Ha a tagnak munkabérből már levonták a plafont, az osztalék SZOCHO-mentes (0 Ft)!
            <div className="mt-1 text-[11px] text-teal-800 dark:text-teal-200 font-medium">
              💡 <em>Évközi munkabér változás:</em> Amennyiben a tag munkabére az év későbbi időszakában éri el a 7,74 M Ft-os határt, az osztalékból most levont SZOCHO-t az éves 26SZJA bevallásban visszaigényelheti a NAV-tól.
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <div className="text-xs font-medium text-muted-foreground">Jóváhagyott Bruttó Osztalék</div>
          <div className="text-2xl font-bold font-mono text-foreground mt-1">
            {kpis.totalGross.toLocaleString('hu-HU')} <span className="text-xs font-sans text-muted-foreground font-normal">Ft</span>
          </div>
          <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
            <span>{kpis.count} rögzített határozat</span>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <div className="text-xs font-medium text-muted-foreground">Levont SZJA (15%)</div>
          <div className="text-2xl font-bold font-mono text-red-600 dark:text-red-400 mt-1">
            {kpis.totalSzja.toLocaleString('hu-HU')} <span className="text-xs font-sans text-muted-foreground font-normal">Ft</span>
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Szja tv. 66. § szerint fizetendő
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <div className="text-xs font-medium text-muted-foreground">Levont SZOCHO (13%)</div>
          <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
            {kpis.totalSzocho.toLocaleString('hu-HU')} <span className="text-xs font-sans text-muted-foreground font-normal">Ft</span>
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Plafonfigyeléssel korlátozva
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <div className="text-xs font-medium text-muted-foreground">Kifizetendő Nettó Összeg</div>
          <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
            {kpis.totalNet.toLocaleString('hu-HU')} <span className="text-xs font-sans text-muted-foreground font-normal">Ft</span>
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Tényleges banki utalás a tagoknak
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-card rounded-xl border border-border p-3.5 shadow-soft flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Keresés tag neve, adóazonosító, határozat..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          {(['all', 'approved', 'paid', 'posted', 'draft'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap',
                statusFilter === st
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:bg-muted'
              )}
            >
              {st === 'all' && 'Összes tétel'}
              {st === 'approved' && 'Jóváhagyva'}
              {st === 'paid' && 'Kifizetve'}
              {st === 'posted' && 'Könyvelve'}
              {st === 'draft' && 'Tervezet'}
            </button>
          ))}
        </div>
      </div>

      {/* Dividends Table */}
      <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Tag Neve & Adóazonosító</th>
                <th className="py-3 px-4">Határozatszám & Dátum</th>
                <th className="py-3 px-4 text-right">Bruttó Osztalék</th>
                <th className="py-3 px-4 text-right">15% SZJA</th>
                <th className="py-3 px-4 text-right">13% SZOCHO</th>
                <th className="py-3 px-4 text-right">Nettó Kifizetés</th>
                <th className="py-3 px-4 text-center">Státusz</th>
                <th className="py-3 px-4 text-right">Műveletek</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredDividends.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    <Coins className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                    {dividends.length === 0
                      ? 'Még nincs rögzített osztalék ebben a cégben.'
                      : 'Nincs a szűrésnek megfelelő osztalék tétel.'}
                  </td>
                </tr>
              ) : (
                filteredDividends.map((d) => (
                  <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-foreground text-sm">{d.member_name}</div>
                      <div className="text-[11px] font-mono text-muted-foreground">Adóazonosító: {d.member_tax_id}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-foreground">{d.resolution_number || 'Határozat nélkül'}</div>
                      <div className="text-[11px] text-muted-foreground">
                        Megállapítva: {d.declaration_date} {d.payout_date ? `· Kifizetve: ${d.payout_date}` : ''}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-foreground">
                      {d.gross_amount.toLocaleString('hu-HU')} Ft
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-red-600 dark:text-red-400">
                      -{d.szja_amount.toLocaleString('hu-HU')} Ft
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono">
                      {d.has_reached_szocho_cap || d.szocho_amount === 0 ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3" /> Plafon elérve (0 Ft)
                        </span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 font-semibold">
                          -{d.szocho_amount.toLocaleString('hu-HU')} Ft
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                      {d.net_amount.toLocaleString('hu-HU')} Ft
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className={cn(
                          'px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1',
                          d.status === 'paid' && 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
                          d.status === 'approved' && 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
                          d.status === 'posted' && 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
                          d.status === 'draft' && 'bg-muted text-muted-foreground'
                        )}>
                          {d.status === 'posted' && <CheckCircle2 className="w-3 h-3 text-purple-600" />}
                          {d.status === 'approved' && 'Jóváhagyva'}
                          {d.status === 'paid' && 'Kifizetve'}
                          {d.status === 'posted' && 'Könyvelve'}
                          {d.status === 'draft' && 'Tervezet'}
                        </span>
                        {d.status === 'posted' && (
                          <span className="text-[10px] font-mono text-muted-foreground">
                            Vegyes napló
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Hivatalos Adóigazolás nyomtatása"
                          onClick={() => handlePrintCertificate(d)}
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </Button>

                        {d.status === 'approved' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStatusChange(d, 'paid')}
                            className="h-7 px-2 text-[11px] border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                          >
                            Kifizetés
                          </Button>
                        )}

                        {d.status === 'paid' && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={postingId === d.id}
                            onClick={() => handleStatusChange(d, 'posted')}
                            className="h-7 px-2 text-[11px] border-purple-300 text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/30"
                          >
                            {postingId === d.id ? (
                              <span className="flex items-center gap-1">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Könyvelés...
                              </span>
                            ) : (
                              'Könyvelés'
                            )}
                          </Button>
                        )}

                        {d.status === 'posted' && d.journal_entry_id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/${companyId}/${effectiveDateRange}/journals`)}
                            className="h-7 px-2 text-[11px] text-purple-700 hover:bg-purple-50 dark:text-purple-300 dark:hover:bg-purple-950/30 flex items-center gap-1 font-medium"
                            title="Megtekintés a Vegyes naplóban"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            Naplóban
                          </Button>
                        )}

                        {d.status === 'posted' && !d.journal_entry_id && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={postingId === d.id}
                            onClick={() => handlePostToLedger(d)}
                            className="h-7 px-2 text-[11px] border-amber-300 text-amber-700 hover:bg-amber-50"
                            title="Még nincs bizonylat létrehozva a főkönyvben"
                          >
                            {postingId === d.id ? (
                              <span className="flex items-center gap-1">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Feladás...
                              </span>
                            ) : (
                              'Főkönyvbe feladás'
                            )}
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="icon"
                          title="Törlés"
                          onClick={() => {
                            if (window.confirm('Biztosan törölni szeretnéd ezt az osztalék tételt?')) {
                              deleteMutation.mutate({ id: d.id, companyId: companyId! });
                            }
                          }}
                          className="h-7 w-7 text-muted-foreground hover:text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Dividend Modal */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[620px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Coins className="w-5 h-5 text-emerald-600" />
              Új Tagi Osztalék Számfejtése
            </DialogTitle>
            <DialogDescription className="text-xs">
              Adja meg a jóváhagyott bruttó osztalékot. A rendszer automatikusan kalkulálja a 15% SZJA-t és a 13% SZOCHO-t (a 24× minimálbér plafon figyelésével).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Employee Picker or Direct Member Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Tag kiválasztása listából
                </label>
                <select
                  value={selectedEmployeeId}
                  onChange={e => handleSelectEmployee(e.target.value)}
                  className="w-full text-xs rounded-lg border border-border bg-background px-3 py-2 outline-none"
                >
                  <option value="">– Új tag manuális megadása –</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.last_name} {emp.first_name} {emp.tax_id ? `(${emp.tax_id})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Tag neve <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={memberName}
                  onChange={e => setMemberName(e.target.value)}
                  placeholder="pl. Kovács Péter"
                  className="w-full text-xs rounded-lg border border-border bg-background px-3 py-2 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Adóazonosító jel <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={memberTaxId}
                  onChange={e => setMemberTaxId(e.target.value)}
                  placeholder="8XXXXXXXXX"
                  className="w-full text-xs font-mono rounded-lg border border-border bg-background px-3 py-2 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Határozatszám
                </label>
                <input
                  type="text"
                  value={resolutionNumber}
                  onChange={e => setResolutionNumber(e.target.value)}
                  placeholder="pl. 1/2026. (TH)"
                  className="w-full text-xs rounded-lg border border-border bg-background px-3 py-2 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Megállapítás dátuma
                </label>
                <input
                  type="date"
                  value={declarationDate}
                  onChange={e => setDeclarationDate(e.target.value)}
                  className="w-full text-xs rounded-lg border border-border bg-background px-3 py-2 outline-none"
                />
              </div>
            </div>

            {/* Gross amount input */}
            <div className="bg-muted/30 p-3.5 rounded-xl border border-border space-y-3">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">
                  Jóváhagyott Bruttó Osztalék (Ft)
                </label>
                <input
                  type="number"
                  step="10000"
                  value={grossAmount}
                  onChange={e => setGrossAmount(Number(e.target.value))}
                  className="w-full text-lg font-bold font-mono rounded-lg border border-border bg-background px-3 py-2 text-right outline-none"
                />
              </div>

              {/* SZOCHO Cap check */}
              <div className="pt-2 border-t border-border/60">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={hasReachedSzochoCap}
                    onChange={e => setHasReachedSzochoCap(e.target.checked)}
                    className="mt-0.5 rounded border-border text-primary focus:ring-primary h-4 w-4"
                  />
                  <div className="text-xs">
                    <span className="font-semibold text-foreground">
                      A tag már elérte az éves SZOCHO felső határt (24 × minimálbér = 7 747 200 Ft)
                    </span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Ha a tagnak munkaviszonyból vagy egyéb jogviszonyból már levonták az adóévben a maximális SZOCHO-t, pipáld be: a SZOCHO ekkor 0 Ft.
                    </p>
                  </div>
                </label>
              </div>

              {!hasReachedSzochoCap && (
                <div className="pt-2">
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                    Egyéb jogviszonyból már beszámított 2026-os jövedelemalap (opcionális, Ft):
                  </label>
                  <input
                    type="number"
                    step="50000"
                    value={priorIncomeForCap || ''}
                    onChange={e => setPriorIncomeForCap(Number(e.target.value))}
                    placeholder="pl. 4 500 000 Ft munkabér"
                    className="w-full text-xs font-mono rounded-lg border border-border bg-background px-3 py-1.5 text-right outline-none"
                  />
                </div>
              )}
            </div>

            {/* Live Calculation Summary Card */}
            <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-3.5 space-y-2">
              <div className="text-xs font-bold text-emerald-900 dark:text-emerald-200 uppercase tracking-wider">
                Számfejtési Eredmény (2026 Szabályok)
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="text-muted-foreground">Bruttó összeg:</div>
                <div className="text-right font-bold text-foreground">{liveCalc.grossAmount.toLocaleString('hu-HU')} Ft</div>

                <div className="text-muted-foreground">Levont 15% SZJA:</div>
                <div className="text-right text-red-600 font-bold">-{liveCalc.szjaAmount.toLocaleString('hu-HU')} Ft</div>

                <div className="text-muted-foreground">Levont 13% SZOCHO:</div>
                <div className="text-right font-bold">
                  {hasReachedSzochoCap || liveCalc.szochoAmount === 0 ? (
                    <span className="text-emerald-600">0 Ft (Plafon / mentes)</span>
                  ) : (
                    <span className="text-amber-600">-{liveCalc.szochoAmount.toLocaleString('hu-HU')} Ft</span>
                  )}
                </div>

                <div className="pt-2 border-t border-emerald-200 dark:border-emerald-800/60 font-sans font-bold text-sm text-foreground">
                  Nettó Kifizetés:
                </div>
                <div className="pt-2 border-t border-emerald-200 dark:border-emerald-800/60 font-mono font-bold text-base text-right text-emerald-700 dark:text-emerald-300">
                  {liveCalc.netAmount.toLocaleString('hu-HU')} Ft
                </div>
              </div>
            </div>

            {/* SZOCHO mid-year cap refund hint */}
            <div className="text-[11px] text-muted-foreground bg-muted/40 p-2.5 rounded-lg border border-border/50 flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
              <span className="leading-relaxed">
                <strong>Tájékoztatás évközi jövedelemváltozásról:</strong> Amennyiben a magánszemély más jogviszonyból (pl. munkabér) az adóév későbbi időszakában eléri az éves SZOCHO plafont (7 747 200 Ft), a most levont szocho az éves 26SZJA bevallásban a NAV-tól visszaigényelhető.
              </span>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsAddOpen(false)}>
              Mégse
            </Button>
            <Button
              size="sm"
              onClick={handleSaveDividend}
              disabled={!memberName.trim() || !memberTaxId.trim() || grossAmount <= 0 || createMutation.isPending}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            >
              {createMutation.isPending ? 'Mentés...' : 'Osztalék jóváhagyása és mentése'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ledger Guidance Dialog */}
      <Dialog open={isLedgerGuideOpen} onOpenChange={setIsLedgerGuideOpen}>
        <DialogContent className="sm:max-w-[620px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <BookOpen className="w-5 h-5 text-blue-600" />
              Osztalék Főkönyvi Kontírozás és Megjelenés
            </DialogTitle>
            <DialogDescription className="text-xs">
              A Számviteli törvény szerinti kettős könyvvitel szabályai és a rendszerbeli tételek helye.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="bg-muted/40 p-3 rounded-lg border border-border space-y-2">
              <div className="font-bold text-foreground flex items-center justify-between">
                <span>1. Osztalék jóváhagyásakor (Taggyűlési határozat napján):</span>
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Vegyes napló (VE)</span>
              </div>
              <div className="font-mono bg-background p-2.5 rounded border border-border text-[11px] leading-relaxed">
                <div><strong>T 413</strong> Eredménytartalék – <strong>K 4792</strong> Alapítókkal szembeni rövid lej. kötelezettségek</div>
                <div className="text-muted-foreground text-[10px] mt-0.5">Összeg: Bruttó jóváhagyott osztalék</div>
              </div>
            </div>

            <div className="bg-muted/40 p-3 rounded-lg border border-border space-y-2">
              <div className="font-bold text-foreground flex items-center justify-between">
                <span>2. Levont adók elszámolásakor:</span>
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Vegyes napló (VE)</span>
              </div>
              <div className="font-mono bg-background p-2.5 rounded border border-border text-[11px] leading-relaxed space-y-1">
                <div><strong>T 4792</strong> – <strong>K 4622</strong> (Levont 15% SZJA)</div>
                <div><strong>T 4792</strong> – <strong>K 463 / 46311</strong> (Levont 13% SZOCHO, ha a plafon nem ért el)</div>
              </div>
            </div>

            <div className="bg-muted/40 p-3 rounded-lg border border-border space-y-2">
              <div className="font-bold text-foreground flex items-center justify-between">
                <span>3. Kifizetéskor (Bankkivonat könyvelése):</span>
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Banki napló (B)</span>
              </div>
              <div className="font-mono bg-background p-2.5 rounded border border-border text-[11px] leading-relaxed">
                <div><strong>T 4792</strong> – <strong>K 384</strong> (Elszámolási betétszámla)</div>
                <div className="text-muted-foreground text-[10px] mt-0.5">Összeg: Nettó kifizetés (a 4792 egyenlege ezzel nullázódik)</div>
              </div>
            </div>

            <div className="bg-emerald-50/70 dark:bg-emerald-950/30 p-3.5 rounded-lg border border-emerald-200 dark:border-emerald-800/40 text-xs">
              <div className="font-semibold text-emerald-900 dark:text-emerald-200 mb-1 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Hol ellenőrizhető a könyvelés?
              </div>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li><strong className="text-foreground">Főkönyvi karton:</strong> A <em>Főkönyv → Kartonok</em> nézetben a <strong>413</strong>, <strong>4792</strong>, <strong>4622</strong> és <strong>46311</strong> számlák kiválasztásával.</li>
                <li><strong className="text-foreground">Naplók:</strong> A <em>Naplók</em> nézetben a <strong>Vegyes napló (VE)</strong> fül alatt <span className="font-mono font-semibold">OSZT-...</span> bizonylatszámmal.</li>
              </ul>
            </div>

            <div className="bg-blue-50/70 dark:bg-blue-950/30 p-3 rounded-lg border border-blue-200 dark:border-blue-800/40 text-[11px] text-muted-foreground">
              <strong className="text-foreground">Bevallási határidő: </strong>
              Az osztalék kifizetését követő hónap 12. napjáig esedékes a NAV '08-as havi adó- és járulékbevallás benyújtása és az adók befizetése.
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsLedgerGuideOpen(false);
                navigate(`/${companyId}/${effectiveDateRange}/general-ledger`);
              }}
              className="flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Főkönyv megnyitása
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsLedgerGuideOpen(false);
                navigate(`/${companyId}/${effectiveDateRange}/journals`);
              }}
              className="flex items-center gap-1.5"
            >
              <BookOpen className="w-3.5 h-3.5" /> Vegyes napló
            </Button>
            <Button size="sm" onClick={() => setIsLedgerGuideOpen(false)}>
              Bezárás
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
