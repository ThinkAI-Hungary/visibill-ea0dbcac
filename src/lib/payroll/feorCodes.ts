/**
 * Magyar FEOR-08 (Foglalkozások Egységes Osztályozási Rendszere) Szótár és Segédfüggvények
 * 
 * Támogatja a NAV 08M bevallásokból (0F lap 0520AA) beolvasott 4-jegyű FEOR kódok
 * automatikus munkakör-megnevezéssé alakítását és bérlapi megjelenítését.
 */

export const FEOR_DICTIONARY: Record<string, string> = {
  // 1. Gazdasági, igazgatási, érdekképviseleti vezetők, törvényhozók
  '1121': 'Vállalati vezérigazgató, ügyvezető igazgató',
  '1122': 'Általános igazgató, ügyvezető igazgató',
  '1123': 'Pénzügyi vezető',
  '1138': 'Egyszerűsített foglalkoztatott (EFO alkalmi munka)',
  '1139': 'Filmipari statiszta',
  '1210': 'Gazdasági, költségvetési vezető',
  '1321': 'Szállítási és raktározási tevékenységet folytató egység vezetője',
  '1332': 'Kereskedelmi tevékenységet folytató egység vezetője',
  '1335': 'Szállodai, vendéglátó-ipari tevékenységet folytató egység vezetője',

  // 2. Felsőfokú képzettség önálló alkalmazását igénylő foglalkozások
  '2111': 'Bányamérnök',
  '2121': 'Gépészmérnök',
  '2122': 'Villamosmérnök',
  '2131': 'Rendszerelemző, szoftverfejlesztő',
  '2132': 'Alkalmazásprogramozó',
  '2133': 'Web- és multimédia-fejlesztő',
  '2139': 'Egyéb szoftver- és alkalmazásfejlesztő, elemző',
  '2141': 'Adatbázis-tervező és -üzemeltető',
  '2142': 'Hálózati elemző, rendszergazda',
  '2511': 'Pénzügyi elemző, befektetési tanácsadó',
  '2512': 'Adó- és illetéktanácsadó, -szakértő',
  '2513': 'Könyvvizsgáló, könyvelő, könyvszakértő',
  '2521': 'Szervezetirányítási elemző, szervező',
  '2522': 'Személyzeti és pályaválasztási szakértő',
  '2531': 'Piackutató, reklám- és marketingszakértő',
  '2532': 'PR-szakértő',
  '2611': 'Jogász, jogtanácsos',

  // 3. Egyéb felsőfokú vagy középfokú képzettséget igénylő foglalkozások
  '3111': 'Bányászati technikus',
  '3112': 'Gépésztechnikus',
  '3113': 'Villamosipari technikus',
  '3121': 'Építésztechnikus',
  '3131': 'Informatikai és kommunikációs rendszereket kezelő technikus',
  '3132': 'IT rendszerek felhasználóit támogató technikus',
  '3133': 'Hálózati és informatikai rendszertechnikus',
  '3141': 'IKT műveletirányító',
  '3151': 'Termelésütemező, műszakvezető',
  '3161': 'Munkahelyi egészség- és biztonsági felelős',
  '3611': 'Pénzügyi ügyintéző',
  '3612': 'Statisztikai, biztosítási ügyintéző',
  '3613': 'Tőzsde- és pénzügyi ügynök, bróker',
  '3614': 'Könyvelőasszisztens, számlázó',
  '3615': 'Statisztikai elemző',
  '3621': 'Biztosítási ügynök, biztosításközvetítő',
  '3622': 'Kereskedelmi ügyintéző',
  '3623': 'Értékesítési ügynök, kereskedelmi képviselő',
  '3631': 'Munkaerő-szervezési, munkaügyi ügyintéző',
  '3632': 'Marketing és PR ügyintéző',
  '3641': 'Vámügyintéző',
  '3642': 'Szállítmányozási ügyintéző',

  // 4. Irodai és ügyviteli (adminisztratív) foglalkozások
  '4111': 'Titkár(nő)',
  '4112': 'Általános irodai adminisztrátor',
  '4121': 'Könyvelő (számviteli ügyintéző)',
  '4122': 'Bérszámfejtő',
  '4129': 'Egyéb pénzügyi, számviteli ügyintéző',
  '4131': 'Készlet- és anyagnyilvántartó',
  '4190': 'Egyéb irodai, adminisztratív foglalkozású',

  // 5. Kereskedelmi és szolgáltatási foglalkozások
  '5111': 'Fodrász',
  '5112': 'Kozmetikus',
  '5113': 'Pincér',
  '5114': 'Pultos',
  '5115': 'Szakács',
  '5116': 'Cukrász',
  '5117': 'Gyorséttermi eladó',
  '5121': 'Bolti eladó',
  '5122': 'Pénztáros, jegypénztáros',
  '5221': 'Épületfelügyelő, gondnok',
  '5222': 'Biztonsági őr, vagyonőr',

  // 7. Ipari és építőipari foglalkozások
  '7111': 'Kőműves',
  '7112': 'Festő és mázoló',
  '7113': 'Burkoló',
  '7114': 'Víz-, gáz- és központifűtésszerelő',
  '7115': 'Villany- és épületvillamossági szerelő',
  '7121': 'Ács, állványozó',
  '7122': 'Asztalos',
  '7211': 'Lakatos',
  '7212': 'Hegesztő, lángvágó',
  '7221': 'Géplakatos, szerszámkészítő',
  '7222': 'Gépjármű- és motorkerékpár-karbantartó, -javító',

  // 8. Gépkezelők, összeszerelők, járművezetők
  '8111': 'Bányagépkezelő',
  '8121': 'Ipari gyártógép kezelő',
  '8131': 'Csomagológép-kezelő',
  '8311': 'Tehergépkocsi-vezető, kamionsofőr',
  '8312': 'Autóbuszvezető',
  '8313': 'Személygépkocsi-vezető, taxisofőr',
  '8321': 'Targoncakezelő',
  '8322': 'Földmunkagép-kezelő',

  // 9. Szakképzettséget nem igénylő (egyszerű) foglalkozások
  '9111': 'Háztartási takarító és kisegítő',
  '9112': 'Intézményi takarító és kisegítő',
  '9113': 'Kézi autómosó',
  '9114': 'Járműtakarító',
  '9211': 'Mezőgazdasági idénymunkás, kisegítő',
  '9221': 'Építőipari segédmunkás',
  '9222': 'Rakodómunkás, anyagmozgató',
  '9223': 'Kézi csomagoló',
  '9329': 'Egyéb egyszerű foglalkozású (egyszerűsített foglalkoztatott)',
};

/**
 * FEOR kód alapján megadja a hivatalos munkakör megnevezést.
 */
export function getFeorTitle(code: string | null | undefined): string | null {
  if (!code) return null;
  const clean = code.trim().replace(/\s/g, '');
  return FEOR_DICTIONARY[clean] || null;
}

/**
 * Formázott munkakör címke bérlaphoz és felületekhez.
 * Ha van egyedi jobTitle megadva, azt adja vissza.
 * Ha nincs, a FEOR kód szótári megnevezését adja vissza (vagy fallbackként FEOR: XXXX).
 */
export function formatJobTitleWithFeor(
  jobTitle?: string | null,
  feorCode?: string | null
): string {
  if (jobTitle && jobTitle.trim()) {
    return jobTitle.trim();
  }
  if (feorCode && feorCode.trim()) {
    const cleanFeor = feorCode.trim();
    const dictionaryTitle = getFeorTitle(cleanFeor);
    if (dictionaryTitle) {
      return `${dictionaryTitle} (FEOR ${cleanFeor})`;
    }
    return `FEOR: ${cleanFeor}`;
  }
  return '–';
}
