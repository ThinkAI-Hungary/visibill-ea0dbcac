import { generateAnnualReportPreviewUrl } from './annualReportPdf';

interface AnnualReportData {
  companyName: string;
  companyAddress?: string;
  companyTaxNumber?: string;
  fiscalYear: number;
  representativeName: string;
  representativeRole: string;
  reportDate: string;
  frozenBsData: any[];
  frozenPnlData: any[];
  notesSections: { section_key: string; text: string; title?: string; is_custom?: boolean }[];
  notesTemplates: { section_key: string; section_title: string; default_text: string }[];
  netIncome: number;
  dividendAmount: number;
  retainedEarnings: number;
  dividendResolutionDate: string;
}

const esc = (s: unknown): string => {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

const stripHtml = (html: string): string => {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim();
};

export function buildAnnualReportXml(data: AnnualReportData): string {
  const bs = data.frozenBsData || [];
  const pnl = data.frozenPnlData || [];

  // Compute metrics for notes variables replacement
  const equityTotal = bs.filter((r: any) => r.section === 'liabilities' && (r.row_code || '').startsWith('D') && r.type === 'letter')
    .reduce((a: number, r: any) => a + Number(r.current_balance || 0), 0);
  const equityPrior = bs.filter((r: any) => r.section === 'liabilities' && (r.row_code || '').startsWith('D') && r.type === 'letter')
    .reduce((a: number, r: any) => a + Number(r.prior_year_balance || 0), 0);
  const totalAssetVal = bs.filter((r: any) => r.section === 'assets' && r.type === 'total')
    .reduce((a: number, r: any) => a + Number(r.current_balance || 0), 0);
  const currentAssetsVal = bs.filter((r: any) => r.section === 'assets' && (r.row_code || '').startsWith('B') && r.type === 'letter')
    .reduce((a: number, r: any) => a + Number(r.current_balance || 0), 0);
  const shortTermLiab = bs.filter((r: any) => r.section === 'liabilities' && (r.row_code || '').startsWith('F') && r.type === 'letter')
    .reduce((a: number, r: any) => a + Number(r.current_balance || 0), 0);
  const roe = equityTotal > 0 ? ((data.netIncome / equityTotal) * 100).toFixed(1) : '0.0';
  const liquidity = shortTermLiab > 0 ? (currentAssetsVal / shortTermLiab).toFixed(2) : 'N/A';
  const liquidityEval = Number(liquidity) >= 1.3 ? 'biztonsággal fedezik' : Number(liquidity) >= 1.0 ? 'éppen fedezik' : 'nem fedezik';

  const replaceVars = (text: string): string => {
    const vars: Record<string, string> = {
      '[Cégnév]': data.companyName || '___',
      '[Székhely]': data.companyAddress || '___',
      '[Adószám]': data.companyTaxNumber || '___',
      '[Tárgyév]': String(data.fiscalYear),
      '[Tárgyév+1]': String(data.fiscalYear + 1),
      '[Képviselő neve]': data.representativeName || '___',
      '[Képviselő beosztása]': data.representativeRole || 'ügyvezető',
      '[Saját tőke]': new Intl.NumberFormat('hu-HU').format(Math.round(equityTotal / 1000)) + ' E Ft',
      '[Saját tőke változás]': equityTotal >= equityPrior ? 'növekedett' : 'csökkent',
      '[Mérlegfőösszeg]': new Intl.NumberFormat('hu-HU').format(Math.round(totalAssetVal / 1000)) + ' E Ft',
      '[ROE]': roe + '%',
      '[Likviditás]': liquidity,
      '[Likviditás értékelés]': liquidityEval,
      '[Adózott eredmény]': new Intl.NumberFormat('hu-HU').format(Math.round(data.netIncome / 1000)) + ' E Ft',
      '[Osztalék]': new Intl.NumberFormat('hu-HU').format(Math.round(data.dividendAmount / 1000)) + ' E Ft',
      '[Eredménytartalék]': new Intl.NumberFormat('hu-HU').format(Math.round(data.retainedEarnings / 1000)) + ' E Ft',
      '[AUTOMATIKUS TÁBLÁZAT - TENY MODULBÓL]': '(Lásd a mellékelt Tárgyi Eszköz részletezést)',
      '[AUTOMATIKUS TÁBLÁZAT - MÉRLEG D. SOROKBÓL]': '(Lásd a Saját Tőke változás kimutatást)',
      '[AUTOMATIKUS TÁBLÁZAT - FOGLALKOZTATOTTI ADATOK]': '(Lásd a Személyi jellegű ráfordítások részletezést)',
    };
    let result = text;
    for (const [key, val] of Object.entries(vars)) {
      result = result.split(key).join(val);
    }
    return result;
  };

  const xmlParts: string[] = [];
  xmlParts.push('<?xml version="1.0" encoding="UTF-8"?>');
  xmlParts.push('<beszamolo xmlns="http://www.e-beszamolo.hu/schema/obr" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.e-beszamolo.hu/schema/obr http://www.e-beszamolo.hu/schema/obr/obr_import.xsd">');
  
  // ── Company details ──
  xmlParts.push('  <cegadatok>');
  xmlParts.push(`    <nev>${esc(data.companyName)}</nev>`);
  if (data.companyAddress) {
    xmlParts.push(`    <szekhely>${esc(data.companyAddress)}</szekhely>`);
  }
  if (data.companyTaxNumber) {
    xmlParts.push(`    <adoszam>${esc(data.companyTaxNumber)}</adoszam>`);
  }
  xmlParts.push('  </cegadatok>');

  // ── Report metadata header ──
  xmlParts.push('  <fejlec>');
  xmlParts.push(`    <ev>${data.fiscalYear}</ev>`);
  xmlParts.push(`    <idoszak_kezdete>${data.fiscalYear}-01-01</idoszak_kezdete>`);
  xmlParts.push(`    <idoszak_vege>${data.fiscalYear}-12-31</idoszak_vege>`);
  xmlParts.push('    <kepviselo>');
  xmlParts.push(`      <nev>${esc(data.representativeName)}</nev>`);
  xmlParts.push(`      <beosztas>${esc(data.representativeRole)}</beosztas>`);
  xmlParts.push('    </kepviselo>');
  xmlParts.push(`    <kelte>${esc(data.reportDate)}</kelte>`);
  xmlParts.push('    <penznem>HUF</penznem>');
  xmlParts.push('    <mertekegyseg>Ezer Ft</mertekegyseg>');
  xmlParts.push('  </fejlec>');

  // ── Balance Sheet ──
  xmlParts.push('  <merleg>');
  bs.forEach((r: any) => {
    const isTotal = r.type === 'total';
    const isLetter = r.type === 'letter';
    const isRoman = r.type === 'roman';
    const isArabic = r.type === 'arabic';
    
    xmlParts.push('    <sor>');
    xmlParts.push(`      <kod>${esc(r.row_code || '')}</kod>`);
    xmlParts.push(`      <megnevezes>${esc(r.name || '')}</megnevezes>`);
    xmlParts.push(`      <elozo_ev>${Math.round((Number(r.prior_year_balance) || 0) / 1000)}</elozo_ev>`);
    xmlParts.push(`      <targyev>${Math.round((Number(r.current_balance) || 0) / 1000)}</targyev>`);
    xmlParts.push(`      <tipus>${isTotal ? 'total' : isLetter ? 'letter' : isRoman ? 'roman' : 'arabic'}</tipus>`);
    if (r.section) {
      xmlParts.push(`      <reszleg>${esc(r.section)}</reszleg>`);
    }
    xmlParts.push('    </sor>');
  });
  xmlParts.push('  </merleg>');

  // ── Profit & Loss ──
  xmlParts.push('  <eredmenykimutatas>');
  pnl.forEach((r: any) => {
    const val = Math.round((Number(r.balance || 0) * Number(r.multiplier || 1)) / 1000);
    xmlParts.push('    <sor>');
    xmlParts.push(`      <kod>${esc(r.row_code || '')}</kod>`);
    xmlParts.push(`      <megnevezes>${esc(r.name || '')}</megnevezes>`);
    xmlParts.push(`      <targyev>${val}</targyev>`);
    xmlParts.push(`      <tipus>${esc(r.type || 'item')}</tipus>`);
    xmlParts.push('    </sor>');
  });
  xmlParts.push('  </eredmenykimutatas>');

  // ── Supplementary Notes ──
  xmlParts.push('  <kiegeszito_melleklet>');
  const templates = data.notesTemplates || [];
  templates.forEach(tmpl => {
    const saved = data.notesSections?.find(s => s.section_key === tmpl.section_key);
    const rawText = saved?.text || tmpl.default_text || '';
    const cleanText = stripHtml(replaceVars(rawText));
    
    xmlParts.push('    <szekcio>');
    xmlParts.push(`      <kulcs>${esc(tmpl.section_key)}</kulcs>`);
    xmlParts.push(`      <cim>${esc(tmpl.section_title)}</cim>`);
    xmlParts.push(`      <tartalom>${esc(cleanText)}</tartalom>`);
    xmlParts.push('    </szekcio>');
  });
  // Custom user sections
  const customSections = (data.notesSections || []).filter(s => (s as any).is_custom);
  customSections.forEach(s => {
    const cleanText = stripHtml(replaceVars(s.text || ''));
    xmlParts.push('    <szekcio>');
    xmlParts.push(`      <kulcs>${esc(s.section_key)}</kulcs>`);
    xmlParts.push(`      <cim>${esc((s as any).title || 'Egyéni szekció')}</cim>`);
    xmlParts.push(`      <tartalom>${esc(cleanText)}</tartalom>`);
    xmlParts.push('    </szekcio>');
  });
  xmlParts.push('  </kiegeszito_melleklet>');

  // ── Dividend allocation ──
  xmlParts.push('  <osztalek_hatarozat>');
  xmlParts.push(`    <adozott_eredmeny>${Math.round(data.netIncome / 1000)}</adozott_eredmeny>`);
  xmlParts.push(`    <jovahagyott_osztalek>${Math.round(data.dividendAmount / 1000)}</jovahagyott_osztalek>`);
  xmlParts.push(`    <eredmenytartalekba_helyezett>${Math.round(data.retainedEarnings / 1000)}</eredmenytartalekba_helyezett>`);
  if (data.dividendResolutionDate) {
    xmlParts.push(`    <hatarozat_kelte>${esc(data.dividendResolutionDate)}</hatarozat_kelte>`);
  }
  xmlParts.push('  </osztalek_hatarozat>');

  xmlParts.push('</beszamolo>');
  return xmlParts.join('\n');
}

export function downloadAnnualReportXml(data: AnnualReportData) {
  const xmlContent = buildAnnualReportXml(data);
  const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  const safeCegNev = (data.companyName || 'beszamolo')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9_-]/g, '_');  // remove non-safe characters
    
  link.href = url;
  link.download = `obr_beszamolo_${safeCegNev}_${data.fiscalYear}.xml`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
