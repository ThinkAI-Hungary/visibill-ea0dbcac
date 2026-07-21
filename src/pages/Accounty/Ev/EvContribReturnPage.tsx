import React, { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  FileBarChart, ArrowLeft, ChevronRight, Info, Calculator,
  CheckCircle2, Clock, AlertTriangle, Send, Download, Calendar, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAccountyClient, useEvTaxParams } from '@/hooks/accounty';
import { formatHuf, DEFAULT_2026_PARAMS, calculateQuarterlyContributions } from '@/lib/evCalculations';
import { useEvTaxReturns, useEvContributions, useUpdateEvTaxReturn, useEvClientSettings } from '@/hooks/useEvData';
import { toast } from '@/hooks/use-toast';

// ─── Constants ──────────────────────────────────────────────────────────────

const STATUS_CFG = {
  submitted: { label: 'Benyújtva', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2 },
  accepted: { label: 'Elfogadva', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2 },
  draft: { label: 'Vázlat', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: FileBarChart },
  upcoming: { label: 'Közelgő', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400', icon: Clock },
  overdue: { label: 'Lejárt!', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: AlertTriangle },
};

const QUARTER_LABELS = ['Q1', 'Q2', 'Q3', 'Q4'];

function escapeXml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export default function EvContribReturnPage() {
  const { id } = useParams<{ id: string }>();
  const { data: client } = useAccountyClient(id);
  const updateReturn = useUpdateEvTaxReturn();

  // Real data
  const { data: allReturns, isLoading: returnsLoading } = useEvTaxReturns(id, 2026);
  const { data: contributions } = useEvContributions(id, 2026);
  const { data: settings } = useEvClientSettings(id, 2026);
  const { data: dbParams, isLoading: paramsLoading } = useEvTaxParams(2026);
  
  const isLoading = returnsLoading || paramsLoading;

  const taxParams = dbParams || DEFAULT_2026_PARAMS;

  const contribReturns = useMemo(() => {
    const dbReturns = (allReturns || [])
      .filter((r: any) => r.return_type === '2658' || r.return_type === 'contrib' || r.return_type === 'jarulekbevallas')
      .map((r: any) => {
        const now = new Date();
        const isOverdue = r.status !== 'submitted' && r.status !== 'accepted' && r.deadline && new Date(r.deadline) < now;
        const status = isOverdue ? 'overdue'
          : r.status === 'submitted' || r.status === 'accepted' ? 'submitted'
          : r.status === 'draft' ? 'draft' : 'upcoming';
        return {
          id: r.id,
          quarter: r.period_key || '',
          deadline: r.deadline || '',
          status: status as keyof typeof STATUS_CFG,
          tbAmount: r.data?.tb_amount || 0,
          szochoAmount: r.data?.szocho_amount || 0,
          totalAmount: r.calculated_tax || 0,
          submittedDate: r.submitted_at,
          isGenerated: false,
          xmlData: r.xml_data,
        };
      });

    // Generate expected quarterly returns and merge with DB records
    const now = new Date();
    const deadlines = [
      `2026-04-12`, `2026-07-12`, `2026-10-12`, `2027-01-12`,
    ];

    const expectedQuarters = [1, 2, 3, 4].map((q, i) => {
      const d = new Date(deadlines[i]);
      const isPast = now > d;
      const daysUntil = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const status: keyof typeof STATUS_CFG = isPast ? 'overdue' : daysUntil <= 30 ? 'draft' : 'upcoming';

      // Get amounts from contributions data, fallback to local calculation
      const contribRecord = (contributions || []).find((c: any) => c.quarter === q);
      let tbAmount = contribRecord?.tb_amount;
      let szochoAmount = contribRecord?.szocho_amount;
      let totalAmount = contribRecord?.total_amount;

      if (tbAmount === undefined || szochoAmount === undefined || totalAmount === undefined) {
        const employmentStatus = settings?.employment_status || 'foallasu';
        const isSkilled = settings?.skilled_main_activity ?? false;
        const calc = calculateQuarterlyContributions(
          q, 0, 0, 3, employmentStatus, isSkilled, taxParams
        );
        tbAmount = calc.tbAmount;
        szochoAmount = calc.szochoAmount;
        totalAmount = calc.totalAmount;
      }

      return {
        quarterKey: `2026 ${QUARTER_LABELS[i]}`,
        deadline: deadlines[i],
        defaultStatus: status,
        tbAmount,
        szochoAmount,
        totalAmount,
      };
    });

    return expectedQuarters.map((eq, idx) => {
      const dbMatch = dbReturns.find(r => r.quarter === eq.quarterKey);
      if (dbMatch) {
        return dbMatch;
      }
      return {
        id: `gen-2658-Q${idx + 1}`,
        quarter: eq.quarterKey,
        deadline: eq.deadline,
        status: eq.defaultStatus,
        tbAmount: eq.tbAmount,
        szochoAmount: eq.szochoAmount,
        totalAmount: eq.totalAmount,
        submittedDate: null,
        isGenerated: true,
        xmlData: null,
      };
    });
  }, [allReturns, contributions, settings, taxParams]);

  const handlePrepareAndDownload = async (ret: any) => {
    if (!id) return;
    try {
      // 1. Generate XML
      const yearMatch = ret.quarter.match(/\d{4}/);
      const taxYear = yearMatch ? Number(yearMatch[0]) : 2026;
      
      let periodFrom = `${taxYear}-01-01`;
      let periodTo = `${taxYear}-12-31`;
      
      if (ret.quarter.includes('Q1')) {
        periodFrom = `${taxYear}-01-01`;
        periodTo = `${taxYear}-03-31`;
      } else if (ret.quarter.includes('Q2')) {
        periodFrom = `${taxYear}-04-01`;
        periodTo = `${taxYear}-06-30`;
      } else if (ret.quarter.includes('Q3')) {
        periodFrom = `${taxYear}-07-01`;
        periodTo = `${taxYear}-09-30`;
      } else if (ret.quarter.includes('Q4')) {
        periodFrom = `${taxYear}-10-01`;
        periodTo = `${taxYear}-12-31`;
      }

      const currentDate = new Date().toISOString().slice(0, 10);

      const taxNum = client?.taxNumber || client?.tax_number || '';
      const taxParts = taxNum.split('-');
      const taxNum8 = taxParts[0] || '';
      const taxNumVat = taxParts[1] || '';
      const taxNumCounty = taxParts[2] || '';

      const taxId = client?.taxId || client?.tax_id || '8329900747';
      const clientName = client?.name || 'Egyéni Vállalkozó';
      const clientAddress = client?.address || '1054 Budapest, Alkotmány utca 4.';
      const clientEmail = client?.email || `${clientName.toLowerCase().replace(/[^a-z0-9]/g, '')}@gmail.com`;
      const clientPhone = client?.phone || '+36 30 123 4567';

      const tbBase = ret.tbAmount > 0 ? Math.round(ret.tbAmount / taxParams.tbJarulekKulcs) : 0;
      const szochoBase = ret.szochoAmount > 0 ? Math.round(ret.szochoAmount / taxParams.szochoKulcs) : 0;

      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
      xml += `<!-- Nemzeti Adó- és Vámhivatal ÁNYK XML Export -->\n`;
      xml += `<nyomtatvanyok xmlns="http://www.nav.gov.hu/nyomtatvanyok" verzio="1.0">\n`;
      xml += `  <nyomtatvany>\n`;
      xml += `    <nyomtatvanyinformacio>\n`;
      xml += `      <nyomtatvanyazonosito>${taxYear}58</nyomtatvanyazonosito>\n`;
      xml += `      <verzio>1.0</verzio>\n`;
      xml += `    </nyomtatvanyinformacio>\n`;
      xml += `    <mezok>\n`;
      xml += `      <!-- ========================================== -->\n`;
      xml += `      <!-- A) FŐLAP - AZONOSÍTÓ ÉS KAPCSOLATTARTÁSI ADATOK -->\n`;
      xml += `      <!-- ========================================== -->\n`;
      xml += `      <mezo eazon="01_0001_adoszam_torzs">${taxNum8}</mezo>\n`;
      xml += `      <mezo eazon="01_0002_adoszam_afa">${taxNumVat}</mezo>\n`;
      xml += `      <mezo eazon="01_0003_adoszam_megye">${taxNumCounty}</mezo>\n`;
      xml += `      <mezo eazon="01_0004_adoszam_teljes">${taxNum}</mezo>\n`;
      xml += `      <mezo eazon="01_0005_adoazonosito">${taxId}</mezo>\n`;
      xml += `      <mezo eazon="01_0006_adozo_nev">${escapeXml(clientName)}</mezo>\n`;
      xml += `      <mezo eazon="01_0007_szekhely_cim">${escapeXml(clientAddress)}</mezo>\n`;
      xml += `      <mezo eazon="01_0008_email">${escapeXml(clientEmail)}</mezo>\n`;
      xml += `      <mezo eazon="01_0009_telefon">${escapeXml(clientPhone)}</mezo>\n`;
      xml += `\n`;
      xml += `      <!-- ========================================== -->\n`;
      xml += `      <!-- B) IDŐSZAK ÉS NYILATKOZAT TÍPUSA -->\n`;
      xml += `      <!-- ========================================== -->\n`;
      xml += `      <mezo eazon="01_0010_adoev">${taxYear}</mezo>\n`;
      xml += `      <mezo eazon="01_0011_idoszak_tol">${periodFrom}</mezo>\n`;
      xml += `      <mezo eazon="01_0012_idoszak_ig">${periodTo}</mezo>\n`;
      xml += `      <mezo eazon="01_0013_bevallastipus">M</mezo>\n`;
      xml += `      <mezo eazon="01_0014_idoszak_megnevezes">${escapeXml(ret.quarter)}</mezo>\n`;
      xml += `\n`;
      xml += `      <!-- ========================================== -->\n`;
      xml += `      <!-- C) TB JÁRULÉK ÉS SZOCHO KÖTELEZETTSÉGEK -->\n`;
      xml += `      <!-- ========================================== -->\n`;
      xml += `      <mezo eazon="02_0001_tb_jarulekalap">${tbBase}</mezo>\n`;
      xml += `      <mezo eazon="02_0002_tb_jarulekosszeg">${ret.tbAmount}</mezo>\n`;
      xml += `      <mezo eazon="02_0003_szocho_alap">${szochoBase}</mezo>\n`;
      xml += `      <mezo eazon="02_0004_szocho_osszeg">${ret.szochoAmount}</mezo>\n`;
      xml += `      <mezo eazon="02_0005_osszesen_fizetendo">${ret.totalAmount}</mezo>\n`;
      xml += `\n`;
      xml += `      <!-- ========================================== -->\n`;
      xml += `      <!-- D) NYILATKOZAT ÉS KELTEZÉS -->\n`;
      xml += `      <!-- ========================================== -->\n`;
      xml += `      <mezo eazon="03_0001_nyilatkozat_adat_valos">1</mezo>\n`;
      xml += `      <mezo eazon="03_0002_kelt_hely">Budapest</mezo>\n`;
      xml += `      <mezo eazon="03_0003_kelt_datum">${currentDate}</mezo>\n`;
      xml += `    </mezok>\n`;
      xml += `  </nyomtatvany>\n`;
      xml += `</nyomtatvanyok>\n`;

      // 2. Save/upsert return to db
      await updateReturn.mutateAsync({
        company_id: id,
        tax_year: 2026,
        return_type: 'jarulekbevallas',
        form_code: '2658',
        period_key: ret.quarter,
        status: 'submitted',
        calculated_tax: ret.totalAmount,
        paid_amount: 0,
        deadline: ret.deadline || null,
        submitted_at: new Date().toISOString(),
        xml_data: xml,
        data: {
          quarter: ret.quarter,
          tb_amount: ret.tbAmount,
          szocho_amount: ret.szochoAmount,
          total_amount: ret.totalAmount,
        }
      });

      // 3. Download the file
      const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `NAV_58_${ret.quarter.replace(/\s+/g, '_')}.xml`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: 'Siker',
        description: `${ret.quarter} TB/Szocho bevallás (58-as) sikeresen elkészítve és beküldöttként mentve, az XML letöltése elindult.`,
      });
    } catch (err: any) {
      toast({
        title: 'Hiba történt',
        description: err.message || 'Nem sikerült menteni a bevallást.',
        variant: 'destructive',
      });
    }
  };

  const totalPaid = contribReturns.filter(r => r.status === 'submitted').reduce((s, r) => s + r.totalAmount, 0);
  const totalExpected = contribReturns.reduce((s, r) => s + r.totalAmount, 0);
  const tbRate = taxParams.tbJarulekKulcs * 100;
  const szochoRate = taxParams.szochoKulcs * 100;

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to="/accounty/ev" className="hover:text-indigo-600 transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> EV Portfólió
        </Link>
        <ChevronRight className="w-3 h-3" />
        <Link to={`/accounty/client/${id}/ev`} className="hover:text-indigo-600 transition-colors">{client?.name || 'Ügyfél'}</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-900 dark:text-slate-100 font-medium">TB/Szocho bevallás (58-as)</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl shadow-lg shadow-teal-500/25">
          <FileBarChart className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">TB/Szocho bevallás (58-as nyomtatvány)</h1>
          <p className="text-sm text-slate-500">Tbj. 51. § – negyedéves járulékbevallás</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">YTD befizetett</p>
          <p className="text-lg font-bold text-teal-600 tabular-nums">{isLoading ? '...' : formatHuf(totalPaid)}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">TB kulcs</p>
          <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{tbRate}%</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Szocho kulcs</p>
          <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{szochoRate}%</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Gyakoriság</p>
          <p className="text-lg font-bold text-slate-900 dark:text-slate-100">Negyedéves</p>
        </div>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Loader2 className="w-8 h-8 mb-3 animate-spin text-teal-400" />
            <p className="text-sm">Betöltés...</p>
          </div>
        ) : (
          contribReturns.map(ret => {
            const cfg = STATUS_CFG[ret.status] || STATUS_CFG.upcoming;
            const Icon = cfg.icon;
            return (
              <div key={ret.id} className={cn(
                'bg-card rounded-xl border shadow-soft overflow-hidden',
                ret.status === 'overdue' ? 'border-red-300 dark:border-red-800' : 'border-border'
              )}>
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold',
                      ret.status === 'overdue' ? 'bg-red-100 dark:bg-red-900/30 text-red-600'
                        : 'bg-teal-100 dark:bg-teal-900/30 text-teal-600'
                    )}>58</div>
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{ret.quarter} – TB/Szocho bevallás</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full', cfg.color)}>
                          <Icon className="w-3 h-3" />{cfg.label}
                        </span>
                        {ret.deadline && (
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />Határidő: {new Date(ret.deadline).toLocaleDateString('hu-HU')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      {(ret.tbAmount > 0 || ret.szochoAmount > 0) && (
                        <p className="text-xs text-slate-400">TB: {formatHuf(ret.tbAmount)} | Szocho: {formatHuf(ret.szochoAmount)}</p>
                      )}
                      <p className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                        {ret.totalAmount > 0 ? formatHuf(ret.totalAmount) : '–'}
                      </p>
                    </div>
                    {ret.status !== 'submitted' && (
                      <button
                        onClick={() => handlePrepareAndDownload(ret)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-sm shadow-indigo-600/10"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Bevallás elkészítése</span>
                      </button>
                    )}
                    {ret.status === 'submitted' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            if (!ret.xmlData) {
                              toast({ title: 'Hiba', description: 'Nincs társított XML adat ehhez a bevalláshoz.' });
                              return;
                            }
                            const blob = new Blob([ret.xmlData], { type: 'application/xml;charset=utf-8' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `NAV_58_${ret.quarter.replace(/\s+/g, '_')}.xml`;
                            a.click();
                            URL.revokeObjectURL(url);
                            toast({ title: 'Siker', description: 'Járulékbevallás XML letöltve.' });
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 rounded-lg transition-colors shadow-sm"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>XML letöltése</span>
                        </button>
                        <button
                          onClick={() => handlePrepareAndDownload(ret)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:hover:bg-indigo-900 dark:text-indigo-400 rounded-lg transition-colors shadow-sm"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Újragenerálás</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-xs text-blue-600 dark:text-blue-400">
            <p className="font-semibold">58-as nyomtatvány</p>
            <p>A negyedéves járulékbevallást a negyedévet követő hónap 12-ig kell benyújtani. Főfoglalkozású EV-nál a járulékalap legalább a minimálbér/garantált bérminimum.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
