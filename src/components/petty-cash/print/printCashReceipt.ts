import { format } from 'date-fns';
import type { CashReceipt } from '../types';
import { fmtBalance } from '../types';

interface PrintCashReceiptParams {
  receipt: CashReceipt;
  companyName: string;
  companyTaxNumber?: string;
  companyAddress?: string;
  registerName: string;
}

export function printCashReceipt({
  receipt,
  companyName,
  companyTaxNumber,
  companyAddress,
  registerName,
}: PrintCashReceiptParams) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('A felugró ablakok tiltva vannak a böngészőben. Engedélyezd a bizonylat megtekintéséhez!');
    return;
  }

  const isIncome = receipt.receipt_type === 'in';
  const typeTitle = isIncome ? 'BEVÉTELI PÉNZTÁRBIZONYLAT (BPB)' : 'KIADÁSI PÉNZTÁRBIZONYLAT (KPB)';
  const partnerLabel = isIncome ? 'Befizető (Partner):' : 'Kedvezményezett / Átvevő:';
  const cur = receipt.currency || 'HUF';

  const html = `<!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="utf-8">
  <title>${receipt.receipt_number} - ${typeTitle}</title>
  <style>
    @page { size: A5 landscape; margin: 10mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; font-size: 11px; color: #0f172a; margin: 0; padding: 15px; }
    .container { border: 2px solid #0f172a; padding: 14px; border-radius: 4px; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px; }
    h1 { font-size: 15px; margin: 0; text-transform: uppercase; font-weight: 800; }
    .number { font-size: 16px; font-family: monospace; font-weight: 800; color: #0f172a; }
    .company { font-size: 11px; line-height: 1.4; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
    .box { border: 1px solid #cbd5e1; border-radius: 4px; padding: 8px 10px; background: #f8fafc; }
    .label { font-size: 9px; color: #64748b; text-transform: uppercase; font-weight: bold; margin-bottom: 2px; }
    .val { font-size: 12px; font-weight: bold; color: #0f172a; }
    .amount-box { border: 2px solid #0f172a; background: #ffffff; padding: 8px 12px; border-radius: 4px; margin-bottom: 12px; }
    .amount-val { font-size: 18px; font-family: monospace; font-weight: 800; color: #0f172a; }
    .in-words { font-style: italic; color: #334155; font-size: 11px; margin-top: 4px; border-top: 1px dashed #cbd5e1; padding-top: 4px; }
    .signatures { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 25px; }
    .sig-line { text-align: center; border-top: 1px solid #0f172a; padding-top: 4px; font-size: 9px; color: #475569; }
    .footer-bar { margin-top: 12px; font-size: 8px; color: #94a3b8; display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <div class="container">
    <!-- Fejléc -->
    <div class="header">
      <div class="company">
        <div style="font-size: 13px; font-weight: bold;">${companyName}</div>
        ${companyAddress ? `<div>${companyAddress}</div>` : ''}
        ${companyTaxNumber ? `<div>Adószám: ${companyTaxNumber}</div>` : ''}
        <div>Pénztár: <strong>${registerName}</strong></div>
      </div>
      <div style="text-align: right;">
        <h1>${typeTitle}</h1>
        <div class="number">${receipt.receipt_number}</div>
        <div style="font-size: 10px; color: #64748b;">Kelt: ${receipt.issued_at}</div>
      </div>
    </div>

    <!-- Partner és Jogcím adatok -->
    <div class="grid">
      <div class="box">
        <div class="label">${partnerLabel}</div>
        <div class="val">${receipt.payer_or_payee_name || '—'}</div>
        ${receipt.payer_or_payee_address ? `<div style="font-size: 10px; color: #64748b;">${receipt.payer_or_payee_address}</div>` : ''}
      </div>

      <div class="box">
        <div class="label">Jogcím / Hivatkozás:</div>
        <div class="val">${receipt.legal_title || 'Általános készpénzmozgás'}</div>
        ${receipt.description ? `<div style="font-size: 10px; color: #475569; margin-top: 2px;">${receipt.description}</div>` : ''}
      </div>
    </div>

    <!-- Összeg és betűvel kiírt összeg (Sztv. 167. §) -->
    <div class="amount-box">
      <div class="label">Összeg:</div>
      <div class="amount-val">${fmtBalance(receipt.amount, cur)}</div>
      <div class="in-words">
        Azaz: <strong>${receipt.amount_in_words || '—'}</strong>
      </div>
    </div>

    <!-- 4-es Aláírás blokk -->
    <div class="signatures">
      <div class="sig-line">Kiállította</div>
      <div class="sig-line">Pénztáros</div>
      <div class="sig-line">Utalványozó</div>
      <div class="sig-line">${isIncome ? 'Befizető átadta' : 'Átvevő átvette'}</div>
    </div>

    <!-- Lábléc -->
    <div class="footer-bar">
      <div>Szigorú számadású pénztárbizonylat • eaisybill Házipénztár Modul</div>
      <div>Nyomtatva: ${format(new Date(), 'yyyy.MM.dd. HH:mm')}</div>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 250);
    };
  </script>
</body>
</html>`;

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
}
