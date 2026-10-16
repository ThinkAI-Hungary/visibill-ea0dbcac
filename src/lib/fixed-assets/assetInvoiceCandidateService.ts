export interface AssetCandidateDetectionResult {
  isCandidate: boolean;
  confidence: 'high' | 'medium' | 'low';
  reasons: string[];
  suggestedUsefulLifeMonths?: number;
  suggestedTaoRate?: number;
  suggestedGlAccountPrefix?: string;
  suggestedCategory?: string;
}

export interface InvoiceItemForDetection {
  id: string;
  line_description: string | null;
  net_amount: number | null;
  gross_amount?: number | null;
  unit_price?: number | null;
  quantity?: number | null;
  product_code?: string | null;
  vtsz_teszor?: string | null;
  gl_account_number?: string | null;
}

// Gyakori tárgyi eszköz kulcsszavak magyar és angol nyelven
const ASSET_KEYWORDS = [
  // IT / Irodatechnika
  { word: 'laptop', category: 'Számítástechnika', months: 36, rate: 33, gl: '134' },
  { word: 'notebook', category: 'Számítástechnika', months: 36, rate: 33, gl: '134' },
  { word: 'számítógép', category: 'Számítástechnika', months: 36, rate: 33, gl: '134' },
  { word: 'pc ', category: 'Számítástechnika', months: 36, rate: 33, gl: '134' },
  { word: 'szerver', category: 'Számítástechnika', months: 36, rate: 33, gl: '134' },
  { word: 'server', category: 'Számítástechnika', months: 36, rate: 33, gl: '134' },
  { word: 'monitor', category: 'Számítástechnika', months: 36, rate: 33, gl: '134' },
  { word: 'iphone', category: 'Számítástechnika / Telekommunikáció', months: 36, rate: 33, gl: '134' },
  { word: 'okostelefon', category: 'Számítástechnika / Telekommunikáció', months: 36, rate: 33, gl: '134' },
  { word: 'nyomtató', category: 'Irodai berendezés', months: 36, rate: 33, gl: '134' },
  // Jármű
  { word: 'gépkocsi', category: 'Járművek', months: 60, rate: 20, gl: '142' },
  { word: 'személygépkocsi', category: 'Járművek', months: 60, rate: 20, gl: '142' },
  { word: 'haszongépjármű', category: 'Járművek', months: 60, rate: 20, gl: '143' },
  { word: 'tehergépkocsi', category: 'Járművek', months: 60, rate: 20, gl: '143' },
  { word: 'autó', category: 'Járművek', months: 60, rate: 20, gl: '142' },
  { word: 'targonca', category: 'Járművek / Anyagmozgatás', months: 84, rate: 14.5, gl: '143' },
  // Gépek / Berendezések
  { word: 'gép', category: 'Műszaki berendezések', months: 84, rate: 14.5, gl: '131' },
  { word: 'berendezés', category: 'Műszaki berendezések', months: 84, rate: 14.5, gl: '131' },
  { word: 'klíma', category: 'Épületberendezés', months: 120, rate: 10, gl: '131' },
  { word: 'hőszivattyú', category: 'Műszaki berendezés', months: 120, rate: 10, gl: '131' },
  { word: 'szerszámgép', category: 'Műszaki berendezések', months: 84, rate: 14.5, gl: '131' },
  // Bútor / Berendezés
  { word: 'íróasztal', category: 'Irodabútor', months: 84, rate: 14.5, gl: '133' },
  { word: 'irodabútor', category: 'Irodabútor', months: 84, rate: 14.5, gl: '133' },
  { word: 'forgószék', category: 'Irodabútor', months: 84, rate: 14.5, gl: '133' },
  { word: 'tárgyalóasztal', category: 'Irodabútor', months: 84, rate: 14.5, gl: '133' },
];

/**
 * Megvizsgálja egy számlasor adatait, és eldönti, hogy tárgyi eszköz jelölt-e.
 */
