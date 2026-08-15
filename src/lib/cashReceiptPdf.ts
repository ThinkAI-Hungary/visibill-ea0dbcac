import jsPDF from 'jspdf';

// jsPDF Helvetica only supports Latin-1. Hungarian ő/ű are Latin-2.
function hu(text: string): string {
  return text.replace(/ő/g, 'ö').replace(/Ő/g, 'Ö').replace(/ű/g, 'ü').replace(/Ű/g, 'Ü');
}

/**
 * Hungarian number-to-words helper.
 * Formats numbers up to 999,999,999 according to Hungarian grammar rules:
 * - Compiled as a single word up to 2000 (e.g., 1999 -> "ezerszázkilencvenkilenc").
 * - Above 2000, hyphenated by thousands boundaries (e.g., 2001 -> "kettőezer-egy", 1250000 -> "egymillió-kettőszázötvenezer").
 */
export function numberToWordsHu(num: number): string {
  if (num === 0) return 'nulla';
  const val = Math.abs(Math.round(num));
  
  const ones = ['', 'egy', 'kettő', 'három', 'négy', 'öt', 'hat', 'hét', 'nyolc', 'kilenc'];
  const tens = ['', 'tíz', 'húsz', 'harminc', 'negyven', 'ötven', 'hatvan', 'hetven', 'nyolcvan', 'kilencven'];
  
  const getUnder1000 = (n: number): string => {
    let text = '';
    const h = Math.floor(n / 100);
    const remainder = n % 100;
    
    if (h > 0) {
      if (h === 1) text += 'száz';
      else text += ones[h] + 'száz';
    }
    
    if (remainder > 0) {
      if (remainder < 10) {
        text += ones[remainder];
      } else if (remainder % 10 === 0) {
        text += tens[remainder / 10];
      } else {
        const t = Math.floor(remainder / 10);
        const o = remainder % 10;
        if (t === 1) text += 'tizen' + ones[o];
        else if (t === 2) text += 'huszon' + ones[o];
        else text += tens[t] + ones[o];
      }
    }
    return text;
  };

  const getWords = (n: number): string => {
    if (n === 0) return '';
    
    const millions = Math.floor(n / 1000000);
    const thousands = Math.floor((n % 1000000) / 1000);
    const remainder = n % 1000;
    
    let parts: string[] = [];
    
    if (millions > 0) {
      parts.push(getUnder1000(millions) + 'millió');
    }
    if (thousands > 0) {
      if (thousands === 1 && millions === 0) {
        parts.push('ezer');
      } else {
        parts.push(getUnder1000(thousands) + 'ezer');
      }
    }
    if (remainder > 0) {
      parts.push(getUnder1000(remainder));
    }
    
    // Hungarian compounding rules:
    // If number is <= 2000, write as a single word (no hyphens)
    if (n <= 2000) {
      return parts.join('');
    } else {
      // Hyphenate boundaries
      return parts.filter(Boolean).join('-');
    }
  };

  return getWords(val);
}

interface CashReceiptData {
  companyName: string;
  companyAddress?: string;
  companyTaxNumber?: string;
  receiptNumber: string;
  entryDate: string;
  registerName: string;
  description: string;
  amount: number;
  currency: string;
  payerSig?: string | null;
  recipientSig?: string | null;
}

