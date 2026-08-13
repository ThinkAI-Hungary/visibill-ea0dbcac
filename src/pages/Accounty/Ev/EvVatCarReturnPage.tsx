import { useDateRange } from '@/contexts/DateRangeContext';
import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  Receipt, Car, ArrowLeft, ChevronRight, Info, CheckCircle2,
  Clock, AlertTriangle, Send, Download, Calendar, Loader2, ShieldCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAccountyClient } from '@/hooks/accounty';
import { formatHuf } from '@/lib/evCalculations';
import { useEvTaxReturns, useEvClientSettings, useUpdateEvTaxReturn } from '@/hooks/useEvData';
import { toast } from '@/hooks/use-toast';

// ─── Constants ──────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  submitted: { label: 'Benyújtva', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2 },
  accepted: { label: 'Elfogadva', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2 },
  draft: { label: 'Vázlat', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: Receipt },
  upcoming: { label: 'Közelgő', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400', icon: Clock },
  overdue: { label: 'Lejárt!', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: AlertTriangle },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function getDateStatus(deadline: string): string {
  const now = new Date();
  const d = new Date(deadline);
  if (now > d) return 'overdue';
  const days = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return days <= 30 ? 'draft' : 'upcoming';
}

function mapReturn(r: any) {
  const now = new Date();
  const isOverdue = r.status !== 'submitted' && r.status !== 'accepted' && r.deadline && new Date(r.deadline) < now;
  const status = isOverdue ? 'overdue'
    : r.status === 'submitted' || r.status === 'accepted' ? 'submitted'
    : r.status === 'draft' ? 'draft' : 'upcoming';
  return {
    id: r.id,
    type: r.return_type === 'afa' ? 'ÁFA bevallás'
      : r.return_type === 'car' ? 'Cégautóadó' : r.return_type,
    code: r.form_code || (r.return_type === 'afa' ? '65A' : 'CAR'),
    period: r.period_key || '',
    deadline: r.deadline || '',
    status,
    amount: r.calculated_tax || 0,
    submittedDate: r.submitted_at,
    xmlData: r.xml_data,
  };
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function EvVatCarReturnPage() {
  const { companyId, dateRange } = useParams<{ companyId: string; dateRange: string }>();
  const id = companyId;
  const { data: client } = useAccountyClient(id);
  const updateReturn = useUpdateEvTaxReturn();
  const [searchParams] = useSearchParams();
  const { dateFrom, setDateFrom, setDateTo, dateFromFormatted, dateToFormatted } = useDateRange();
  const taxYear = dateFrom.getFullYear();

  const { data: allReturns, isLoading } = useEvTaxReturns(id, taxYear);
  const { data: evSettings } = useEvClientSettings(id, taxYear);

  const isAlanyiMentes = evSettings?.vat_status === 'alanyi_mentes';

  const quarterDeadlines = useMemo(() => [
    { q: 'Q1', deadline: `${taxYear}-04-20` },
    { q: 'Q2', deadline: `${taxYear}-07-20` },
    { q: 'Q3', deadline: `${taxYear}-10-20` },
    { q: 'Q4', deadline: `${taxYear + 1}-01-20` },
  ], [taxYear]);

  const vatReturns = useMemo(() => {
    const dbReturns = (allReturns || []).filter((r: any) => r.return_type === 'afa').map(mapReturn);
    if (dbReturns.length === 0 && !isAlanyiMentes) {
      return quarterDeadlines.map(qd => ({
        id: `gen-afa-${qd.q}`,
        type: 'ÁFA bevallás',
        code: '65A',
        period: `${taxYear} ${qd.q}`,
        deadline: qd.deadline,
        status: getDateStatus(qd.deadline),
        amount: 0,
        submittedDate: null,
      }));
    }
    return dbReturns;
  }, [allReturns, isAlanyiMentes, quarterDeadlines, taxYear]);

  const carReturns = useMemo(() => {
    const dbReturns = (allReturns || []).filter((r: any) => r.return_type === 'car' || r.return_type === 'cegautado').map(mapReturn);
    // Cégautóadó is only needed if the EV uses a company car — show placeholder message
    return dbReturns;
  }, [allReturns]);

  const handlePrepareAndDownload = async (ret: any) => {
    if (!id) return;
    try {
      const isCar = ret.type?.toLowerCase().includes('cégautó') || ret.code === 'CAR';
      const rType = isCar ? 'car' : 'afa';
      const fCode = isCar ? 'CAR' : (ret.code || '65A');

      // 1. Generate XML
      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
      xml += `<nav_bevallassablon xmlns="http://www.nav.gov.hu/bevallas" verzio="1.0">\n`;
      xml += `  <fejlec>\n`;
      xml += `    <nyomtatvany>${fCode}</nyomtatvany>\n`;
      xml += `    <adoszam>${client?.taxNumber || client?.tax_number || ''}</adoszam>\n`;
      xml += `    <nev>${client?.name || 'Egyéni Vállalkozó'}</nev>\n`;
      xml += `    <idoszak>${ret.period}</idoszak>\n`;
      xml += `  </fejlec>\n`;
      xml += `  <tartalom>\n`;
      xml += `    <fizetendo>${ret.amount}</fizetendo>\n`;
      xml += `  </tartalom>\n`;
      xml += `</nav_bevallassablon>\n`;

      // 2. Save/upsert return to db
      await updateReturn.mutateAsync({
        company_id: id,
        tax_year: taxYear,
        return_type: rType,
        form_code: fCode,
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
      a.download = `NAV_${fCode}_${ret.period.replace(/\s+/g, '_')}.xml`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: 'Siker',
        description: `${ret.period} ${isCar ? 'Cégautóadó' : 'ÁFA'} bevallás sikeresen elkészítve és beküldöttként mentve, az XML letöltése elindult.`,
      });
    } catch (err: any) {
      toast({
        title: 'Hiba történt',
        description: err.message || 'Nem sikerült menteni a bevallást.',
        variant: 'destructive',
      });
    }
  };

  const renderSection = (
    title: string,
    icon: React.ReactNode,
    returns: ReturnType<typeof mapReturn>[],
    badgeLabel: string,
    badgeBg: string,
    badgeIcon: React.ReactNode,
    emptyMessage?: string,
  ) => (
    <div>
      <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
        {icon} {title}
      </h2>
      <div className="space-y-2">
        {returns.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-4 text-center">
            <p className="text-xs text-slate-400">{emptyMessage || 'Nincs bevallás rögzítve'}</p>
          </div>
        ) : (
          returns.map(ret => {
            const cfg = STATUS_CFG[ret.status] || STATUS_CFG.upcoming;
            const Icon = cfg.icon;
            return (
              <div key={ret.id} className={cn(
                'bg-card rounded-xl border shadow-soft flex items-center justify-between px-5 py-3',
                ret.status === 'overdue' ? 'border-red-300 dark:border-red-800' : 'border-border'
              )}>
                <div className="flex items-center gap-3">
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold', badgeBg)}>
                    {badgeIcon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{ret.period}</p>
                    <div className="flex items-center gap-2 mt-0.5">
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
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">{ret.amount > 0 ? formatHuf(ret.amount) : '–'}</p>
                  </div>
                  {ret.status !== 'submitted' && (
                    <button
                      onClick={() => handlePrepareAndDownload(ret)}
                      className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 hover:bg-indigo-100 transition-colors"
                      title="Bevallás elkészítése és beküldése"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {ret.status === 'submitted' && (
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
                        a.download = `NAV_${ret.code}_${ret.period.replace(/\s+/g, '_')}.xml`;
                        a.click();
                        URL.revokeObjectURL(url);
                        toast({ title: 'Siker', description: 'Bevallás XML letöltve.' });
                      }}
                      className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500 hover:bg-slate-100 transition-colors"
                      title="Letöltés"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to="/eaisybooks?tab=ev" className="hover:text-indigo-600 transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> EV Portfólió
        </Link>
        <ChevronRight className="w-3 h-3" />
        <Link to={`/eaisybooks/${id}/${dateRange}/ev?year=${taxYear}`} className="hover:text-indigo-600 transition-colors">{client?.name || 'Ügyfél'}</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-900 dark:text-slate-100 font-medium">ÁFA & Cégautóadó bevallás</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl shadow-lg shadow-cyan-500/25">
          <Receipt className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">ÁFA & Cégautóadó bevallás</h1>
          <p className="text-sm text-slate-500">65A nyomtatvány (ÁFA) és cégautóadó negyedéves bevallás</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-8 h-8 mb-3 animate-spin text-cyan-400" />
          <p className="text-sm">Betöltés...</p>
        </div>
      ) : (
        <>
          {renderSection(
            'ÁFA bevallások (65A)',
            <Receipt className="w-4 h-4 text-cyan-600" />,
            vatReturns,
            '65A',
            'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600',
            <span>65A</span>,
            isAlanyiMentes ? '✅ Alanyi adómentes – ÁFA bevallás nem szükséges' : undefined,
          )}

          {renderSection(
            'Cégautóadó bevallások',
            <Car className="w-4 h-4 text-rose-600" />,
            carReturns,
            'CAR',
            'bg-rose-100 dark:bg-rose-900/30',
            <Car className="w-4 h-4 text-rose-600" />,
            'Nem használ cégautót – bevallás nem szükséges',
          )}
        </>
      )}

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-xs text-blue-600 dark:text-blue-400">
            <p className="font-semibold">ÁFA & Cégautóadó bevallás</p>
            <p>Negyedéves bevallás a negyedévet követő hónap 20-ig. Alanyi adómentes EV-nak ÁFA bevallás nem szükséges, de cégautóadó igen ha cégautót használ.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
