import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, CreditCard, Download, CheckCircle,
  Eye, Loader2, Database, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExportButton } from '@/components/accounty/ExportButton';
import { cn } from '@/lib/utils';
import { useTransfers, useGenerateDocuments, type Transfer } from '@/hooks/accounty';
import { useAccountyClients } from '@/hooks/accounty';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { generateTransferPdf } from '@/lib/documentPdfs';
import { usePayrollCycles, usePayrollCalculations } from '@/hooks/usePayrollData';
import { UnifiedPagination } from '@/components/ui/unified-pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

const CURRENT_DATE = new Date();
const CURRENT_YEAR = CURRENT_DATE.getFullYear();
const CURRENT_MONTH = CURRENT_DATE.getMonth() + 1;
const DEFAULT_CALENDAR_PERIOD = `${CURRENT_YEAR}-${String(CURRENT_MONTH).padStart(2, '0')}`;

const MONTH_NAMES = [
  'Január', 'Február', 'Március', 'Április', 'Május', 'Június',
  'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December'
];

function formatPeriodLabel(year: number, month: number, status?: string) {
  const monthName = MONTH_NAMES[month - 1] || `${month}. hó`;
  const statusBadge = status === 'completed' || status === 'approved' ? ' (Lezárt)' : status === 'in_progress' ? ' (Folyamatban)' : '';
  return `${year}. ${monthName}${statusBadge}`;
}