export function generateCashReceiptPdf(data: CashReceiptData): string {
  // A5 Landscape is 210mm x 148mm
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a5' });
  const pw = doc.internal.pageSize.getWidth(); // 210
  const ph = doc.internal.pageSize.getHeight(); // 148

  const isIncome = data.amount >= 0;
  const absAmount = Math.abs(data.amount);

  // Background and borders (premium layout border design)
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.rect(5, 5, pw - 10, ph - 10, 'S');
  doc.rect(6, 6, pw - 12, ph - 12, 'S');

  // Top header green / red bar depending on entry type
  const themeColor = isIncome ? [16, 185, 129] : [239, 68, 68]; // Emerald vs Red
  doc.setFillColor(themeColor[0], themeColor[1], themeColor[2]);
  doc.rect(8, 8, pw - 16, 15, 'F');

  // Header Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  const titleText = isIncome ? 'BEVETELI KESZPENZBIZONYLAT' : 'KIADASI KESZPENZBIZONYLAT';
  doc.text(hu(titleText), 14, 18);

  // Currency Badge in Header
  doc.setFillColor(255, 255, 255, 0.2);
  doc.roundedRect(pw - 36, 11, 24, 9, 1.5, 1.5, 'F');
  doc.setFontSize(10);
  doc.text(data.currency, pw - 24, 17, { align: 'center' });

  // Reset text color to slate
  doc.setTextColor(30, 41, 59);

  let y = 32;

  // Left column: Company info
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(hu('Kiallito (Ceg) adatai:'), 12, y);
  doc.setFont('helvetica', 'normal');
  doc.text(hu(data.companyName), 12, y + 4.5);
  if (data.companyAddress) doc.text(hu(data.companyAddress), 12, y + 8.5);
  if (data.companyTaxNumber) doc.text(hu(`Adoszam: ${data.companyTaxNumber}`), 12, y + 12.5);

  // Right column: Receipt details box
  doc.setFillColor(248, 250, 252); // light slate background
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(pw - 82, y - 4, 70, 20, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(hu('Bizonylatszam:'), pw - 78, y + 1);
  doc.setFont('helvetica', 'normal');
  doc.text(hu(data.receiptNumber), pw - 38, y + 1);

  doc.setFont('helvetica', 'bold');
  doc.text(hu('Datum:'), pw - 78, y + 6);
  doc.setFont('helvetica', 'normal');
  const dateFormatted = data.entryDate ? data.entryDate.replace(/-/g, '. ') + '.' : '—';
  doc.text(hu(dateFormatted), pw - 38, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.text(hu('Penztar:'), pw - 78, y + 11);
  doc.setFont('helvetica', 'normal');
  doc.text(hu(data.registerName), pw - 38, y + 11);

  y += 20;

  // Horizontal divider line
  doc.setDrawColor(226, 232, 240);
  doc.line(12, y, pw - 12, y);
  y += 6;

  // Main Transaction Details Table
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(hu(isIncome ? 'Fizeto / Befizeto:' : 'Kedvezmenyezett / Atvevo:'), 12, y);
  
  // Extract partner name from description if manual or display description
  doc.setFont('helvetica', 'normal');
  let partnerText = data.description || '';
  if (partnerText.includes(' - ')) {
    partnerText = partnerText.split(' - ')[1];
  }
  doc.text(hu(partnerText), 56, y);
  y += 8;

  // Amount in numbers box
  doc.setFont('helvetica', 'bold');
  doc.text(hu('Osszeg szammal:'), 12, y);
  
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(54, y - 4.5, 60, 7, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  const formattedNum = absAmount.toLocaleString('hu-HU') + ' ' + data.currency;
  doc.text(hu(formattedNum), 58, y);
  
  doc.setFontSize(9);
  y += 8;

  // Amount in words
  doc.setFont('helvetica', 'bold');
  doc.text(hu('Osszeg betuvel:'), 12, y);
  doc.setFont('helvetica', 'normal');
  const spelledOut = numberToWordsHu(absAmount) + ' ' + (data.currency === 'HUF' ? 'forint' : data.currency.toLowerCase());
  doc.text(hu(spelledOut), 56, y);
  y += 8;

  // Description / Jogcim
  doc.setFont('helvetica', 'bold');
  doc.text(hu('Jogcim / Megjegyzes:'), 12, y);
  doc.setFont('helvetica', 'normal');
  doc.text(hu(data.description || 'Keszpenzforgalmi elszamolas'), 56, y);
  
  y += 12;

  // Signatures area
  const sigBoxW = (pw - 24 - 8) / 3; // 3 boxes (Payer, Recipient, Accountant)
  const sigY = ph - 38;

  const drawSigBox = (title: string, x: number, sigImage?: string | null) => {
    // Label
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(hu(title), x + sigBoxW / 2, sigY, { align: 'center' });
    
    // Line
    doc.setDrawColor(203, 213, 225);
    doc.line(x, sigY + 16, x + sigBoxW, sigY + 16);
    
    // Signature drawing if present
    if (sigImage) {
      try {
        doc.addImage(sigImage, 'PNG', x + 5, sigY + 2, sigBoxW - 10, 12);
      } catch (err) {
        console.error('Failed to render signature in PDF:', err);
      }
    }
  };

  drawSigBox(isIncome ? 'Befizeto alairasa' : 'Kifizeto (Penztaros)', 12, data.payerSig);
  drawSigBox(isIncome ? 'Kado (Penztaros)' : 'Atvevo alairasa', 12 + sigBoxW + 4, data.recipientSig);
  drawSigBox('Ellenor / Konyvelo', 12 + (sigBoxW + 4) * 2, null);

  // Footer stamp placeholder
  doc.setFontSize(6);
  doc.setTextColor(148, 163, 184);
  doc.text(hu('Visibill Keszpenzbizonylat Generalo Modul v1.1.0'), pw / 2, ph - 8, { align: 'center' });

  return doc.output('bloburl').toString();
}
