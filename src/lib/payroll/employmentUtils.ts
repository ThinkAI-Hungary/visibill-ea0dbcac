/**
 * Jogviszony és foglalkoztatási formák segédfüggvényei (Mt. vs. Nem-Mt. jogviszonyok).
 *
 * Az Mt. (2012. évi I. törvény) 115. § és 126. § szerint fizetett szabadság
 * és munkáltató által fizetett betegszabadság (15 munkanap 70%-on) kizárólag
 * munkaviszonyban (és közszolgálati jogviszonyokban) illeti meg a foglalkoztatottat.
 *
 * Egyéni vállalkozóknál (EV), társas vállalkozóknál és megbízási jogviszonyban
 * sem szabadság, sem betegszabadság nem könyvelendő.
 */

export const MT_EMPLOYMENT_TYPES = new Set([
  'munkaviszony',
  'munkaviszony_reszido',
  'bedolgozo',
  'munkaero_kolcsonzes',
  'szakkep',
  'osztondijas',
  'neveloszulo',
  'haztartasi',
  'nyugdijas',
  'gyes_gyed',
  'kulfold_kikuld',
  'kozalkalmazott',
  'kozszolgalati',
  'kormanytisztviselo',
  'biro_ugyesz',
  'hivatásos_katona',
  'kozfogl',
  'premiumevek',
]);

export const NON_MT_ENTREPRENEUR_TYPES = new Set([
  'ev',
  'ev_mellekfogl',
  'egyeni_vallalkozo',
  'tarsas_vallalkozo',
  'tarsas_vallalkozo_mellekfogl',
]);

export const CONTRACTOR_TYPES = new Set([
  'megbizas',
  'megbizas_eseti',
  'tartos_megbizas',
  'valasztott_tisztsegviselo',
  'onkentes',
  'egyhazi',
]);

/**
 * Megállapítja, hogy az adott jogviszony az Mt. (vagy Kjt./Kttv./Kit.) hatálya alá tartozik-e,
 * azaz jogosult-e fizetett szabadságra és betegszabadságra.
 */
export function isMtEmployment(employmentType?: string | null): boolean {
  if (!employmentType) return true; // Default fallback to normal employment if unspecified
  const normalized = employmentType.toLowerCase().trim();
  if (NON_MT_ENTREPRENEUR_TYPES.has(normalized)) return false;
  if (CONTRACTOR_TYPES.has(normalized)) return false;
  return MT_EMPLOYMENT_TYPES.has(normalized) || (!normalized.includes('ev') && !normalized.includes('vallalkozo') && !normalized.includes('megbizas'));
}

/**
 * Szabadság és betegszabadság adminisztráció támogatottságának ellenőrzése.
 */
export function supportsLeaveAndSickPay(employmentType?: string | null): boolean {
  return isMtEmployment(employmentType);
}

/**
 * Tájékoztató szöveg nem-Mt. jogviszonyokhoz a szabadság/betegszabadság nézeteken.
 */
export function getNonMtNotice(employmentType?: string | null): string | null {
  if (!employmentType) return null;
  const normalized = employmentType.toLowerCase().trim();
  if (normalized === 'ev' || normalized === 'ev_mellekfogl') {
    return 'Egyéni vállalkozó (EV) esetén nem értelmezett az Mt. szerinti fizetett szabadság és betegszabadság (önfoglalkoztató).';
  }
  if (normalized.includes('tarsas_vallalkozo')) {
    return 'Társas vállalkozói jogviszonyban nem értelmezett az Mt. szerinti munkavállalói szabadság és betegszabadság.';
  }
  if (normalized.includes('megbizas')) {
    return 'Megbízási jogviszonyban (Ptk.) nem keletkezik Mt. szerinti fizetett szabadság és betegszabadság.';
  }
  if (!isMtEmployment(normalized)) {
    return 'A kiválasztott foglalkoztatási formában nem értelmezett az Mt. szerinti szabadság és betegszabadság.';
  }
  return null;
}