export default function TransferListPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const id = companyId;
  const [searchParams, setSearchParams] = useSearchParams();
  const queryPeriod = searchParams.get('period');
  const { toast } = useToast();
  const generateDocs = useGenerateDocuments();

  const { data: clients } = useAccountyClients();
  const { data: cycles = [] } = usePayrollCycles(id || '');
  const company = clients?.find(c => c.id === id);

  const availablePeriods = useMemo(() => {
    const list = cycles.map(c => ({
      period: `${c.year}-${String(c.month).padStart(2, '0')}`,
      label: formatPeriodLabel(c.year, c.month, c.status),
      cycleId: c.id,
    }));
    if (!list.some(item => item.period === DEFAULT_CALENDAR_PERIOD)) {
      list.push({
        period: DEFAULT_CALENDAR_PERIOD,
        label: formatPeriodLabel(CURRENT_YEAR, CURRENT_MONTH),
        cycleId: '',
      });
    }
    return list;
  }, [cycles]);

  const [selectedPeriod, setSelectedPeriod] = useState<string>(() => {
    return queryPeriod || DEFAULT_CALENDAR_PERIOD;
  });

  const hasAutoSelectedLatest = useRef(false);
  useEffect(() => {
    if (!queryPeriod && cycles.length > 0 && !hasAutoSelectedLatest.current) {
      hasAutoSelectedLatest.current = true;
      const latest = `${cycles[0].year}-${String(cycles[0].month).padStart(2, '0')}`;
      setSelectedPeriod(latest);
    }
  }, [cycles, queryPeriod]);

  const handlePeriodChange = (newPeriod: string) => {
    setSelectedPeriod(newPeriod);
    setCurrentPage(1);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('period', newPeriod);
      return next;
    }, { replace: true });
  };

  const { data: transfers, isLoading } = useTransfers(id || '', selectedPeriod);

  const selectedCycle = useMemo(() => {
    const [yStr, mStr] = selectedPeriod.split('-');
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10);
    return cycles.find(c => c.year === y && c.month === m) || cycles[0];
  }, [cycles, selectedPeriod]);

  const { data: calculations = [] } = usePayrollCalculations(selectedCycle?.id || '');

  const [exportFormat, setExportFormat] = useState<'sepa' | 'mt940'>('sepa');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const transferList = React.useMemo(() => {
    if (!transfers) return [];
    const seen = new Set<string>();
    const unique: Transfer[] = [];
    for (const t of transfers) {
      const key = `${t.employeeId || t.employeeName}:${t.period}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(t);
      }
    }
    return unique.sort((a, b) => (a.employeeName || '').localeCompare(b.employeeName || '', 'hu', { sensitivity: 'base' }));
  }, [transfers]);
  const totalItems = transferList.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  const paginatedTransfers = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return transferList.slice(start, start + pageSize);
  }, [transferList, currentPage, pageSize]);

  const fmt = (n: number) => n.toLocaleString('hu-HU');
  const readyCount = transferList.filter(t => t.status === 'approved').length;
  const totalAmount = transferList.filter(t => t.status === 'approved').reduce((s, t) => s + t.netSalary, 0);

  const handleExportFormat = () => {
    if (transferList.length === 0) return;
    if (exportFormat === 'sepa') {
      downloadSepaXml(transferList, company?.name || '', selectedPeriod);
    } else {
      downloadMt940(transferList, company?.name || '', selectedPeriod);
    }
  };

  const handlePreview = () => {
    if (calculations.length === 0) return;
    const url = generateTransferPdf({
      companyName: company?.name || '–',
      period: selectedCycle ? `${selectedCycle.year}/${String(selectedCycle.month).padStart(2, '0')}` : selectedPeriod,
      calculations: calculations as any[],
    });
    setPreviewUrl(url);
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 page-animate">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => window.history.back()} className="p-2 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="w-5 h-5" /></button>
          <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg shadow-lg shadow-emerald-500/25"><CreditCard className="w-5 h-5 text-white" /></div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold">Utalási lista</h1>
              <div className="w-56">
                <Select value={selectedPeriod} onValueChange={handlePeriodChange}>
                  <SelectTrigger className="h-8 text-xs font-semibold bg-background border-border">
                    <SelectValue placeholder="Időszak választása" />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePeriods.map(p => (
                      <SelectItem key={p.period} value={p.period} className="text-xs">
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{selectedPeriod} — Bér utalási állomány</p>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <Button variant="outline" className="gap-1.5" onClick={handlePreview} disabled={calculations.length === 0}>
            <Eye className="w-4 h-4" /> Megtekintés
          </Button>
          <select value={exportFormat} onChange={e => setExportFormat(e.target.value as any)} className="px-3 py-2 rounded-lg border border-border bg-background text-sm">
            <option value="sepa">SEPA XML</option><option value="mt940">MT940</option>
          </select>
          <Button onClick={handleExportFormat} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700" disabled={transferList.length === 0}>
            <Download className="w-4 h-4" />
            Exportálás ({exportFormat.toUpperCase()})
          </Button>
          <ExportButton
            filename={`utalasi_lista_${selectedPeriod}`}
            headers={['Kedvezményezett', 'Bankszámla', 'Nettó (Ft)', 'Státusz']}
            getRows={() => transferList.map(t => [t.employeeName, t.bankAccount || '', t.netSalary, t.status])}
            size="sm"
            pdfOptions={{ title: `Utalási lista — ${selectedPeriod}` }}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32 gap-2 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /> Betöltés...</div>
      ) : transferList.length === 0 ? (
        <div className="bg-card rounded-lg border border-border p-12 text-center space-y-3">
          <Database className="w-10 h-10 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nincsenek utalási tételek erre az időszakra ({selectedPeriod}).</p>
          <p className="text-xs text-muted-foreground">Az utalási lista a bérszámfejtés véglegesítése után generálódik.</p>
          {calculations.length > 0 && (
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    await generateDocs.mutateAsync({
                      companyId: id || '',
                      docType: 'transfer',
                      cycleId: selectedCycle?.id,
                      period: selectedPeriod,
                    });
                    toast({ title: 'Sikeres generálás', description: 'Az utalási lista elkészült a kiválasztott időszakra.' });
                  } catch (e: any) {
                    toast({ title: 'Hiba a generálás során', description: e.message || 'Sikertelen generálás', variant: 'destructive' });
                  }
                }}
                disabled={generateDocs.isPending}
                className="gap-1.5"
              >
                {generateDocs.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Utalási lista generálása ({calculations.length} számfejtett dolgozó)
              </Button>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-card rounded-lg border border-border p-4 text-center"><p className="text-2xl font-bold text-blue-600">{transferList.length}</p><p className="text-xs text-muted-foreground">Összes tétel</p></div>
            <div className="bg-card rounded-lg border border-border p-4 text-center"><p className="text-2xl font-bold text-emerald-600">{readyCount}</p><p className="text-xs text-muted-foreground">Utalásra kész</p></div>
            <div className="bg-card rounded-lg border border-border p-4 text-center"><p className="text-lg font-bold font-mono text-emerald-600">{fmt(totalAmount)} Ft</p><p className="text-xs text-muted-foreground">Összes nettó</p></div>
          </div>

          <div className="bg-card rounded-lg border border-border shadow-soft overflow-hidden">
            <div className="px-5 py-3 border-b border-border dark:bg-card/30 flex items-center justify-between">
              <h2 className="text-sm font-bold text-foreground/90">Utalási tételek</h2>
              <span className="text-xs text-emerald-600 font-bold">{readyCount}/{transferList.length} kész</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-5 py-2 text-xs font-bold text-muted-foreground">Kedvezményezett</th>
                  <th className="text-left px-3 py-2 text-xs font-bold text-muted-foreground">Bankszámla</th>
                  <th className="text-right px-3 py-2 text-xs font-bold text-muted-foreground">Nettó összeg</th>
                  <th className="text-center px-3 py-2 text-xs font-bold text-muted-foreground">Státusz</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTransfers.map(t => (
                  <tr key={t.id} className={cn('border-b border-border/50 hover:bg-muted/50 cursor-pointer', t.status === 'pending' && 'bg-yellow-50/30')} onClick={handlePreview}>
                    <td className="px-5 py-2.5 font-medium">{t.employeeName}</td>
                    <td className="px-3 py-2.5 font-mono text-xs">{t.bankAccount || '—'}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-600">{fmt(t.netSalary)}</td>
                    <td className="px-3 py-2.5 text-center">
                      {t.status === 'approved' && <CheckCircle className="w-4 h-4 text-emerald-500 mx-auto" />}
                      {t.status === 'pending' && <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-bold"> Ellenőrizni</span>}
                      {t.status === 'sent' && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">Utalva</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted font-bold">
                  <td colSpan={2} className="px-5 py-2 text-xs">Összesen ({readyCount} tétel)</td>
                  <td className="px-3 py-2 text-right font-mono text-emerald-600">{fmt(totalAmount)} Ft</td>
                  <td />
                </tr>
              </tfoot>
            </table>
            {totalPages > 1 && (
              <div className="border-t border-border px-5 py-3 bg-card">
                <UnifiedPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalItems}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={setPageSize}
                  pageSizeOptions={[25, 50, 100]}
                />
              </div>
            )}
          </div>
        </>
      )}

      <Dialog open={!!previewUrl} onOpenChange={(open) => !open && setPreviewUrl(null)}>
        <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b border-border">
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-500" />
              Utalási lista — {selectedPeriod}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 w-full bg-muted dark:bg-card">
            {previewUrl && (
              <iframe src={previewUrl} className="w-full h-full border-0" title="Utalási lista megtekintő" />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── SEPA XML Generator ──────────────────────────────────────────────
function downloadSepaXml(transfers: Transfer[], companyName: string, period: string) {
  const msgId = `MSG-${period}-${Date.now()}`;
  const date = new Date().toISOString().slice(0, 10);
  const totalAmount = transfers.filter(t => t.status === 'approved').reduce((s, t) => s + t.netSalary, 0);
  const approvedTransfers = transfers.filter(t => t.status === 'approved');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.09">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>${msgId}</MsgId>
      <CreDtTm>${new Date().toISOString()}</CreDtTm>
      <NbOfTxs>${approvedTransfers.length}</NbOfTxs>
      <CtrlSum>${totalAmount.toFixed(2)}</CtrlSum>
      <InitgPty>
        <Nm>${escapeXml(companyName)}</Nm>
      </InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>PMT-${period}</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <NbOfTxs>${approvedTransfers.length}</NbOfTxs>
      <CtrlSum>${totalAmount.toFixed(2)}</CtrlSum>
      <ReqdExctnDt>
        <Dt>${date}</Dt>
      </ReqdExctnDt>
      <Dbtr>
        <Nm>${escapeXml(companyName)}</Nm>
      </Dbtr>
      <DbtrAcct>
        <Id><IBAN>HU00000000000000000000000000</IBAN></Id>
      </DbtrAcct>
      <DbtrAgt>
        <FinInstnId><BIC>OTPVHUHB</BIC></FinInstnId>
      </DbtrAgt>
${approvedTransfers.map((t, i) => `      <CdtTrfTxInf>
        <PmtId><EndToEndId>E2E-${period}-${String(i + 1).padStart(4, '0')}</EndToEndId></PmtId>
        <Amt><InstdAmt Ccy="HUF">${t.netSalary.toFixed(2)}</InstdAmt></Amt>
        <CdtrAgt>
          <FinInstnId><BIC>OTPVHUHB</BIC></FinInstnId>
        </CdtrAgt>
        <Cdtr>
          <Nm>${escapeXml(t.employeeName)}</Nm>
        </Cdtr>
        <CdtrAcct>
          <Id><IBAN>${t.bankAccount || 'HU00000000000000000000000000'}</IBAN></Id>
        </CdtrAcct>
        <RmtInf><Ustrd>Berfizetés ${period}</Ustrd></RmtInf>
      </CdtTrfTxInf>`).join('\n')}
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`;

  downloadFile(`sepa_${period}.xml`, xml, 'application/xml');
}

// ─── MT940 Generator ─────────────────────────────────────────────────
function downloadMt940(transfers: Transfer[], companyName: string, period: string) {
  const date = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const totalDebit = transfers.filter(t => t.status === 'approved').reduce((s, t) => s + t.netSalary, 0);
  const approvedTransfers = transfers.filter(t => t.status === 'approved');

  const lines = [
    `{1:F01OTPVHUHBAXXX0000000000}`,
    `{2:O940${date}0000OTPVHUHBAXXX00000000000000000000N}`,
    `{4:`,
    `:20:STMT${period.replace('-', '')}`,
    `:25:HU00000000000000000000000000`,
    `:28C:1/1`,
    `:60F:C${date}HUF${totalDebit.toFixed(2).replace('.', ',')}`,
    ...approvedTransfers.map((t, i) => [
      `:61:${date}D${t.netSalary.toFixed(2).replace('.', ',')}NTRF${String(i + 1).padStart(4, '0')}`,
      `:86:Berfizetés / ${t.employeeName} / ${t.bankAccount || '-'}`,
    ]).flat(),
    `:62F:C${date}HUF0,00`,
    `-}`,
  ];

  downloadFile(`mt940_${period}.sta`, lines.join('\r\n'), 'text/plain');
}

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
