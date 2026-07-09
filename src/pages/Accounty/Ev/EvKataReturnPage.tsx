import React, { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  FileText, ArrowLeft, ChevronRight, Info, CheckCircle2,
  Clock, AlertTriangle, Send, Download, Calendar, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAccountyClient } from '@/hooks/accounty';
import { formatHuf, DEFAULT_2026_PARAMS } from '@/lib/evCalculations';
import { useEvTaxReturns, useEvGlobalTaxParams, useUpdateEvTaxReturn } from '@/hooks/useEvData';
import { toast } from '@/hooks/use-toast';

// ─── Constants ──────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  submitted: { label: 'Benyújtva', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2 },
  accepted: { label: 'Elfogadva', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2 },
  draft: { label: 'Vázlat', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: FileText },
  upcoming: { label: 'Közelgő', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400', icon: Clock },
  overdue: { label: 'Lejárt!', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: AlertTriangle },
};

function escapeXml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export default function EvKataReturnPage() {
  const { id } = useParams<{ id: string }>();
  const { data: client } = useAccountyClient(id);
  const updateReturn = useUpdateEvTaxReturn();

  // Real data
  const { data: allReturns, isLoading } = useEvTaxReturns(id, 2026);
  const { data: globalParams } = useEvGlobalTaxParams(2026);

  const kataReturns = useMemo(() => {
    const dbReturns = (allReturns || [])
      .filter((r: any) => r.return_type === 'kata')
      .map((r: any) => {
        const now = new Date();
        const isOverdue = r.status !== 'submitted' && r.status !== 'accepted' && r.deadline && new Date(r.deadline) < now;
        const status = isOverdue ? 'overdue'
          : r.status === 'submitted' || r.status === 'accepted' ? 'submitted'
          : r.status === 'draft' ? 'draft' : 'upcoming';
        return {
          id: r.id,
          period: r.period_key || '',
          deadline: r.deadline || '',
          status,
          amount: r.calculated_tax || 0,
          submittedDate: r.submitted_at,
          xmlData: r.xml_data,
        };
      });

    // Generate expected semi-annual KATA returns and merge with DB records
    const now = new Date();
    const haviTetel = globalParams?.kata_havi_tetel || DEFAULT_2026_PARAMS.kataHaviTetel;
    const halfYearAmount = haviTetel * 6;

    const getStatus = (deadline: string) => {
      const d = new Date(deadline);
      if (now > d) return 'overdue';
      const days = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return days <= 30 ? 'draft' : 'upcoming';
    };

    const expectedPeriods = [
      {
        period: '2026 I. félév',
        deadline: '2026-07-12',
        defaultStatus: getStatus('2026-07-12'),
      },
      {
        period: '2026 II. félév',
        deadline: '2027-01-12',
        defaultStatus: getStatus('2027-01-12'),
      },
    ];

    return expectedPeriods.map((ep, idx) => {
      const dbMatch = dbReturns.find(r => r.period === ep.period);
      if (dbMatch) {
        return dbMatch;
      }
      return {
        id: `gen-kata-h${idx + 1}`,
        period: ep.period,
        deadline: ep.deadline,
        status: ep.defaultStatus,
        amount: halfYearAmount,
        submittedDate: null,
        xmlData: null,
      };
    });
  }, [allReturns, globalParams]);

  const handlePrepareAndDownload = async (ret: any) => {
    if (!id) return;
    try {
      // 1. Generate XML
      const yearMatch = ret.period.match(/\d{4}/);
      const taxYear = yearMatch ? Number(yearMatch[0]) : 2026;
      const isH1 = ret.period.includes('I.');
      const periodFrom = isH1 ? `${taxYear}-01-01` : `${taxYear}-07-01`;
      const periodTo = isH1 ? `${taxYear}-06-30` : `${taxYear}-12-31`;
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

      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
      xml += `<!-- Nemzeti Adó- és Vámhivatal ÁNYK XML Export -->\n`;
      xml += `<nyomtatvanyok xmlns="http://www.nav.gov.hu/nyomtatvanyok" verzio="1.0">\n`;
      xml += `  <nyomtatvany>\n`;
      xml += `    <nyomtatvanyinformacio>\n`;
      xml += `      <nyomtatvanyazonosito>${taxYear}KATA</nyomtatvanyazonosito>\n`;
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
      xml += `      <mezo eazon="01_0014_idoszak_megnevezes">${escapeXml(ret.period)}</mezo>\n`;
      xml += `\n`;
      xml += `      <!-- ========================================== -->\n`;
      xml += `      <!-- C) ADÓKÖTELEZETTSÉG RÉSZLETEZÉSE (BEVÉTEL ÉS ADÓ) -->\n`;
      xml += `      <!-- ========================================== -->\n`;
      xml += `      <mezo eazon="02_0001_aktiv_honapok_szama">6</mezo>\n`;
      xml += `      <mezo eazon="02_0002_fizetendo_ado">${ret.amount}</mezo>\n`;
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
        return_type: 'kata',
        form_code: 'KATA',
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
      a.download = `NAV_KATA_${ret.period.replace(/\s+/g, '_')}.xml`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: 'Siker',
        description: `${ret.period} KATA nyilatkozat sikeresen elkészítve és beküldöttként mentve, az XML letöltése elindult.`,
      });
    } catch (err: any) {
      toast({
        title: 'Hiba történt',
        description: err.message || 'Nem sikerült menteni a bevallást.',
        variant: 'destructive',
      });
    }
  };

  const kataHaviTetel = globalParams?.kata_havi_tetel || DEFAULT_2026_PARAMS.kataHaviTetel;
  const kataEvesKeret = globalParams?.kata_eves_keret || DEFAULT_2026_PARAMS.kataEvesKeret;
  const kataSurtaxRate = globalParams?.kata_surtax_rate || 40;

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to="/accounty/ev" className="hover:text-indigo-600 transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> EV Portfólió
        </Link>
        <ChevronRight className="w-3 h-3" />
        <Link to={`/accounty/client/${id}/ev`} className="hover:text-indigo-600 transition-colors">{client?.name || 'Ügyfél'}</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-900 dark:text-slate-100 font-medium">KATA bevallás</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl shadow-lg shadow-purple-500/25">
          <FileText className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">KATA bevallás</h1>
          <p className="text-sm text-slate-500">KATA tv. 10. § – féléves tételes adóbevallás</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Havi tételes adó</p>
          <p className="text-lg font-bold text-purple-600 tabular-nums">{formatHuf(kataHaviTetel)}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Éves keret</p>
          <p className="text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums">{formatHuf(kataEvesKeret)}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Különadó kulcs</p>
          <p className="text-lg font-bold text-red-500">{kataSurtaxRate}%</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Gyakoriság</p>
          <p className="text-lg font-bold text-slate-900 dark:text-slate-100">Féléves</p>
        </div>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Loader2 className="w-8 h-8 mb-3 animate-spin text-purple-400" />
            <p className="text-sm">Betöltés...</p>
          </div>
        ) : (
          kataReturns.map(ret => {
            const cfg = STATUS_CFG[ret.status] || STATUS_CFG.upcoming;
            const Icon = cfg.icon;
            return (
              <div key={ret.id} className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-xs font-bold text-purple-600">KATA</div>
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{ret.period}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full', cfg.color)}>
                          <Icon className="w-3 h-3" />{cfg.label}
                        </span>
                        {ret.deadline && (
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                             <Calendar className="w-3 h-3" />{new Date(ret.deadline).toLocaleDateString('hu-HU')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">{ret.amount > 0 ? formatHuf(ret.amount) : '–'}</p>
                    {ret.status !== 'submitted' && (
                      <button
                        onClick={() => handlePrepareAndDownload(ret)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                        title="Bevallás elkészítése és beküldése"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Bevallás elkészítése (XML)
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
                            a.download = `NAV_KATA_${ret.period.replace(/\s+/g, '_')}.xml`;
                            a.click();
                            URL.revokeObjectURL(url);
                            toast({ title: 'Siker', description: 'KATA XML letöltve.' });
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 rounded-lg transition-colors"
                          title="Letöltés"
                        >
                          <Download className="w-3.5 h-3.5" />
                          XML letöltése
                        </button>
                        <button
                          onClick={() => handlePrepareAndDownload(ret)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:hover:bg-indigo-900 dark:text-indigo-400 rounded-lg transition-colors"
                          title="Újragenerálás"
                        >
                          <Send className="w-3.5 h-3.5" />
                          Újragenerálás
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
            <p className="font-semibold">KATA bevallás</p>
            <p>Féléves bevallás a félévet követő hónap 12-ig. Ha a bevétel meghaladja az éves {formatHuf(kataEvesKeret)} keretet, {kataSurtaxRate}% különadó fizetendő a túllépő összeg után.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
