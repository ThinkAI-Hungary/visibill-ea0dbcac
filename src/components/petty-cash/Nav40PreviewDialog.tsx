import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ShieldAlert,
  AlertOctagon,
  Copy,
  Printer,
  Download,
  Building2,
  Calendar,
  CheckCircle2,
  FileSpreadsheet,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { fmtBalance } from './types';
import { cn } from '@/lib/utils';

interface PartnerLimitItem {
  partner_id: string;
  partner_name: string;
  tax_number: string | null;
  total_amount_huf: number;
  monthly_threshold_huf: number;
  excess_amount_huf: number;
  penalty_risk_huf: number;
  status: 'safe' | 'warning' | 'violating';
}

interface Nav40PreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  year: number;
  month: number;
  companyName: string;
  companyTaxNumber?: string;
  partners: PartnerLimitItem[];
}

function getFormattedNow(): string {
  return new Date().toLocaleString('hu-HU');
}

export function Nav40PreviewDialog({
  open,
  onOpenChange,
  year,
  month,
  companyName,
  companyTaxNumber,
  partners,
}: Nav40PreviewDialogProps) {
  const { t } = useTranslation(['pettyCash', 'common']);

  const monthNames = [
    'Január', 'Február', 'Március', 'Április', 'Május', 'Június',
    'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December',
  ];
  const monthLabel = monthNames[month - 1] || `${month}. hónap`;

  // Filter violating and warning partners
  const relevantPartners = partners.filter(p => p.status === 'violating' || p.status === 'warning' || (p as any).status === 'exceeded' || (p as any).is_exceeded);
  const violatingPartners = partners.filter(p => p.status === 'violating' || (p as any).status === 'exceeded' || (p as any).is_exceeded);

  const totalViolatingAmount = violatingPartners.reduce((acc, p) => acc + p.total_amount_huf, 0);
  const totalExcessAmount = violatingPartners.reduce((acc, p) => acc + p.excess_amount_huf, 0);
  const totalPenaltyRisk = violatingPartners.reduce((acc, p) => acc + p.penalty_risk_huf, 0);

  // Copy ONYA formatted structured text to clipboard
  const handleCopyOnyaText = () => {
    if (violatingPartners.length === 0) {
      toast({
        title: 'Nincs határértéket túllépő partner',
        description: 'Ebben a hónapban egyetlen partner sem haladta meg a törvényi 1,5M Ft-os limitet.',
      });
      return;
    }

    const lines = [
      `NAV 40 ADATLAP ELŐKÉSZÍTÉS — KÉSZPÉNZFIZETÉSI BEJELENTÉS (Art. 114. §)`,
      `Bejelentő vállalkozás: ${companyName} (Adószám: ${companyTaxNumber || 'N/A'})`,
      `Tárgyidőszak: ${year}. ${monthLabel}`,
      `Generálás időpontja: ${getFormattedNow()}`,
      `--------------------------------------------------------------------------------`,
      ...violatingPartners.map((p, idx) => 
        `[${idx + 1}] Partner: ${p.partner_name || 'Ismeretlen'} | Adószám: ${p.tax_number || 'N/A'} | Havi forgalom: ${fmtBalance(p.total_amount_huf, 'HUF')} | Túllépés: ${fmtBalance(p.excess_amount_huf, 'HUF')} | 20% Bírságkockázat: ${fmtBalance(p.penalty_risk_huf, 'HUF')}`
      ),
      `--------------------------------------------------------------------------------`,
      `Összesített 20%-os bírságkockázat: ${fmtBalance(totalPenaltyRisk, 'HUF')}`,
      `Bejelentési kötelezettség: a kifizetést követő 15 napon belül a NAV felé (40-es számú nyomtatvány).`
    ];

    navigator.clipboard.writeText(lines.join('\n'));
    toast({
      title: 'NAV 40 adatok másolva a vágólapra!',
      description: 'A struktúrált adatok beilleszthetők az ONYA / ÁNYK felületre vagy könyvelői jegyzőkönyvbe.',
    });
  };

  // Printable official voucher
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('A felugró ablakok tiltva vannak a böngészőben!');
      return;
    }

    const rowsHtml = violatingPartners.map((p, idx) => `
      <tr>
        <td style="text-align: center; font-family: monospace;">${idx + 1}</td>
        <td style="font-weight: bold;">${p.partner_name || 'Ismeretlen'}</td>
        <td style="text-align: center; font-family: monospace;">${p.tax_number || '—'}</td>
        <td style="text-align: right; font-family: monospace;">${fmtBalance(p.total_amount_huf, 'HUF')}</td>
        <td style="text-align: right; font-family: monospace;">1 500 000 Ft</td>
        <td style="text-align: right; font-family: monospace; font-weight: bold; color: #dc2626;">${fmtBalance(p.excess_amount_huf, 'HUF')}</td>
        <td style="text-align: right; font-family: monospace; font-weight: bold; color: #b91c1c;">${fmtBalance(p.penalty_risk_huf, 'HUF')}</td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>NAV 40 Bejelentés Adatlap — ${year}. ${monthLabel}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; padding: 24px; color: #1e293b; }
          .header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
          .title { font-size: 18px; font-weight: bold; margin: 0; }
          .subtitle { font-size: 12px; color: #64748b; margin-top: 4px; }
          .alert-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 10px; font-size: 11px; margin-bottom: 16px; color: #991b1b; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 10px; }
          th { background: #f1f5f9; font-weight: 600; text-align: left; }
          .summary-card { margin-top: 20px; padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 12px; }
          .signatures { margin-top: 40px; display: flex; justify-content: space-between; font-size: 11px; }
          .sig-box { width: 45%; border-top: 1px dashed #64748b; padding-top: 6px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">BEJELENTŐ ADATLAP KÉSZPÉNZFIZETÉSRŐL (NAV 40)</div>
          <div class="subtitle">Adózás rendjéről szóló 2017. évi CL. törvény (Art.) 114. § (3) bek. alapján</div>
          <div style="margin-top: 8px; font-size: 12px;">
            <strong>Bejelentő adózó:</strong> ${companyName} | <strong>Adószám:</strong> ${companyTaxNumber || 'N/A'} | <strong>Időszak:</strong> ${year}. ${monthLabel}
          </div>
        </div>

        <div class="alert-box">
          <strong>Jogszabályi figyelmeztetés (Art. 114. § és 228. §):</strong><br>
          A készpénzfizetés 1,5 millió forintot meghaladó részére 20%-os mértékű mulasztási bírságot szab ki az adóhatóság mind a kifizetőre, mind a kifizetést elfogadóra, amennyiben a bejelentés nem történik meg a kifizetést követő 15 napon belül.
        </div>

        <table>
          <thead>
            <tr>
              <th style="text-align: center; width: 40px;">#</th>
              <th>Partner Vállalkozás Neve</th>
              <th style="text-align: center;">Partner Adószáma</th>
              <th style="text-align: right;">Havi Kp. Összeg</th>
              <th style="text-align: right;">Havi Limit</th>
              <th style="text-align: right;">Túllépés</th>
              <th style="text-align: right;">20% Bírságkockázat</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="7" style="text-align: center; padding: 16px;">Nincs határértéket meghaladó ügylet az adott hónapban.</td></tr>'}
          </tbody>
        </table>

        <div class="summary-card">
          <strong>Összesített adatok a tárgyidőszakra:</strong><br>
          Érintett partnerek száma: <strong>${violatingPartners.length} db</strong><br>
          Határérték feletti kifizetések összege: <strong>${fmtBalance(totalExcessAmount, 'HUF')}</strong><br>
          Kiszabható 20%-os mulasztási bírság kockázat: <strong style="color: #b91c1c;">${fmtBalance(totalPenaltyRisk, 'HUF')}</strong>
        </div>

        <div class="signatures">
          <div class="sig-box">
            Pénztáros / Készítő aláírása
          </div>
          <div class="sig-box">
            Könyvelő / Adószakértő ellenjegyzése
          </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[94vw] max-w-4xl max-h-[92vh] flex flex-col p-4 sm:p-6 gap-4">
        {/* Header */}
        <DialogHeader className="pb-2 border-b border-border/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-destructive" />
                <span>NAV 40 Készpénzfizetési Bejelentő Adatlap</span>
                <Badge variant="outline" className="text-xs bg-muted ml-1">
                  Art. 114. § (3)
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Vállalkozások közötti havi 1,5M Ft feletti készpénzfizetések NAV bejelentésének előkészítése.
              </DialogDescription>
            </div>

            <Badge variant="secondary" className="font-mono text-xs w-fit">
              {year}. {monthLabel}
            </Badge>
          </div>
        </DialogHeader>

        {/* Company & Risk Summary Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-muted/40 rounded-xl border border-border/70 text-xs">
          <div>
            <span className="text-muted-foreground block text-[11px]">Bejelentő Vállalkozás:</span>
            <span className="font-semibold text-foreground text-xs">{companyName}</span>
            <span className="text-muted-foreground block font-mono text-[10px] mt-0.5">
              Adószám: {companyTaxNumber || 'N/A'}
            </span>
          </div>

          <div>
            <span className="text-muted-foreground block text-[11px]">Érintett partnerek száma:</span>
            <span className="font-semibold text-foreground text-sm flex items-center gap-1.5 mt-0.5">
              {violatingPartners.length > 0 ? (
                <>
                  <AlertOctagon className="w-4 h-4 text-destructive" />
                  <span className="text-destructive font-bold">{violatingPartners.length} partner</span> (Limit felett)
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span className="text-emerald-600 font-bold">0 partner</span> (Mindenki limit alatt)
                </>
              )}
            </span>
          </div>

          <div>
            <span className="text-muted-foreground block text-[11px]">20% Kockáztatott Bírságösszeg:</span>
            <span className="font-mono font-bold text-sm text-destructive block mt-0.5">
              {fmtBalance(totalPenaltyRisk, 'HUF')}
            </span>
          </div>
        </div>

        {/* Law Citation Box */}
        <div className="p-3 bg-destructive/5 rounded-xl border border-destructive/20 text-xs text-muted-foreground space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-destructive">
            <AlertOctagon className="w-3.5 h-3.5" />
            <span>Törvényi Bejelentési Szabály (Art. 114. §):</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            Készpénzfizetés esetén a 1,5 millió forintos értékhatárt meghaladó kifizetést a kifizetés napjától számított <strong>15 napon belül</strong> köteles bejelenteni a vevő (kifizető) és az eladó (elfogadó) az állami adóhatósághoz a 40-es számú bejelentő lapon. Ennek elmulasztása esetén a törvény <strong>20%-os mulasztási bírságot</strong> ír elő a határértéket meghaladó összegrészre.
          </p>
        </div>

        {/* Partners Table */}
        <div className="border border-border/80 rounded-xl overflow-hidden flex-1 flex flex-col min-h-0">
          <div className="overflow-y-auto max-h-64">
            <Table>
              <TableHeader className="bg-muted/60 sticky top-0">
                <TableRow className="text-xs">
                  <TableHead className="w-10 text-center font-mono">#</TableHead>
                  <TableHead>Partner Vállalkozás</TableHead>
                  <TableHead className="font-mono text-center">Adószám</TableHead>
                  <TableHead className="text-right font-mono">Havi Kp. Összeg</TableHead>
                  <TableHead className="text-right font-mono text-destructive">Túllépés</TableHead>
                  <TableHead className="text-right font-mono font-bold text-destructive">20% Bírság</TableHead>
                  <TableHead className="text-center">Státusz</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {relevantPartners.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-xs text-muted-foreground">
                      <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1.5" />
                      A kiválasztott hónapban egyetlen partner sem haladta meg a 1,5M Ft-os készpénzlimitet.
                    </TableCell>
                  </TableRow>
                ) : (
                  relevantPartners.map((p, idx) => (
                    <TableRow key={p.partner_id || idx} className="text-xs">
                      <TableCell className="text-center font-mono font-medium">{idx + 1}</TableCell>
                      <TableCell>
                        <div className="font-semibold text-foreground">{p.partner_name || 'Ismeretlen'}</div>
                      </TableCell>
                      <TableCell className="text-center font-mono">{p.tax_number || '—'}</TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {fmtBalance(p.total_amount_huf, 'HUF')}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-destructive">
                        {p.excess_amount_huf > 0 ? `+${fmtBalance(p.excess_amount_huf, 'HUF')}` : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-destructive">
                        {p.penalty_risk_huf > 0 ? fmtBalance(p.penalty_risk_huf, 'HUF') : '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        {p.status === 'violating' ? (
                          <Badge variant="destructive" className="text-[10px] uppercase font-bold">
                            Túllépés
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-600 bg-amber-500/10">
                            Közelít (80%+)
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="pt-2 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-2 w-full">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
            {t('common:close', 'Bezárás')}
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyOnyaText}
              className="text-xs"
              disabled={violatingPartners.length === 0}
            >
              <Copy className="w-3.5 h-3.5 mr-1.5" />
              Másolás vágólapra (ONYA / ÁNYK)
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={handlePrint}
              className="text-xs shadow-sm"
              disabled={violatingPartners.length === 0}
            >
              <Printer className="w-3.5 h-3.5 mr-1.5" />
              Hivatalos Nyomtatvány (PDF)
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
export default Nav40PreviewDialog;
