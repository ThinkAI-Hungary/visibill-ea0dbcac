import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  ArrowLeft, CreditCard, Download, CheckCircle,
  Eye, Loader2, Database
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExportButton } from '@/components/accounty/ExportButton';
import { cn } from '@/lib/utils';
import { useTransfers, type Transfer } from '@/hooks/accounty';
import { useAccountyClients } from '@/hooks/accounty';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { generateTransferPdf } from '@/lib/documentPdfs';
import { usePayrollCycles, usePayrollCalculations } from '@/hooks/usePayrollData';
import { UnifiedPagination } from '@/components/ui/unified-pagination';

export default function TransferListPage() {
  const { id } = useParams<{ id: string }>();
  const currentPeriod = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const { data: transfers, isLoading } = useTransfers(id || '', currentPeriod);
  const { data: clients } = useAccountyClients();
  const { data: cycles = [] } = usePayrollCycles(id || '');
  const company = clients?.find(c => c.id === id);

  const currentCycle = cycles.find(c => c.year === new Date().getFullYear() && c.month === new Date().getMonth() + 1) || cycles[0];
  const { data: calculations = [] } = usePayrollCalculations(currentCycle?.id || '');

  const [exportFormat, setExportFormat] = useState<'sepa' | 'mt940'>('sepa');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const transferList = transfers || [];
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
      downloadSepaXml(transferList, company?.name || '', currentPeriod);
    } else {
      downloadMt940(transferList, company?.name || '', currentPeriod);
    }
  };

  const handlePreview = () => {
    if (calculations.length === 0) return;
    const url = generateTransferPdf({
      companyName: company?.name || '–',
      period: currentCycle ? `${currentCycle.year}/${String(currentCycle.month).padStart(2, '0')}` : currentPeriod,
      calculations: calculations as any[],
    });
    setPreviewUrl(url);
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => window.history.back()} className="p-2 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="w-5 h-5" /></button>
          <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg shadow-emerald-500/25"><CreditCard className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-2xl font-bold">Utalási lista</h1>
            <p className="text-sm text-slate-500">{currentPeriod} — Bér utalási állomány</p>
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
            filename={`utalasi_lista_${currentPeriod}`}
            headers={['Kedvezményezett', 'Bankszámla', 'Nettó (Ft)', 'Státusz']}
            getRows={() => transferList.map(t => [t.employeeName, t.bankAccount || '', t.netSalary, t.status])}
            size="sm"
            pdfOptions={{ title: `Utalási lista — ${currentPeriod}` }}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32 gap-2 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /> Betöltés...</div>
      ) : transferList.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center space-y-3">
          <Database className="w-10 h-10 mx-auto text-slate-400" />
          <p className="text-sm text-slate-500">Nincsenek utalási tételek erre az időszakra ({currentPeriod}).</p>
          <p className="text-xs text-slate-400">Az utalási lista a bérszámfejtés véglegesítése után generálódik.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-card rounded-xl border border-border p-4 text-center"><p className="text-2xl font-bold text-blue-600">{transferList.length}</p><p className="text-xs text-slate-500">Összes tétel</p></div>
            <div className="bg-card rounded-xl border border-border p-4 text-center"><p className="text-2xl font-bold text-emerald-600">{readyCount}</p><p className="text-xs text-slate-500">Utalásra kész</p></div>
            <div className="bg-card rounded-xl border border-border p-4 text-center"><p className="text-lg font-bold font-mono text-emerald-600">{fmt(totalAmount)} Ft</p><p className="text-xs text-slate-500">Összes nettó</p></div>
          </div>

          <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
            <div className="px-5 py-3 border-b border-border dark:bg-slate-900/30 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Utalási tételek</h2>
              <span className="text-xs text-emerald-600 font-bold">{readyCount}/{transferList.length} kész</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-5 py-2 text-xs font-bold text-slate-500">Kedvezményezett</th>
                  <th className="text-left px-3 py-2 text-xs font-bold text-slate-500">Bankszámla</th>
                  <th className="text-right px-3 py-2 text-xs font-bold text-slate-500">Nettó összeg</th>
                  <th className="text-center px-3 py-2 text-xs font-bold text-slate-500">Státusz</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTransfers.map(t => (
                  <tr key={t.id} className={cn('border-b border-border/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer', t.status === 'pending' && 'bg-yellow-50/30')} onClick={handlePreview}>
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
                <tr className="bg-slate-100 dark:bg-slate-800 font-bold">
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
              Utalási lista — {currentPeriod}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 w-full bg-slate-200 dark:bg-slate-900">
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
