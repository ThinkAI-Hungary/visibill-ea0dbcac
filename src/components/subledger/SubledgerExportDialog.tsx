import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { FileSpreadsheet, Printer, Download, Clock, Layers } from 'lucide-react';
import type { SubledgerItem } from '@/types/subledger';
import { formatCurrency } from '@/lib/utils';

interface SubledgerExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  items: SubledgerItem[];
  companyName?: string;
  partnerName?: string;
  accountNumber?: string;
}

export const SubledgerExportDialog: React.FC<SubledgerExportDialogProps> = ({
  isOpen,
  onClose,
  items,
  companyName = 'Vállalkozás',
  partnerName,
  accountNumber,
}) => {
  const [exportType, setExportType] = useState<'STATEMENT' | 'OPEN_ITEMS' | 'AGING'>('STATEMENT');

  const calculateAging = () => {
    const today = new Date();
    const buckets = {
      notDue: { count: 0, amount: 0 },
      d1_30: { count: 0, amount: 0 },
      d31_60: { count: 0, amount: 0 },
      d61_90: { count: 0, amount: 0 },
      d90plus: { count: 0, amount: 0 },
    };

    const openItems = items.filter((i) => !i.is_settled && i.remaining_amount > 0);

    openItems.forEach((i) => {
      const due = i.due_date ? new Date(i.due_date) : new Date(i.document_date);
      const diffTime = today.getTime() - due.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const rem = i.remaining_amount;

      if (diffDays <= 0) {
        buckets.notDue.count++;
        buckets.notDue.amount += rem;
      } else if (diffDays <= 30) {
        buckets.d1_30.count++;
        buckets.d1_30.amount += rem;
      } else if (diffDays <= 60) {
        buckets.d31_60.count++;
        buckets.d31_60.amount += rem;
      } else if (diffDays <= 90) {
        buckets.d61_90.count++;
        buckets.d61_90.amount += rem;
      } else {
        buckets.d90plus.count++;
        buckets.d90plus.amount += rem;
      }
    });

    return buckets;
  };

  const downloadCSV = () => {
    let csvContent = '\uFEFF'; // UTF-8 BOM for Excel Hungarian accents

    if (exportType === 'AGING') {
      csvContent += 'Korosítási kategória;Tételek száma;Fennmaradó nyitott összeg (HUF)\n';
      const aging = calculateAging();
      csvContent += `Még nem járt le;${aging.notDue.count};${aging.notDue.amount.toFixed(2)}\n`;
      csvContent += `1 - 30 napja lejárt;${aging.d1_30.count};${aging.d1_30.amount.toFixed(2)}\n`;
      csvContent += `31 - 60 napja lejárt;${aging.d31_60.count};${aging.d31_60.amount.toFixed(2)}\n`;
      csvContent += `61 - 90 napja lejárt;${aging.d61_90.count};${aging.d61_90.amount.toFixed(2)}\n`;
      csvContent += `90 napon túl lejárt;${aging.d90plus.count};${aging.d90plus.amount.toFixed(2)}\n`;
    } else {
      const exportList = exportType === 'OPEN_ITEMS'
        ? items.filter((i) => !i.is_settled && i.remaining_amount > 0)
        : items;

      csvContent += 'Bizonylatszám;Napló;Könyvelés dátuma;Esedékesség;Partner;Főkönyvi szám;T/K;Eredeti összeg;Pénznem;Rendezett;Nyitott egyenleg;Státusz\n';
      exportList.forEach((i) => {
        csvContent += `"${i.document_id}";"${i.journal_code}-${i.journal_number}";"${i.posting_date}";"${i.due_date || ''}";"${i.partner_name}";"${i.gl_number}";"${i.dc_type}";${i.amount};"${i.currency}";${i.settled_amount};${i.remaining_amount};"${i.is_settled ? 'ZÁRT' : i.settled_amount > 0 ? 'RÉSZBEN RENDEZETT' : 'NYITOTT'}"\n`;
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const filename = `folyoszamla_${exportType.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onClose();
  };

  const handlePrint = () => {
    const aging = calculateAging();
    const exportList = exportType === 'OPEN_ITEMS'
      ? items.filter((i) => !i.is_settled && i.remaining_amount > 0)
      : items;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Folyószámla Kimutatás - ${companyName}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 24px; color: #111; }
            h1 { font-size: 20px; margin-bottom: 4px; }
            .meta { color: #666; font-size: 13px; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px; }
            th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
            th { background-color: #f4f4f4; font-weight: 600; }
            .num { text-align: right; }
            .summary { margin-top: 20px; font-size: 14px; font-weight: bold; }
            @media print {
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <h1>${exportType === 'AGING' ? 'Korosított Nyitott Tételek Kimutatása' : exportType === 'OPEN_ITEMS' ? 'Nyitott Tételek Listája' : 'Partner Folyószámla Kivonat'}</h1>
          <div class="meta">
            Cég: <strong>${companyName}</strong> | 
            ${partnerName ? `Partner: <strong>${partnerName}</strong> | ` : ''}
            ${accountNumber ? `Főkönyv: <strong>${accountNumber}</strong> | ` : ''}
            Dátum: ${new Date().toLocaleDateString('hu-HU')}
          </div>

          ${
            exportType === 'AGING'
              ? `
            <table>
              <thead>
                <tr>
                  <th>Korosítási kategória</th>
                  <th class="num">Tételek száma</th>
                  <th class="num">Fennmaradó nyitott összeg</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Még nem járt le</td><td class="num">${aging.notDue.count}</td><td class="num">${formatCurrency(aging.notDue.amount)} Ft</td></tr>
                <tr><td>1 - 30 napja lejárt</td><td class="num">${aging.d1_30.count}</td><td class="num">${formatCurrency(aging.d1_30.amount)} Ft</td></tr>
                <tr><td>31 - 60 napja lejárt</td><td class="num">${aging.d31_60.count}</td><td class="num">${formatCurrency(aging.d31_60.amount)} Ft</td></tr>
                <tr><td>61 - 90 napja lejárt</td><td class="num">${aging.d61_90.count}</td><td class="num">${formatCurrency(aging.d61_90.amount)} Ft</td></tr>
                <tr><td>90 napon túl lejárt</td><td class="num">${aging.d90plus.count}</td><td class="num">${formatCurrency(aging.d90plus.amount)} Ft</td></tr>
              </tbody>
            </table>
          `
              : `
            <table>
              <thead>
                <tr>
                  <th>Bizonylatszám</th>
                  <th>Napló</th>
                  <th>Könyvelés</th>
                  <th>Esedékesség</th>
                  <th>Partner</th>
                  <th>Főkönyv</th>
                  <th>T/K</th>
                  <th class="num">Eredeti összeg</th>
                  <th class="num">Rendezett</th>
                  <th class="num">Nyitott</th>
                </tr>
              </thead>
              <tbody>
                ${exportList
                  .map(
                    (i) => `
                  <tr>
                    <td>${i.document_id}</td>
                    <td>${i.journal_code}-${i.journal_number}</td>
                    <td>${i.posting_date}</td>
                    <td>${i.due_date || '-'}</td>
                    <td>${i.partner_name || '-'}</td>
                    <td>${i.gl_number}</td>
                    <td>${i.dc_type}</td>
                    <td class="num">${formatCurrency(i.amount)} ${i.currency}</td>
                    <td class="num">${formatCurrency(i.settled_amount)}</td>
                    <td class="num" style="font-weight: bold;">${formatCurrency(i.remaining_amount)}</td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>
          `
          }

          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
            <span>Folyószámla Kimutatás Export</span>
          </DialogTitle>
          <DialogDescription>
            Válassza ki a generálni kívánt analitikus kimutatás típusát és formátumát.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <RadioGroup
            value={exportType}
            onValueChange={(v) => setExportType(v as any)}
            className="space-y-2.5"
          >
            <div
              className={`flex items-start space-x-2 border rounded-lg p-3 cursor-pointer ${
                exportType === 'STATEMENT' ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/20' : ''
              }`}
              onClick={() => setExportType('STATEMENT')}
            >
              <RadioGroupItem value="STATEMENT" id="exp-statement" className="mt-0.5" />
              <div className="space-y-0.5">
                <Label htmlFor="exp-statement" className="font-medium cursor-pointer flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  Teljes Folyószámla Kivonat
                </Label>
                <p className="text-xs text-muted-foreground">
                  Minden nyitott és zárt tétel részletes listája T és K forgalommal.
                </p>
              </div>
            </div>

            <div
              className={`flex items-start space-x-2 border rounded-lg p-3 cursor-pointer ${
                exportType === 'OPEN_ITEMS' ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/20' : ''
              }`}
              onClick={() => setExportType('OPEN_ITEMS')}
            >
              <RadioGroupItem value="OPEN_ITEMS" id="exp-open" className="mt-0.5" />
              <div className="space-y-0.5">
                <Label htmlFor="exp-open" className="font-medium cursor-pointer flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-amber-600" />
                  Nyitott Tételek Listája
                </Label>
                <p className="text-xs text-muted-foreground">
                  Kizárólag a még kiegyenlítetlen, fennmaradó tartozások és követelések.
                </p>
              </div>
            </div>

            <div
              className={`flex items-start space-x-2 border rounded-lg p-3 cursor-pointer ${
                exportType === 'AGING' ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/20' : ''
              }`}
              onClick={() => setExportType('AGING')}
            >
              <RadioGroupItem value="AGING" id="exp-aging" className="mt-0.5" />
              <div className="space-y-0.5">
                <Label htmlFor="exp-aging" className="font-medium cursor-pointer flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-purple-600" />
                  Korosított Nyitott Tételek (Aging)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Esedékesség szerinti csoportosítás: nem járt le, 1-30, 31-60, 61-90, 90+ napja lejárt.
                </p>
              </div>
            </div>
          </RadioGroup>
        </div>

        <DialogFooter className="flex gap-2 sm:justify-between pt-2">
          <Button variant="outline" onClick={handlePrint} className="flex items-center gap-1.5">
            <Printer className="w-4 h-4" />
            Nyomtatás / PDF
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Mégse
            </Button>
            <Button onClick={downloadCSV} className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5">
              <Download className="w-4 h-4" />
              Excel / CSV Letöltés
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
