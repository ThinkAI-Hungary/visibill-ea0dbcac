import { format } from 'date-fns';
import type { CashReceipt } from '../types';
import { fmtBalance } from '../types';
import { numberToWordsHu } from '@/lib/documents/templates/cashReceiptTemplate';

export interface PrintCashReceiptParams {
  receipt: Partial<CashReceipt> & {
    receipt_number: string;
    receipt_type: 'in' | 'out';
    issued_at: string;
    amount: number;
    currency?: string;
    payer_or_payee_name?: string;
    payer_or_payee_address?: string;
    legal_title?: string;
    description?: string;
    amount_in_words?: string;
    payer_signature?: string | null;
    recipient_signature?: string | null;
    source_doc_type?: string | null;
    source_doc_id?: string | null;
  };
  companyName: string;
  companyTaxNumber?: string;
  companyAddress?: string;
  registerName: string;
  authorizerName?: string;
  controllerName?: string;
  cashierName?: string;
}

export function printCashReceipt({
  receipt,
  companyName,
  companyTaxNumber,
  companyAddress,
  registerName,
  authorizerName,
  controllerName,
  cashierName,
}: PrintCashReceiptParams) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('A felugró ablakok tiltva vannak a böngészőben. Kérjük engedélyezze a bizonylat megtekintéséhez!');
    return;
  }

  const isIncome = receipt.receipt_type === 'in';
  const typeTitle = isIncome ? 'BEVÉTELI PÉNZTÁRBIZONYLAT' : 'KIADÁSI PÉNZTÁRBIZONYLAT';
  const shortCode = isIncome ? 'BPB' : 'KPB';
  const partnerLabel = isIncome ? 'Befizető (Átadó) Partner:' : 'Kedvezményezett / Átvevő:';
  const cur = receipt.currency || 'HUF';
  const numericAmount = Math.abs(receipt.amount);
  const inWords = receipt.amount_in_words || (cur === 'HUF' ? numberToWordsHu(numericAmount) : `${numericAmount} ${cur}`);

  const sourceDocLabel = receipt.source_doc_type ? (
    receipt.source_doc_type === 'invoice' ? 'Számla hivatkozás' :
    receipt.source_doc_type === 'payroll' ? 'Bérjegyzék' :
    receipt.source_doc_type === 'travel_order' ? 'Kiküldetési rendelvény' :
    receipt.source_doc_type === 'bank_withdrawal' ? 'Banki készpénzfelvételi bizonylat' :
    receipt.source_doc_type === 'owner_loan' ? 'Tagi kölcsön szerződés' : 'Forrásbizonylat'
  ) : null;

  const renderVoucherCopy = (copyNumber: number, copyLabel: string, copyTarget: string) => `
    <div class="voucher-copy">
      <!-- Fejléc sáv és példányjelzés -->
      <div class="copy-badge-bar">
        <span class="badge-copy">${copyNumber}. sz. példány – ${copyLabel} (${copyTarget})</span>
        <span class="legal-cite">Sztv. 165–167. § szerinti szigorú számadású bizonylat</span>
      </div>

      <div class="header">
        <div class="company-info">
          <div class="comp-name">${companyName}</div>
          ${companyAddress ? `<div class="comp-detail">${companyAddress}</div>` : ''}
          ${companyTaxNumber ? `<div class="comp-detail">Adószám: <strong>${companyTaxNumber}</strong></div>` : ''}
          <div class="comp-register">Pénztár: <strong>${registerName}</strong></div>
        </div>

        <div class="receipt-identity">
          <div class="main-title">${typeTitle}</div>
          <div class="doc-code">${shortCode}</div>
          <div class="receipt-number">${receipt.receipt_number}</div>
          <div class="receipt-date">Kiállítás dátuma: <strong>${receipt.issued_at}</strong></div>
        </div>
      </div>

      <!-- Partner és Jogcím adatok -->
      <div class="grid-2">
        <div class="box">
          <div class="box-label">${partnerLabel}</div>
          <div class="box-val">${receipt.payer_or_payee_name || '—'}</div>
          ${receipt.payer_or_payee_address ? `<div class="box-sub">${receipt.payer_or_payee_address}</div>` : ''}
        </div>

        <div class="box">
          <div class="box-label">Jogcím & Leírás:</div>
          <div class="box-val">${receipt.legal_title || receipt.description || 'Általános készpénzmozgás'}</div>
          ${sourceDocLabel && receipt.source_doc_id ? `
            <div class="box-source-doc">
              <span class="src-tag">${sourceDocLabel}:</span>
              <strong>${receipt.source_doc_id}</strong>
            </div>
          ` : ''}
        </div>
      </div>

      <!-- Összeg és betűvel kiírt összeg (Sztv. 167. §) -->
      <div class="amount-card">
        <div class="amount-row">
          <span class="amount-label">Fizetett összeg:</span>
          <span class="amount-number">${fmtBalance(numericAmount, cur)}</span>
        </div>
        <div class="amount-in-words">
          Azaz betűvel: <strong>${inWords}</strong>
        </div>
      </div>

      <!-- 4-es Aláírási és Bélyegző sáv -->
      <div class="signatures-wrapper">
        <div class="sig-block">
          <div class="sig-img-container">
            ${receipt.payer_signature ? `<img src="${receipt.payer_signature}" class="sig-img" alt="Kiállító" />` : ''}
          </div>
          <div class="sig-line"></div>
          <div class="sig-title">Kiállította</div>
          <div class="sig-person">${cashierName || 'Ügyintéző'}</div>
        </div>

        <div class="sig-block">
          <div class="sig-img-container"></div>
          <div class="sig-line"></div>
          <div class="sig-title">Pénztáros</div>
          <div class="sig-person">${cashierName || 'Pénztáros'}</div>
        </div>

        <div class="sig-block">
          <div class="sig-img-container"></div>
          <div class="sig-line"></div>
          <div class="sig-title">Utalványozó</div>
          <div class="sig-person">${authorizerName || controllerName || 'Cégvezető / Ellenőr'}</div>
        </div>

        <div class="sig-block">
          <div class="sig-img-container">
            ${receipt.recipient_signature ? `<img src="${receipt.recipient_signature}" class="sig-img" alt="Átvevő" />` : ''}
          </div>
          <div class="sig-line"></div>
          <div class="sig-title">${isIncome ? 'Befizető (Átadó)' : 'Átvevő személy'}</div>
          <div class="sig-person">${receipt.payer_or_payee_name || (isIncome ? 'Befizető' : 'Átvevő')}</div>
        </div>

        <div class="stamp-box">
          <div class="stamp-text">P.H. / B.H.</div>
          <div class="stamp-sub">Bélyegző helye</div>
        </div>
      </div>

      <!-- Lábléc metaadatok -->
      <div class="voucher-footer">
        <div>Generálva: ${format(new Date(), 'yyyy.MM.dd. HH:mm')} · Visibill / eaisyBooks Szigorú Számadású Motor</div>
        <div>Rendszerazonosító: ${receipt.receipt_number}</div>
      </div>
    </div>
  `;

  const html = `<!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="utf-8">
  <title>${receipt.receipt_number} - ${typeTitle}</title>
  <style>
    @page { 
      size: A4 portrait; 
      margin: 8mm 10mm; 
    }
    * { box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; 
      font-size: 10px; 
      color: #0f172a; 
      margin: 0; 
      padding: 0; 
      background: #ffffff;
    }
    .print-page {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .voucher-copy { 
      border: 1.5px solid #1e293b; 
      padding: 12px 14px; 
      border-radius: 6px; 
      background: #ffffff;
      position: relative;
    }
    .divider-cut-line {
      border-top: 1px dashed #94a3b8;
      position: relative;
      margin: 4px 0;
      text-align: center;
    }
    .divider-cut-text {
      position: relative;
      top: -8px;
      background: #ffffff;
      padding: 0 10px;
      font-size: 8px;
      color: #64748b;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .copy-badge-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      padding-bottom: 4px;
      border-bottom: 1px solid #e2e8f0;
    }
    .badge-copy {
      font-weight: 800;
      text-transform: uppercase;
      font-size: 9.5px;
      color: #047857;
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      padding: 2px 7px;
      border-radius: 4px;
      letter-spacing: 0.5px;
    }
    .legal-cite {
      font-size: 8.5px;
      color: #64748b;
      font-style: italic;
    }
    .header { 
      display: flex; 
      justify-content: space-between; 
      align-items: flex-start;
      margin-bottom: 10px; 
      gap: 15px;
    }
    .comp-name { font-size: 13px; font-weight: 800; color: #0f172a; }
    .comp-detail { font-size: 9.5px; color: #475569; margin-top: 1px; }
    .comp-register { font-size: 9.5px; color: #0f172a; margin-top: 3px; }
    .receipt-identity { text-align: right; }
    .main-title { font-size: 13px; margin: 0; text-transform: uppercase; font-weight: 900; color: #0f172a; letter-spacing: 0.5px; }
    .doc-code { font-size: 10px; font-weight: bold; color: #64748b; }
    .receipt-number { font-size: 16px; font-family: monospace; font-weight: 900; color: #0f172a; letter-spacing: 1px; margin: 2px 0; }
    .receipt-date { font-size: 9.5px; color: #334155; }
    
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
    .box { border: 1px solid #cbd5e1; border-radius: 4px; padding: 7px 9px; background: #f8fafc; }
    .box-label { font-size: 8.5px; color: #64748b; text-transform: uppercase; font-weight: bold; margin-bottom: 2px; }
    .box-val { font-size: 11px; font-weight: 700; color: #0f172a; }
    .box-sub { font-size: 9px; color: #475569; margin-top: 2px; }
    .box-source-doc { margin-top: 4px; padding-top: 4px; border-top: 1px dashed #cbd5e1; font-size: 9px; color: #1e293b; }
    .src-tag { font-size: 8px; color: #64748b; text-transform: uppercase; font-weight: 600; margin-right: 4px; }

    .amount-card { 
      border: 1.5px solid #0f172a; 
      background: #f1f5f9; 
      padding: 7px 12px; 
      border-radius: 4px; 
      margin-bottom: 10px; 
    }
    .amount-row { display: flex; justify-content: space-between; align-items: baseline; }
    .amount-label { font-size: 10px; font-weight: 800; text-transform: uppercase; color: #334155; }
    .amount-number { font-size: 17px; font-family: monospace; font-weight: 900; color: #0f172a; }
    .amount-in-words { font-style: italic; color: #1e293b; font-size: 10px; margin-top: 3px; border-top: 1px dashed #cbd5e1; padding-top: 3px; }

    .signatures-wrapper {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr 1fr 70px;
      gap: 8px;
      align-items: flex-end;
      margin-top: 8px;
      padding-top: 4px;
    }
    .sig-block { text-align: center; }
    .sig-img-container {
      height: 38px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .sig-img {
      max-height: 36px;
      max-width: 100%;
      object-fit: contain;
    }
    .sig-line { border-top: 1px solid #1e293b; margin-bottom: 3px; }
    .sig-title { font-size: 8.5px; font-weight: bold; color: #334155; text-transform: uppercase; }
    .sig-person { font-size: 8px; color: #64748b; margin-top: 1px; }

    .stamp-box {
      border: 1px dashed #94a3b8;
      border-radius: 4px;
      height: 60px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      background: #fafafa;
    }
    .stamp-text { font-size: 9px; font-weight: 800; color: #94a3b8; letter-spacing: 1px; }
    .stamp-sub { font-size: 7px; color: #94a3b8; text-transform: uppercase; }

    .voucher-footer { 
      margin-top: 8px; 
      padding-top: 4px; 
      border-top: 1px solid #e2e8f0; 
      font-size: 7.5px; 
      color: #94a3b8; 
      display: flex; 
      justify-content: space-between; 
    }
  </style>
</head>
<body>
  <div class="print-page">
    <!-- 1. PÉLDÁNY - EREDETI (Könyvelésé) -->
    ${renderVoucherCopy(1, 'EREDETI', 'Könyvelés példánya')}

    <div class="divider-cut-line">
      <span class="divider-cut-text">✂ vágási vonal ✂</span>
    </div>

    <!-- 2. PÉLDÁNY - MÁSOLAT (Átadó / Átvevő példánya) -->
    ${renderVoucherCopy(2, 'MÁSOLAT', isIncome ? 'Befizető példánya' : 'Átvevő példánya')}
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() { 
        window.print(); 
      }, 300);
    };
  </script>
</body>
</html>`;

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
}
