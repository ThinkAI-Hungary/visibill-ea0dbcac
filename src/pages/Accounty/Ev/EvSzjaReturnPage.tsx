import React, { useState, useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  FileText, ArrowLeft, ChevronRight, Info, Calculator,
  CheckCircle2, Clock, AlertTriangle, Send, Download,
  Calendar, ArrowUpRight, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAccountyClient } from '@/hooks/accounty';
import { formatHuf } from '@/lib/evCalculations';
import { useEvTaxReturns, useEvClientSettings, useUpdateEvTaxReturn, useEvContributions, type EvTaxReturn, type EvClientSettings } from '@/hooks/useEvData';
import { toast } from '@/hooks/use-toast';
import { buildContrib2658Xml } from '@/lib/contrib2658Xml';

// ─── Constants ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  submitted: { label: 'Benyújtva', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2 },
  accepted: { label: 'Elfogadva', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2 },
  draft: { label: 'Vázlat', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: FileText },
  upcoming: { label: 'Közelgő', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400', icon: Clock },
  overdue: { label: 'Lejárt!', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: AlertTriangle },
};

const RETURN_TYPE_LABELS: Record<string, { type: string; code: string }> = {
  szja: { type: 'SZJA bevallás', code: '53' },
  jarulekbevallas: { type: 'TB járulék', code: '58' },
  '2658': { type: 'TB járulék', code: '58' },
  contrib: { type: 'TB járulék', code: '58' },
  hipa: { type: 'HIPA bevallás', code: 'HIPA' },
  kata: { type: 'KATA bevallás', code: 'KATA' },
  afa: { type: 'ÁFA bevallás', code: '65' },
  cegautado: { type: 'Cégautóadó', code: 'CAR' },
  car: { type: 'Cégautóadó', code: 'CAR' },
};

// ─── Generate expected returns for a tax year ───────────────────────────────

function generateExpectedReturns(taxYear: number, settings: EvClientSettings | null | undefined) {
  const now = new Date();
  const expected: Array<{
    id: string; type: string; code: string; period: string;
    deadline: string; status: string; amount: number;
    submittedDate: string | null; navSubmissionId: string | null;
    isGenerated: boolean;
  }> = [];

  const getStatus = (deadline: string) => {
    const d = new Date(deadline);
    if (now > d) return 'overdue';
    const days = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return days <= 30 ? 'draft' : 'upcoming';
  };

  // Quarterly 2658 (járulékbevallás) — all EV types except kiegészítő
  const quarterDeadlines = [
    { q: 'Q1', deadline: `${taxYear}-04-12` },
    { q: 'Q2', deadline: `${taxYear}-07-12` },
    { q: 'Q3', deadline: `${taxYear}-10-12` },
    { q: 'Q4', deadline: `${taxYear + 1}-01-12` },
  ];

  for (const qd of quarterDeadlines) {
    expected.push({
      id: `gen-2658-${qd.q}`,
      type: 'TB járulék bevallás',
      code: `${taxYear % 100}58`,
      period: `${taxYear} ${qd.q}`,
      deadline: qd.deadline,
      status: getStatus(qd.deadline),
      amount: 0,
      submittedDate: null,
      navSubmissionId: null,
      isGenerated: true,
    });
  }

  // Annual SZJA — átalány or VSZJA
  const form = settings?.taxpayer_form;
  if (form !== 'kata') {
    expected.push({
      id: `gen-szja-annual`,
      type: form === 'atalany' ? 'SZJA bevallás (átalányadó)' : 'SZJA bevallás (VSZJA)',
      code: `${taxYear % 100}53`,
      period: `${taxYear} Éves`,
      deadline: `${taxYear + 1}-05-20`,
      status: getStatus(`${taxYear + 1}-05-20`),
      amount: 0,
      submittedDate: null,
      navSubmissionId: null,
      isGenerated: true,
    });
  }

  // KATA
  if (form === 'kata') {
    expected.push({
      id: `gen-kata-annual`,
      type: 'KATA nyilatkozat',
      code: `${taxYear % 100}KATA`,
      period: `${taxYear} Éves`,
      deadline: `${taxYear + 1}-02-25`,
      status: getStatus(`${taxYear + 1}-02-25`),
      amount: 0,
      submittedDate: null,
      navSubmissionId: null,
      isGenerated: true,
    });
  }

  // HIPA
  expected.push({
    id: `gen-hipa-annual`,
    type: 'HIPA bevallás',
    code: `${taxYear % 100}HIPA`,
    period: `${taxYear} Éves`,
    deadline: `${taxYear}-05-31`,
    status: getStatus(`${taxYear}-05-31`),
    amount: 0,
    submittedDate: null,
    navSubmissionId: null,
    isGenerated: true,
  });

  // ÁFA — only if not alanyi_mentes
  const vat = settings?.vat_status;
  if (vat && vat !== 'alanyi_mentes') {
    expected.push({
      id: `gen-afa-annual`,
      type: 'ÁFA bevallás',
      code: `${taxYear % 100}65`,
      period: `${taxYear} Éves`,
      deadline: `${taxYear + 1}-02-25`,
      status: getStatus(`${taxYear + 1}-02-25`),
      amount: 0,
      submittedDate: null,
      navSubmissionId: null,
      isGenerated: true,
    });
  }

  // Sort by deadline
  expected.sort((a, b) => a.deadline.localeCompare(b.deadline));

  return expected;
}