export function detectAssetCandidate(item: InvoiceItemForDetection): AssetCandidateDetectionResult {
  const reasons: string[] = [];
  let confidenceScore = 0; // 0..100
  let matchedRule: typeof ASSET_KEYWORDS[0] | undefined;

  const desc = (item.line_description || '').toLowerCase();
  const netAmount = item.net_amount ?? (item.unit_price && item.quantity ? item.unit_price * item.quantity : 0);
  const code = (item.vtsz_teszor || item.product_code || '').trim();
  const gl = (item.gl_account_number || '').trim();

  // 1. Főkönyvi számla jelzés (161 Befejezetlen beruházás vagy 1-es számlaosztály)
  if (gl.startsWith('161')) {
    reasons.push('Főkönyvi számla: 161 (Befejezetlen beruházás)');
    confidenceScore += 60;
  } else if (gl.startsWith('12') || gl.startsWith('13') || gl.startsWith('14')) {
    reasons.push(`Főkönyvi számla: ${gl} (Tárgyi eszköz számlaosztály)`);
    confidenceScore += 70;
  }

  // 2. VTSZ / TESZOR kód vizsgálat
  if (code.startsWith('8471') || code.startsWith('26.2')) {
    reasons.push(`VTSZ/TESZOR kód (${code}): Számítástechnikai eszköz`);
    confidenceScore += 50;
    matchedRule = { word: 'it', category: 'Számítástechnikai eszközök', months: 36, rate: 33, gl: '134' };
  } else if (code.startsWith('8703') || code.startsWith('8704') || code.startsWith('29.1')) {
    reasons.push(`VTSZ/TESZOR kód (${code}): Gépjármű`);
    confidenceScore += 55;
    matchedRule = { word: 'auto', category: 'Járművek', months: 60, rate: 20, gl: '142' };
  } else if (code.startsWith('9403') || code.startsWith('31.0')) {
    reasons.push(`VTSZ/TESZOR kód (${code}): Irodabútor`);
    confidenceScore += 40;
    matchedRule = { word: 'butor', category: 'Irodabútor', months: 84, rate: 14.5, gl: '133' };
  } else if (code.startsWith('84') || code.startsWith('85') || code.startsWith('28.')) {
    reasons.push(`VTSZ/TESZOR kód (${code}): Gép / Műszaki berendezés`);
    confidenceScore += 45;
    matchedRule = { word: 'gep', category: 'Műszaki berendezések', months: 84, rate: 14.5, gl: '131' };
  }

  // 3. Megnevezés kulcsszó vizsgálat
  for (const kw of ASSET_KEYWORDS) {
    if (desc.includes(kw.word)) {
      reasons.push(`Kulcsszó egyezés: "${kw.word}" (${kw.category})`);
      confidenceScore += 40;
      if (!matchedRule) {
        matchedRule = kw;
      }
      break;
    }
  }

  // 4. Értékhatár vizsgálat (>= 200 000 Ft törvényi határ)
  if (netAmount >= 500000) {
    reasons.push(`Nettó érték: ${Math.round(netAmount).toLocaleString('hu-HU')} Ft (jelentős beruházási érték)`);
    confidenceScore += 50;
  } else if (netAmount >= 200000) {
    reasons.push(`Nettó érték: ${Math.round(netAmount).toLocaleString('hu-HU')} Ft (≥ 200 000 Ft értékhatár)`);
    confidenceScore += 40;
  } else if (netAmount > 0 && netAmount < 200000 && confidenceScore >= 40) {
    reasons.push(`Kisértékű tárgyi eszköz jelölt (< 200 000 Ft, 1 összegben leírható)`);
  }

  // Eredmény értékelése
  const isCandidate = confidenceScore >= 40;
  const confidence: 'high' | 'medium' | 'low' =
    confidenceScore >= 70 ? 'high' : confidenceScore >= 40 ? 'medium' : 'low';

  return {
    isCandidate,
    confidence,
    reasons,
    suggestedCategory: matchedRule?.category || (netAmount >= 200000 ? 'Egyéb berendezés' : 'Kisértékű eszköz'),
    suggestedUsefulLifeMonths: matchedRule?.months || (netAmount < 200000 ? 1 : 60),
    suggestedTaoRate: matchedRule?.rate || (netAmount < 200000 ? 100 : 14.5),
    suggestedGlAccountPrefix: matchedRule?.gl || '131',
  };
}
