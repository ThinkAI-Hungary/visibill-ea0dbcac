/**
 * invoiceMatchingUtils.ts
 * ============================================================================
 * Szigorított NAV ↔ Feltöltött számla párosítási és ellenőrzési segédfüggvények.
 *
 * Biztosítja, hogy az azonos számlasorszám (bizonylatsorszám) megléte mellett
 * a partner adószáma, normalizált neve vagy az összeg is egyezzen, kizárva
 * a téves kereszt-céges vagy téves partneri csatolmány-párosításokat.
 * ============================================================================
 */

export interface NavInvoiceMatchCandidate {
  id?: string;
  invoice_number?: string | null;
  invoice_direction?: string | null;
  supplier_name?: string | null;
  supplier_tax_number?: string | null;
  customer_name?: string | null;
  customer_tax_number?: string | null;
  invoice_gross_amount?: number | null;
  currency?: string | null;
}

export interface SubmittedInvoiceMatchCandidate {
  id?: string;
  bizonylatsorszam?: string | null;
  invoice_direction?: string | null;
  elado_nev?: string | null;
  elado_vat_id?: string | null;
  vevo_nev?: string | null;
  vevo_vat_id?: string | null;
  brutto_vegosszeg?: number | null;
  penznem?: string | null;
  nav_invoice_id?: string | null;
  nav_status?: string | null;
}

/**
 * Számlaszám normalizálása: szóközök eltávolítása és nagybetűssé alakítás.
 * Példa: "0057 / 26" -> "0057/26"
 */
export function normalizeInvoiceNumber(num: string | null | undefined): string {
  if (!num) return '';
  return num.replace(/\s+/g, '').toUpperCase();
}

/**
 * Magyar / EU adószám 8 számjegyű törzsszámának (alapadószám) kinyerése.
 * Eltávolítja az országkódot (pl. HU), ÁFA-kódot és megyekódot.
 *
 * Példák:
 * - "11032773-2-03" -> "11032773"
 * - "HU11032773"    -> "11032773"
 * - "71221539-1-23" -> "71221539"
 */
export function extractBaseTax(taxStr: string | null | undefined): string {
  if (!taxStr || typeof taxStr !== 'string') return '';
  const trimmed = taxStr.trim();
  if (trimmed.startsWith('FOREIGN:')) return '';
  
  // Országkód prefix levágása (pl. HU, AT, DE)
  const cleaned = trimmed.replace(/^[A-Z]{2}/i, '');
  const match = cleaned.match(/(\d{7,8})/);
  return match ? match[1] : '';
}

// Jogi formák listája (ékezetmentesített kisbetűk, hossz szerint csökkenő sorrendben)
const LEGAL_SUFFIXES = [
  'korlatolt felelossegu tarsasag',
  'zartkoruen mukodo reszvenytarsasag',
  'nyilvanosan mukodo reszvenytarsasag',
  'kozhasznu nonprofit kft',
  'nonprofit kft',
  'egyeni vallalkozo',
  'beteti tarsasag',
  'kozkereseti tarsasag',
  'sportegyesulet',
  'egyesulet',
  'alapitvany',
  'nyrt',
  'kft',
  'zrt',
  'kkt',
  'e v',
  'ev',
  'bt',
  'rt',
  'gmbh', 'llc', 'ltd', 'inc',
  'tse', 'khe',
];

// Megengedett általános szavak (ékezetmentesített kisbetűk)
const GENERIC_WORDS = new Set([
  'hungary', 'magyarorszag', 'group', 'europe', 'trading', 'kereskedelmi',
  'szolgaltato', 'szolgaltatas', 'szolg', 'ker', 'es', 'and', 'co', 'centrum', 'holding',
  'invest', 'solutions', 'kreativ', 'studio', 'partner', 'partners',
  'depo', 'team', 'express', 'logistik', 'logisztika', 'trans', 'spedition',
  'iroda', 'ugyved', 'dr', 'doktor',
]);