function generateDraftReturnXml(code: string, period: string, client: any) {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<nav_bevallassablon xmlns="http://www.nav.gov.hu/bevallas" verzio="1.0">\n`;
  xml += `  <fejlec>\n`;
  xml += `    <nyomtatvany>${code}</nyomtatvany>\n`;
  xml += `    <adoszam>${client?.taxNumber || client?.tax_number || ''}</adoszam>\n`;
  xml += `    <nev>${client?.name || 'Egyéni Vállalkozó'}</nev>\n`;
  xml += `    <idoszak>${period}</idoszak>\n`;
  xml += `  </fejlec>\n`;
  xml += `  <tartalom>\n`;
  xml += `    <statusz>tervezet</statusz>\n`;
  xml += `  </tartalom>\n`;
  xml += `</nav_bevallassablon>\n`;
  return xml;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function EvSzjaReturnPage() {
  const { companyId, dateRange } = useParams<{ companyId: string; dateRange: string }>();
  const id = companyId;
  const { data: client } = useAccountyClient(id);
  const [tab, setTab] = useState<'all' | 'pending' | 'submitted'>('all');
  const updateReturn = useUpdateEvTaxReturn();
  const [searchParams] = useSearchParams();
  const taxYear = Number(searchParams.get('year') || '2026');

  // ─── Real data ────────────────────────────────────────────────────────────
  const { data: allReturns, isLoading } = useEvTaxReturns(id, taxYear);
  const { data: evSettings } = useEvClientSettings(id, taxYear);
  const { data: contributions } = useEvContributions(id, taxYear);

  const handlePrepareAndDownload = async (ret: any) => {
    if (!id) return;
    try {
      let rType = 'szja';
      const codeLower = ret.code.toLowerCase();
      if (codeLower.includes('2658') || codeLower.includes('58')) {
        rType = 'contrib';
      } else if (codeLower.includes('kata')) {
        rType = 'kata';
      } else if (codeLower.includes('hipa')) {
        rType = 'hipa';
      } else if (codeLower.includes('65') || codeLower.includes('afa')) {
        rType = 'afa';
      } else if (codeLower.includes('car')) {
        rType = 'car';
      }

      // 1. Generate XML
      let xml = '';
      if (rType === 'contrib') {
        const quarterNum = ret.period.includes('Q1') ? 1 : ret.period.includes('Q2') ? 2 : ret.period.includes('Q3') ? 3 : 4;
        const currentCalc = contributions?.find((c: any) => c.quarter === quarterNum);
        
        xml = buildContrib2658Xml({
          companyName: client?.name || 'Egyéni Vállalkozó',
          companyTaxNumber: client?.taxNumber || client?.tax_number || '',
          periodYear: taxYear,
          periodQuarter: quarterNum,
          tbBase: currentCalc?.current_quarter_base || 0,
          tbAmount: currentCalc?.tb_amount || 0,
          szochoBase: currentCalc?.current_quarter_base || 0,
          szochoAmount: currentCalc?.szocho_amount || 0,
          isFoallasu: evSettings?.employment_status === 'foallasu',
        });
      } else {
        xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        xml += `<nav_bevallassablon xmlns="http://www.nav.gov.hu/bevallas" verzio="1.0">\n`;
        xml += `  <fejlec>\n`;
        xml += `    <nyomtatvany>${ret.code}</nyomtatvany>\n`;
        xml += `    <adoszam>${client?.taxNumber || client?.tax_number || ''}</adoszam>\n`;
        xml += `    <nev>${client?.name || 'Egyéni Vállalkozó'}</nev>\n`;
        xml += `    <idoszak>${ret.period}</idoszak>\n`;
        xml += `  </fejlec>\n`;
        xml += `  <tartalom>\n`;
        xml += `    <statusz>vegleges</statusz>\n`;
        xml += `    <osszeg>${ret.amount || 0}</osszeg>\n`;
        xml += `  </tartalom>\n`;
        xml += `</nav_bevallassablon>\n`;
      }

      // 2. Save/upsert return to db
      await updateReturn.mutateAsync({
        company_id: id,
        tax_year: taxYear,
        return_type: rType,
        form_code: ret.code,
        period_key: ret.period,
        status: 'submitted',
        calculated_tax: ret.amount,
        paid_amount: 0,
        deadline: ret.deadline || null,
        submitted_at: new Date().toISOString(),
        xml_data: xml,
        data: {
          period: ret.period,
          amount: ret.amount,
        }
      });

      // 3. Download the file
      const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `NAV_${ret.code}_${ret.period.replace(/\s+/g, '_')}.xml`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: 'Siker',
        description: `${ret.period} ${ret.type} sikeresen elkészítve és beküldöttként mentve, az XML letöltése elindult.`,
      });
    } catch (err: any) {
      toast({
        title: 'Hiba történt',
        description: err.message || 'Nem sikerült menteni a bevallást.',
        variant: 'destructive',
      });
    }
  };

  const returns = useMemo(() => {
    const dbReturns = (allReturns || []).map((r: any) => {
      const labels = RETURN_TYPE_LABELS[r.return_type] || { type: r.return_type, code: r.form_code || '?' };
      const now = new Date();
      const isOverdue = r.status !== 'submitted' && r.status !== 'accepted' && r.deadline && new Date(r.deadline) < now;
      const status = isOverdue ? 'overdue'
        : r.status === 'submitted' || r.status === 'accepted' ? 'submitted'
        : r.status === 'draft' ? 'draft' : 'upcoming';
      return {
        id: r.id,
        type: labels.type,
        code: r.form_code || labels.code,
        period: r.period_key || '',
        deadline: r.deadline || '',
        status,
        amount: r.calculated_tax || 0,
        submittedDate: r.submitted_at,
        navSubmissionId: r.nav_submission_id,
        isGenerated: false,
        xmlData: r.xml_data,
      };
    });

    // If no DB records, generate expected returns
    if (dbReturns.length === 0) {
      return generateExpectedReturns(taxYear, evSettings);
    }
    return dbReturns;
  }, [allReturns, evSettings, taxYear]);

  const filtered = useMemo(() => {
    if (tab === 'all') return returns;
    if (tab === 'pending') return returns.filter(r => r.status === 'draft' || r.status === 'upcoming' || r.status === 'overdue');
    return returns.filter(r => r.status === 'submitted');
  }, [returns, tab]);

  const submittedCount = returns.filter(r => r.status === 'submitted').length;
  const pendingCount = returns.filter(r => r.status !== 'submitted').length;
  const totalPaid = returns.filter(r => r.status === 'submitted').reduce((s, r) => s + r.amount, 0);

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to={`/accounty/ev?year=${taxYear}`} className="hover:text-indigo-600 transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> EV Portfólió
        </Link>
        <ChevronRight className="w-3 h-3" />
        <Link to={`/accounty/${id}/${dateRange}/ev?year=${taxYear}`} className="hover:text-indigo-600 transition-colors">
          {client?.name || 'Ügyfél'}
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-900 dark:text-slate-100 font-medium">Bevallások</span>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl shadow-lg shadow-indigo-500/25">
          <FileText className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Bevallások áttekintés</h1>
          <p className="text-sm text-slate-500">SZJA 53, TB 58, KATA, HIPA, ÁFA – összes adóbevallás egy helyen</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Összes bevallás</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{isLoading ? '...' : returns.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Benyújtva</p>
          <p className="text-2xl font-bold text-green-600">{isLoading ? '...' : submittedCount}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Függőben</p>
          <p className="text-2xl font-bold text-amber-600">{isLoading ? '...' : pendingCount}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Befizetett összeg</p>
          <p className="text-lg font-bold text-indigo-600 tabular-nums">{isLoading ? '...' : formatHuf(totalPaid)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/50 rounded-lg p-1 w-fit">
        {[
          { key: 'all', label: 'Összes' },
          { key: 'pending', label: 'Függőben' },
          { key: 'submitted', label: 'Benyújtva' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className={cn(
              'px-4 py-1.5 text-xs font-semibold rounded-md transition-all',
              tab === t.key
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Returns list */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Loader2 className="w-8 h-8 mb-3 animate-spin text-indigo-400" />
            <p className="text-sm">Betöltés...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <FileText className="w-10 h-10 mb-3 opacity-50" />
            <p className="text-sm font-medium">Nincs bevallás{tab !== 'all' ? ` ebben a kategóriában` : ''}</p>
          </div>
        ) : (
          filtered.map(ret => {
            const cfg = STATUS_CONFIG[ret.status] || STATUS_CONFIG.upcoming;
            const Icon = cfg.icon;
            let linkPath = "";
            const codeLower = ret.code.toLowerCase();
            if (codeLower.includes('2658') || codeLower.includes('58')) {
              linkPath = `/accounty/${id}/${dateRange}/ev/returns/contrib?year=${taxYear}`;
            } else if (codeLower.includes('kata')) {
              linkPath = `/accounty/${id}/${dateRange}/ev/returns/kata?year=${taxYear}`;
            } else if (codeLower.includes('hipa')) {
              linkPath = `/accounty/${id}/${dateRange}/ev/returns/hipa?year=${taxYear}`;
            } else if (codeLower.includes('65') || codeLower.includes('car')) {
              linkPath = `/accounty/${id}/${dateRange}/ev/returns/vat-car?year=${taxYear}`;
            } else if (codeLower.includes('2553') || codeLower.includes('szja') || codeLower.includes('53')) {
              const isAtalany = evSettings?.taxpayer_form === 'atalany';
              linkPath = isAtalany 
                ? `/accounty/${id}/${dateRange}/ev/flat-rate?year=${taxYear}`
                : `/accounty/${id}/${dateRange}/ev/entrepreneurial/base?year=${taxYear}`;
            }

            const InnerContent = (
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold shrink-0',
                    ret.status === 'submitted' ? 'bg-green-100 dark:bg-green-900/30 text-green-600'
                      : ret.status === 'draft' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  )}>
                    {ret.code}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100 hover:text-indigo-600 transition-colors">{ret.type}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-slate-500">{ret.period}</span>
                      <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full', cfg.color)}>
                        <Icon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
                  <div className="text-right">
                    <p className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                      {ret.amount > 0 ? formatHuf(ret.amount) : '–'}
                    </p>
                    {ret.deadline && (
                      <p className="text-[10px] text-slate-400 flex items-center gap-1 justify-end">
                        <Calendar className="w-3 h-3" />
                        Határidő: {new Date(ret.deadline).toLocaleDateString('hu-HU')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {ret.status !== 'submitted' && (
                      <button
                        onClick={() => handlePrepareAndDownload(ret)}
                        className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 hover:bg-indigo-100 transition-colors"
                        title="Benyújtás"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        let xmlContent = ret.xmlData;
                        let isOfficial = true;
                        if (!xmlContent) {
                          xmlContent = generateDraftReturnXml(ret.code, ret.period, client);
                          isOfficial = false;
                        }
                        const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        const filename = isOfficial 
                          ? `NAV_${ret.code}_${ret.period.replace(/\s+/g, '_')}.xml`
                          : `NAV_${ret.code}_${ret.period.replace(/\s+/g, '_')}_tervezet.xml`;
                        a.download = filename;
                        a.click();
                        URL.revokeObjectURL(url);
                        toast({ 
                          title: 'Siker', 
                          description: isOfficial ? 'Bevallás XML letöltve.' : 'Tervezet XML letöltve (ÁNYK/ONYA ellenőrzéshez).' 
                        });
                      }}
                      className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500 hover:bg-slate-100 transition-colors"
                      title={ret.status === 'submitted' ? "Letöltés" : "Tervezet XML letöltése"}
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );

            return (
              <div key={ret.id} className={cn(
                'bg-card rounded-xl border shadow-soft overflow-hidden transition-all hover:shadow-md',
                ret.status === 'overdue' ? 'border-red-200 dark:border-red-800' : 'border-border'
              )}>
                {linkPath ? (
                  <Link to={linkPath} className="block hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                    {InnerContent}
                  </Link>
                ) : (
                  InnerContent
                )}
                {ret.submittedDate && (
                  <div className="px-5 py-2 bg-green-50/50 dark:bg-green-900/10 border-t border-green-100 dark:border-green-900/30">
                    <p className="text-[10px] text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Benyújtva: {new Date(ret.submittedDate).toLocaleDateString('hu-HU')}
                      {ret.navSubmissionId && ` — NAV nyugta: ${ret.navSubmissionId}`}
                    </p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
