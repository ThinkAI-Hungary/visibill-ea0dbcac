/**
 * B9: e-Beszámoló CSV Export Generator
 * 
 * Since the OBR format is proprietary (no public XSD schema exists),
 * this module generates CSV files that can be imported into the 
 * e-Beszámoló online form filler or other accounting software.
 * 
 * It produces two CSV files in a zip:
 * 1. merleg.csv — Balance Sheet rows (row_code, name, prior_year, current_year)
 * 2. eredmenykimutatas.csv — P&L rows (row_code, name, balance)
 */

interface EBeszamoloCsvData {
  companyName: string;
  companyTaxNumber?: string;
  fiscalYear: number;
  frozenBsData: any[];
  frozenPnlData: any[];
  netIncome: number;
  dividendAmount: number;
  retainedEarnings: number;
}

const CSV_SEPARATOR = ';';

function toCsvRow(fields: (string | number)[]): string {
  return fields.map(f => {
    const s = String(f ?? '');
    // Quote if contains separator, quote, or newline
    if (s.includes(CSV_SEPARATOR) || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }).join(CSV_SEPARATOR);
}

function generateBalanceSheetCsv(bs: any[], fiscalYear: number): string {
  const header = toCsvRow(['Sor', 'Megnevezés', 'Szekció', 'Típus', `Előző év (Ft)`, `${fiscalYear}. év (Ft)`]);
  
  // Filter to relevant rows (non-zero or structural)
  const rows = bs
    .filter((r: any) => r.type !== 'total' || true) // keep all
    .sort((a: any, b: any) => (a.order_num || 0) - (b.order_num || 0))
    .map((r: any) => toCsvRow([
      r.row_code || '',
      r.name || '',
      r.section === 'assets' ? 'Eszközök' : 'Források',
      r.type || '',
      Math.round(Number(r.prior_year_balance) || 0),
      Math.round(Number(r.current_balance) || 0),
    ]));

  return '\uFEFF' + [header, ...rows].join('\r\n'); // BOM for Excel
}

function generatePnlCsv(pnl: any[], fiscalYear: number): string {
  const header = toCsvRow(['Sor', 'Megnevezés', 'Típus', 'Szorzó', `${fiscalYear}. év egyenleg (Ft)`, `Számított érték (Ft)`]);

  const rows = pnl
    .sort((a: any, b: any) => (a.order_num || 0) - (b.order_num || 0))
    .map((r: any) => {
      const balance = Number(r.balance || 0);
      const multiplier = Number(r.multiplier || 1);
      return toCsvRow([
        r.row_code || '',
        r.name || '',
        r.type || '',
        multiplier,
        Math.round(balance),
        Math.round(balance * multiplier),
      ]);
    });

  return '\uFEFF' + [header, ...rows].join('\r\n');
}

function generateSummaryCsv(data: EBeszamoloCsvData): string {
  const header = toCsvRow(['Mező', 'Érték']);
  const rows = [
    toCsvRow(['Cégnév', data.companyName]),
    toCsvRow(['Adószám', data.companyTaxNumber || '']),
    toCsvRow(['Üzleti év', data.fiscalYear]),
    toCsvRow(['Adózott eredmény (Ft)', Math.round(data.netIncome)]),
    toCsvRow(['Osztalék (Ft)', Math.round(data.dividendAmount)]),
    toCsvRow(['Eredménytartalékba (Ft)', Math.round(data.retainedEarnings)]),
    toCsvRow(['Mérleg sorok száma', data.frozenBsData?.length || 0]),
    toCsvRow(['P&L sorok száma', data.frozenPnlData?.length || 0]),
    toCsvRow(['Export időpont', new Date().toISOString()]),
  ];
  return '\uFEFF' + [header, ...rows].join('\r\n');
}

/**
 * Generate individual CSV files and trigger downloads.
 * (No zip dependency needed — downloads 3 separate files)
 */
export function downloadEBeszamoloCsv(data: EBeszamoloCsvData): void {
  const prefix = `${data.companyName.replace(/[^a-zA-Z0-9áéíóöőúüűÁÉÍÓÖŐÚÜŰ ]/g, '').substring(0, 30)}_${data.fiscalYear}`;

  const files = [
    { name: `${prefix}_merleg.csv`, content: generateBalanceSheetCsv(data.frozenBsData || [], data.fiscalYear) },
    { name: `${prefix}_eredmenykimutatas.csv`, content: generatePnlCsv(data.frozenPnlData || [], data.fiscalYear) },
    { name: `${prefix}_osszefoglalo.csv`, content: generateSummaryCsv(data) },
  ];

  // Download each file
  for (const file of files) {
    const blob = new Blob([file.content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

/**
 * The e-Beszámoló portal URL for manual submission.
 */
export const E_BESZAMOLO_PORTAL_URL = 'https://e-beszamolo.im.gov.hu/oldal/beszamolo_kereses';