/**
 * Szöveg ékezetmentesítése és tisztítása.
 */
function stripAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Cégnév normalizálása: kisbetűsítés, ékezetmentesítés, jogi formák és írásjelek tisztítása.
 */
export function normalizePartnerName(name: string | null | undefined): string {
  if (!name || typeof name !== 'string') return '';
  let result = stripAccents(name.toLowerCase().trim());

  // Pontozott rövidítések összevonása (pl. e.v. -> ev, k.f.t. -> kft)
  result = result.replace(/\b([a-z])\.([a-z])\.?/gi, '$1$2');

  // Írásjelek és speciális karakterek szóközre cserélése
  result = result.replace(/["'.,\\/#!$%^&*;:{}=\-_`~()]/g, ' ');
  result = result.replace(/\s+/g, ' ').trim();

  // Jogi formák eltávolítása a végéről
  for (const suffix of LEGAL_SUFFIXES) {
    const regex = new RegExp(`\\s*\\b${suffix}\\b\\s*$`, 'i');
    result = result.replace(regex, '');
  }

  result = result.replace(/\s+/g, ' ').trim();
  return result;
}

/**
 * Partnernevek összehasonlítása normalizált egyezés és biztonságos containment alapján.
 */
export function isPartnerNameMatch(nameA: string | null | undefined, nameB: string | null | undefined): boolean {
  const normA = normalizePartnerName(nameA);
  const normB = normalizePartnerName(nameB);

  if (!normA || !normB) return false;
  if (normA === normB) return true;

  // Containment vizsgálat megengedett generikus szavakkal
  if (normA.includes(normB) || normB.includes(normA)) {
    const wordsA = new Set(normA.split(' '));
    const wordsB = new Set(normB.split(' '));
    
    // Szimmetrikus különbség: olyan szavak, amik csak az egyikben vannak meg
    const diff = new Set([...wordsA].filter(x => !wordsB.has(x)));
    for (const w of wordsB) {
      if (!wordsA.has(w)) diff.add(w);
    }

    // Csak akkor fogadjuk el, ha a különbség csupa generikus szóból áll
    let onlyGeneric = true;
    for (const word of diff) {
      if (!GENERIC_WORDS.has(word) && word.length > 2) {
        onlyGeneric = false;
        break;
      }
    }
    if (onlyGeneric) return true;
  }

  return false;
}

/**
 * Bruttó összegek összehasonlítása toleranciával (kerekítés, fillér eltérések).
 */
export function isGrossAmountMatch(
  amountA: number | null | undefined,
  amountB: number | null | undefined,
  currencyA: string | null | undefined = 'HUF',
  currencyB: string | null | undefined = 'HUF'
): boolean {
  if (amountA == null || amountB == null || isNaN(amountA) || isNaN(amountB)) {
    return true; // Ha nincs összeg megadva valamelyiknél, összeg alapján nem utasítjuk el
  }

  const currA = (currencyA || 'HUF').toUpperCase();
  const currB = (currencyB || 'HUF').toUpperCase();

  // Eltérő deviza esetén (pl. HUF vs EUR) az összeg NEM tekinthető egyezőnek!
  if (currA !== currB) {
    return false;
  }

  const diff = Math.abs(amountA - amountB);
  // 5 Ft abszolút vagy 0.5% relatív tolerancia
  const maxAllowedDiff = Math.max(5, Math.abs(amountA) * 0.005);
  return diff <= maxAllowedDiff;
}

/**
 * Ellenőrzi, hogy egy feltöltött számla külföldi bizonylat-e.
 * A külföldi számlák (pl. Mailgun, AWS, Google) nem szerepelnek a NAV Online Számlában,
 * így velük szemben soha nem szabad NAV javasolt párosítást képezni.
 */
export function isForeignSubmittedInvoice(
  sub: {
    nav_status?: string | null;
    invoice_direction?: string | null;
    elado_vat_id?: string | null;
    vevo_vat_id?: string | null;
    penznem?: string | null;
  }
): boolean {
  // 1. Worker által explicit beállított státusz (külföldi számla esetén 'not_applicable')
  if (sub.nav_status === 'not_applicable') return true;

  // 2. Kimenő számlák magyar cég esetén belföldi kibocsátásúak
  if (sub.invoice_direction === 'OUTBOUND') return false;

  // 3. Eladó adószáma (INBOUND számlánál a partner az eladó)
  const eladoVat = (sub.elado_vat_id || '').trim().toUpperCase();
  if (eladoVat) {
    if (eladoVat.startsWith('HU')) return false;
    const cleanDigits = eladoVat.replace(/\D/g, '');
    if (cleanDigits.length === 8 || cleanDigits.length === 11) return false;
    // Ha kétbetűs nem-HU országgal kezdődik (pl. US, DE, AT, NL, GB, FR, IE) -> Külföldi!
    if (/^[A-Z]{2}/.test(eladoVat)) return true;
  }

  // 4. Pénznem: ha nem HUF és nincs magyar adószáma az eladónak -> Külföldi bizonylat!
  const curr = (sub.penznem || 'HUF').trim().toUpperCase();
  if (curr !== 'HUF') {
    const cleanDigits = eladoVat.replace(/\D/g, '');
    if (!eladoVat.startsWith('HU') && cleanDigits.length !== 8 && cleanDigits.length !== 11) {
      return true;
    }
  }

  return false;
}

/**
 * Fő párosítási döntési függvény: ellenőrzi, hogy egy NAV számla és egy feltöltött számla
 * valóban egymáshoz tartozik-e.
 */
export function isNavAndSubmittedInvoiceMatch(
  navInvoice: NavInvoiceMatchCandidate,
  submittedInvoice: SubmittedInvoiceMatchCandidate
): boolean {
  // 1. Explicit idegen kulcsos összerendelés (ha már van rögzítve)
  if (submittedInvoice.nav_invoice_id && navInvoice.id && submittedInvoice.nav_invoice_id === navInvoice.id) {
    return true;
  }

  // 2. Sorszám ellenőrzés (Primary requirement)
  const navNum = normalizeInvoiceNumber(navInvoice.invoice_number);
  const subNum = normalizeInvoiceNumber(submittedInvoice.bizonylatsorszam);

  if (!navNum || !subNum || navNum !== subNum) {
    return false;
  }

  // 3. Partner adószámok meghatározása irány szerint
  const isOutbound = navInvoice.invoice_direction === 'OUTBOUND' || submittedInvoice.invoice_direction === 'OUTBOUND';
  
  const navPartnerTax = extractBaseTax(isOutbound ? navInvoice.customer_tax_number : navInvoice.supplier_tax_number);
  const subPartnerTax = extractBaseTax(isOutbound ? submittedInvoice.vevo_vat_id : submittedInvoice.elado_vat_id);

  // Kereszt-irányú adószám ellenőrzés (ha az irány tévesen lett volna felcímkézve)
  const navAltTax = extractBaseTax(isOutbound ? navInvoice.supplier_tax_number : navInvoice.customer_tax_number);
  const subAltTax = extractBaseTax(isOutbound ? submittedInvoice.elado_vat_id : submittedInvoice.vevo_vat_id);

  const hasDirectTaxMatch = Boolean(navPartnerTax && subPartnerTax && navPartnerTax === subPartnerTax);
  const hasAltTaxMatch = Boolean(navAltTax && subAltTax && navAltTax === subAltTax);

  if (hasDirectTaxMatch || hasAltTaxMatch) {
    // Ha az adószám biztosan egyezik, a számlák összeillenek
    return true;
  }

  // Ha mindkét fél rendelkezik 8 jegyű adószámmal, de azok teljesen különböznek
  const hasConflictingTaxes = Boolean(navPartnerTax && subPartnerTax && navPartnerTax !== subPartnerTax);

  // 4. Partnernevek vizsgálata
  const navPartnerName = isOutbound ? navInvoice.customer_name : navInvoice.supplier_name;
  const subPartnerName = isOutbound ? submittedInvoice.vevo_nev : submittedInvoice.elado_nev;
  const nameMatches = isPartnerNameMatch(navPartnerName, subPartnerName);

  // 5. Bruttó összegek vizsgálata
  const amountMatches = isGrossAmountMatch(
    navInvoice.invoice_gross_amount,
    submittedInvoice.brutto_vegosszeg,
    navInvoice.currency,
    submittedInvoice.penznem
  );

  // Ha az adószámok ütköznek ÉS sem a név, sem az összeg nem egyezik -> BIZTOSAN NEM UGYANAZ (Reject)
  if (hasConflictingTaxes && (!nameMatches || !amountMatches)) {
    return false;
  }

  // Ha a név ÉS az összeg is egyezik -> Match (pl. magánszemély / adószám nélküli partner)
  if (nameMatches && amountMatches) {
    return true;
  }

  // Ha a név egyezik, de az összeg nem elérhető -> Match
  if (nameMatches && (navInvoice.invoice_gross_amount == null || submittedInvoice.brutto_vegosszeg == null)) {
    return true;
  }

  // Ha az összeg egyezik és a név hiányzik -> Match
  if (amountMatches && (!navPartnerName || !subPartnerName)) {
    return true;
  }

  // Ha az adószámok hiányoznak, és a név teljesen eltér (pl. "Durasnaz Family Group" vs "AD-LAK Holding") -> Reject
  if (navPartnerName && subPartnerName && !nameMatches && !amountMatches) {
    return false;
  }

  // Alapértelmezett: ha nem volt kizáró ok (pl. egyedi sorszám adószám/név nélkül), elfogadjuk
  return !hasConflictingTaxes;
}

export interface SuggestedMatchCandidateResult {
  isMatch: boolean;
  score: number;
  reason: string;
  isSuffixMatch: boolean;
}

export interface ExtendedNavInvoiceMatchCandidate extends NavInvoiceMatchCandidate {
  invoice_issue_date?: string | null;
  invoice_delivery_date?: string | null;
}

export interface ExtendedSubmittedInvoiceMatchCandidate extends SubmittedInvoiceMatchCandidate {
  kibocsatas_datuma?: string | null;
  teljesites_datuma?: string | null;
}

/**
 * Heurisztikus javasolt (fuzzy) párosítási algoritmus:
 * Olyan eseteket keres, ahol a számlaszám nem egyezik pontosan (pl. OCR prefix csonkolás),
 * viszont az eladó adószáma/neve, a bruttó összeg és a dátum alapján nagy valószínűséggel
 * ugyanarról a bizonylatról van szó.
 */
export function evaluateNavAndSubmittedSuggestedMatch(
  navInvoice: ExtendedNavInvoiceMatchCandidate,
  submittedInvoice: ExtendedSubmittedInvoiceMatchCandidate
): SuggestedMatchCandidateResult {
  const result: SuggestedMatchCandidateResult = {
    isMatch: false,
    score: 0,
    reason: '',
    isSuffixMatch: false,
  };

  // 1. Ha már van explicit összerendelés (nav_invoice_id)
  if (submittedInvoice.nav_invoice_id && navInvoice.id && submittedInvoice.nav_invoice_id === navInvoice.id) {
    result.isMatch = true;
    result.score = 100;
    result.reason = 'Explicit összerendelés';
    return result;
  }

  // 2. Külföldi számlák kizárása: a külföldi számlák nincsenek a NAV-ban, tilos NAV javaslatot tenni rájuk!
  if (isForeignSubmittedInvoice(submittedInvoice)) {
    return result;
  }

  // 3. Irány (direction) szigorú ellenőrzése: kimenő és bejövő számla sosem egyezhet
  if (
    navInvoice.invoice_direction &&
    submittedInvoice.invoice_direction &&
    navInvoice.invoice_direction !== submittedInvoice.invoice_direction
  ) {
    return result;
  }

  const isOutbound = navInvoice.invoice_direction === 'OUTBOUND' || submittedInvoice.invoice_direction === 'OUTBOUND';

  // 4. Deviza ellenőrzése: NAV és beküldött bizonylat devizájának egyeznie kell
  const navCurr = (navInvoice.currency || 'HUF').toUpperCase();
  const subCurr = (submittedInvoice.penznem || 'HUF').toUpperCase();
  if (navCurr !== subCurr) {
    return result;
  }

  // 5. Külső partner adószámainak kötelező egyezése (sosem a saját cég adószáma!)
  // INBOUND: külső partner az eladó (supplier / elado)
  // OUTBOUND: külső partner a vevő (customer / vevo)
  const navPartnerTax = extractBaseTax(isOutbound ? navInvoice.customer_tax_number : navInvoice.supplier_tax_number);
  const subPartnerTax = extractBaseTax(isOutbound ? submittedInvoice.vevo_vat_id : submittedInvoice.elado_vat_id);

  if (!navPartnerTax || !subPartnerTax || navPartnerTax !== subPartnerTax) {
    return result;
  }

  // 6. Partnernevek kötelező egyezése
  const navPartnerName = isOutbound ? navInvoice.customer_name : navInvoice.supplier_name;
  const subPartnerName = isOutbound ? submittedInvoice.vevo_nev : submittedInvoice.elado_nev;
  const nameMatches = isPartnerNameMatch(navPartnerName, subPartnerName);

  if (!nameMatches) {
    return result;
  }

  // 7. Bruttó összeg kötelező egyezése
  if (navInvoice.invoice_gross_amount == null || submittedInvoice.brutto_vegosszeg == null) {
    return result;
  }

  const amountMatches = isGrossAmountMatch(
    navInvoice.invoice_gross_amount,
    submittedInvoice.brutto_vegosszeg,
    navInvoice.currency,
    submittedInvoice.penznem
  );

  if (!amountMatches) {
    return result;
  }

  // 8. Kibocsátás dátumának napra pontos egyezése mindkét számlán (YYYY-MM-DD)
  const navIssueDate = (navInvoice.invoice_issue_date || '').trim().slice(0, 10);
  const subIssueDate = (submittedInvoice.kibocsatas_datuma || '').trim().slice(0, 10);

  if (!navIssueDate || !subIssueDate || navIssueDate !== subIssueDate) {
    return result;
  }

  // 9. Sorszám ellenőrzés: csak akkor téves/javasolt match, ha a sorszám nem egyezik pontosan
  const navNum = normalizeInvoiceNumber(navInvoice.invoice_number);
  const subNum = normalizeInvoiceNumber(submittedInvoice.bizonylatsorszam);

  if (!navNum || !subNum || navNum === subNum) {
    return result;
  }

  let suffixMatch = false;
  if (Math.min(navNum.length, subNum.length) >= 3) {
    if (navNum.endsWith(subNum) || subNum.endsWith(navNum)) {
      suffixMatch = true;
      result.isSuffixMatch = true;
    }
  }

  // Minden szigorú feltétel teljesült: Partner adószám, Partner név, Bruttó összeg, Kibocsátási dátum!
  result.isMatch = true;
  result.score = suffixMatch ? 95 : 90;
  result.reason = suffixMatch
    ? 'Partner adószám, Partner név, Bruttó összeg és Kibocsátási dátum egyezés (Sorszám részleges/suffix egyezés)'
    : 'Partner adószám, Partner név, Bruttó összeg és Kibocsátási dátum egyezés (Téves bizonylatsorszám)';

  return result;
}

