/**
 * Balance Sheet (Mérleg / Bilanca stanja) localization utilities.
 */

export interface BsRowLike {
  id?: string;
  bs_structure_id?: string;
  order_num?: number | null;
  row_code?: string | null;
  name?: string | null;
}

const ORDER_NUM_TO_KEY: Record<number, string> = {
  // Grand totals
  9999: 'TOTAL_ASSETS',
  19999: 'TOTAL_LIABILITIES',

  // A. Befektetett eszközök
  100: 'A',
  110: 'A_I',
  111: 'A_I_1',
  112: 'A_I_2',
  113: 'A_I_3',
  114: 'A_I_4',
  115: 'A_I_5',
  116: 'A_I_6',
  117: 'A_I_7',
  120: 'A_II',
  121: 'A_II_1',
  122: 'A_II_2',
  123: 'A_II_3',
  124: 'A_II_4',
  125: 'A_II_5',
  126: 'A_II_6',
  127: 'A_II_7',
  130: 'A_III',
  131: 'A_III_1',
  132: 'A_III_2',
  133: 'A_III_3',
  134: 'A_III_4',
  135: 'A_III_5',
  136: 'A_III_6',
  137: 'A_III_7',

  // B. Forgóeszközök
  200: 'B',
  210: 'B_I',
  211: 'B_I_1',
  212: 'B_I_2',
  213: 'B_I_3',
  214: 'B_I_4',
  215: 'B_I_5',
  216: 'B_I_6',
  220: 'B_II',
  221: 'B_II_1',
  222: 'B_II_2',
  223: 'B_II_3',
  224: 'B_II_4',
  225: 'B_II_5',
  226: 'B_II_6',
  230: 'B_III',
  231: 'B_III_1',
  232: 'B_III_2',
  233: 'B_III_3',
  234: 'B_III_4',
  235: 'B_III_5',
  240: 'B_IV',
  241: 'B_IV_1',
  242: 'B_IV_2',

  // C. Aktív időbeli elhatárolások
  300: 'C',
  301: 'C_1',
  302: 'C_2',
  303: 'C_3',

  // D. Saját tőke
  1100: 'D',
  1110: 'D_I',
  1120: 'D_II',
  1130: 'D_III',
  1140: 'D_IV',
  1150: 'D_V',
  1160: 'D_VI',
  1170: 'D_VII',

  // E. Céltartalékok
  1200: 'E',
  1201: 'E_1',
  1202: 'E_2',
  1203: 'E_3',

  // F. Kötelezettségek
  1300: 'F',
  1310: 'F_I',
  1311: 'F_I_1',
  1312: 'F_I_2',
  1313: 'F_I_3',
  1320: 'F_II',
  1321: 'F_II_1',
  1322: 'F_II_2',
  1323: 'F_II_3',
  1324: 'F_II_4',
  1325: 'F_II_5',
  1326: 'F_II_6',
  1327: 'F_II_7',
  1328: 'F_II_8',
  1330: 'F_III',
  1331: 'F_III_1',
  1332: 'F_III_2',
  1333: 'F_III_3',
  1334: 'F_III_4',
  1335: 'F_III_5',
  1336: 'F_III_6',
  1337: 'F_III_7',
  1338: 'F_III_8',

  // G. Passzív időbeli elhatárolások
  1400: 'G',
  1401: 'G_1',
  1402: 'G_2',
  1403: 'G_3',
};

const ID_SUFFIX_TO_KEY: Record<string, string> = {
  '000000000999': 'TOTAL_ASSETS',
  '000000001999': 'TOTAL_LIABILITIES',
  '000000000100': 'A',
  '000000000110': 'A_I',
  '000000000111': 'A_I_1',
  '000000000112': 'A_I_2',
  '000000000113': 'A_I_3',
  '000000000114': 'A_I_4',
  '000000000115': 'A_I_5',
  '000000000116': 'A_I_6',
  '000000000117': 'A_I_7',
  '000000000120': 'A_II',
  '000000000121': 'A_II_1',
  '000000000122': 'A_II_2',
  '000000000123': 'A_II_3',
  '000000000124': 'A_II_4',
  '000000000125': 'A_II_5',
  '000000000126': 'A_II_6',
  '000000000127': 'A_II_7',
  '000000000130': 'A_III',
  '000000000131': 'A_III_1',
  '000000000132': 'A_III_2',
  '000000000133': 'A_III_3',
  '000000000134': 'A_III_4',
  '000000000135': 'A_III_5',
  '000000000136': 'A_III_6',
  '000000000137': 'A_III_7',
  '000000000200': 'B',
  '000000000210': 'B_I',
  '000000000211': 'B_I_1',
  '000000000212': 'B_I_2',
  '000000000213': 'B_I_3',
  '000000000214': 'B_I_4',
  '000000000215': 'B_I_5',
  '000000000216': 'B_I_6',
  '000000000220': 'B_II',
  '000000000221': 'B_II_1',
  '000000000222': 'B_II_2',
  '000000000223': 'B_II_3',
  '000000000224': 'B_II_4',
  '000000000225': 'B_II_5',
  '000000000226': 'B_II_6',
  '000000000230': 'B_III',
  '000000000231': 'B_III_1',
  '000000000232': 'B_III_2',
  '000000000233': 'B_III_3',
  '000000000234': 'B_III_4',
  '000000000235': 'B_III_5',
  '000000000240': 'B_IV',
  '000000000241': 'B_IV_1',
  '000000000242': 'B_IV_2',
  '000000000300': 'C',
  '000000000301': 'C_1',
  '000000000302': 'C_2',
  '000000000303': 'C_3',
  '000000001100': 'D',
  '000000001110': 'D_I',
  '000000001120': 'D_II',
  '000000001130': 'D_III',
  '000000001140': 'D_IV',
  '000000001150': 'D_V',
  '000000001160': 'D_VI',
  '000000001170': 'D_VII',
  '000000001200': 'E',
  '000000001201': 'E_1',
  '000000001202': 'E_2',
  '000000001203': 'E_3',
  '000000001300': 'F',
  '000000001310': 'F_I',
  '000000001311': 'F_I_1',
  '000000001312': 'F_I_2',
  '000000001313': 'F_I_3',
  '000000001320': 'F_II',
  '000000001321': 'F_II_1',
  '000000001322': 'F_II_2',
  '000000001323': 'F_II_3',
  '000000001324': 'F_II_4',
  '000000001325': 'F_II_5',
  '000000001326': 'F_II_6',
  '000000001327': 'F_II_7',
  '000000001328': 'F_II_8',
  '000000001330': 'F_III',
  '000000001331': 'F_III_1',
  '000000001332': 'F_III_2',
  '000000001333': 'F_III_3',
  '000000001334': 'F_III_4',
  '000000001335': 'F_III_5',
  '000000001336': 'F_III_6',
  '000000001337': 'F_III_7',
  '000000001338': 'F_III_8',
  '000000001400': 'G',
  '000000001401': 'G_1',
  '000000001402': 'G_2',
  '000000001403': 'G_3',
};

const normalizeName = (name: string): string =>
  name.toLowerCase().trim().replace(/\s+/g, ' ');

const HU_NAME_TO_KEY: Record<string, string> = {
  // Grand totals
  [normalizeName('ESZKÖZÖK (AKTÍVÁK) ÖSSZESEN')]: 'TOTAL_ASSETS',
  [normalizeName('FORRÁSOK (PASSZÍVÁK) ÖSSZESEN')]: 'TOTAL_LIABILITIES',

  // Letters
  [normalizeName('Befektetett eszközök')]: 'A',
  [normalizeName('Forgóeszközök')]: 'B',
  [normalizeName('Aktív időbeli elhatárolások')]: 'C',
  [normalizeName('Saját tőke')]: 'D',
  [normalizeName('Céltartalékok')]: 'E',
  [normalizeName('Kötelezettségek')]: 'F',
  [normalizeName('Passzív időbeli elhatárolások')]: 'G',

  // Roman under A
  [normalizeName('IMMATERIÁLIS JAVAK')]: 'A_I',
  [normalizeName('TÁRGYI ESZKÖZÖK')]: 'A_II',
  [normalizeName('BEFEKTETETT PÉNZÜGYI ESZKÖZÖK')]: 'A_III',

  // Arabic under A/I
  [normalizeName('Alapítás-átszervezés aktivált értéke')]: 'A_I_1',
  [normalizeName('Kísérleti fejlesztés aktivált értéke')]: 'A_I_2',
  [normalizeName('Vagyoni értékű jogok')]: 'A_I_3',
  [normalizeName('Szellemi termékek')]: 'A_I_4',
  [normalizeName('Üzleti vagy cégérték')]: 'A_I_5',
  [normalizeName('Immateriális javakra adott előlegek')]: 'A_I_6',
  [normalizeName('Immateriális javak értékhelyesbítése')]: 'A_I_7',

  // Arabic under A/II
  [normalizeName('Ingatlanok és a kapcsolódó vagyoni értékű jogok')]: 'A_II_1',
  [normalizeName('Műszaki berendezések, gépek, járművek')]: 'A_II_2',
  [normalizeName('Egyéb berendezések, felszerelések, járművek')]: 'A_II_3',
  [normalizeName('Tenyészállatok')]: 'A_II_4',
  [normalizeName('Beruházások, felújítások')]: 'A_II_5',
  [normalizeName('Beruházásokra adott előlegek')]: 'A_II_6',
  [normalizeName('Tárgyi eszközök értékhelyesbítése')]: 'A_II_7',

  // Arabic under A/III
  [normalizeName('Tartós részesedés kapcsolt vállalkozásban')]: 'A_III_1',
  [normalizeName('Tartósan adott kölcsön kapcsolt vállalkozásban')]: 'A_III_2',
  [normalizeName('Egyéb tartós részesedés')]: 'A_III_3',
  [normalizeName('Tartósan adott kölcsön egyéb részesedési viszonyban álló vállalkozásban')]: 'A_III_4',
  [normalizeName('Egyéb tartósan adott kölcsön')]: 'A_III_5',
  [normalizeName('Tartós hitelviszonyt megtestesítő értékpapír')]: 'A_III_6',
  [normalizeName('Befektetett pénzügyi eszközök értékhelyesbítése')]: 'A_III_7',

  // Roman under B
  [normalizeName('KÉSZLETEK')]: 'B_I',
  [normalizeName('KÖVETELÉSEK')]: 'B_II',
  [normalizeName('ÉRTÉKPAPÍROK')]: 'B_III',
  [normalizeName('PÉNZESZKÖZÖK')]: 'B_IV',

  // Arabic under B/I
  [normalizeName('Anyagok')]: 'B_I_1',
  [normalizeName('Befejezetlen termelés és félkész termékek')]: 'B_I_2',
  [normalizeName('Növendék-, hízó- és egyéb állatok')]: 'B_I_3',
  [normalizeName('Késztermékek')]: 'B_I_4',
  [normalizeName('Áruk')]: 'B_I_5',
  [normalizeName('Készletekre adott előlegek')]: 'B_I_6',

  // Arabic under B/II
  [normalizeName('Követelések áruszállításból és szolgáltatásból (vevők)')]: 'B_II_1',
  [normalizeName('Követelések kapcsolt vállalkozással szemben')]: 'B_II_2',
  [normalizeName('Követelések egyéb részesedési viszonyban lévő vállalkozással szemben')]: 'B_II_3',
  [normalizeName('Váltókövetelések')]: 'B_II_4',
  [normalizeName('Egyéb követelések')]: 'B_II_5',
  [normalizeName('Követelések értékhelyesbítése')]: 'B_II_6',

  // Arabic under B/III
  [normalizeName('Részesedés kapcsolt vállalkozásban')]: 'B_III_1',
  [normalizeName('Egyéb részesedés')]: 'B_III_2',
  [normalizeName('Saját részvények, saját üzletrészek')]: 'B_III_3',
  [normalizeName('Forgatási célú hitelviszonyt megtestesítő értékpapírok')]: 'B_III_4',
  [normalizeName('Értékpapírok értékhelyesbítése')]: 'B_III_5',

  // Arabic under B/IV
  [normalizeName('Pénztár, csekkek')]: 'B_IV_1',
  [normalizeName('Bankbetétek')]: 'B_IV_2',

  // Arabic under C
  [normalizeName('Bevételek aktív időbeli elhatárolása')]: 'C_1',
  [normalizeName('Költségek, ráfordítások aktív időbeli elhatárolása')]: 'C_2',
  [normalizeName('Halasztott ráfordítások')]: 'C_3',

  // Roman under D
  [normalizeName('JEGYZETT TŐKE')]: 'D_I',
  [normalizeName('JEGYZETT, DE MÉG BE NEM FIZETETT TŐKE (-)')]: 'D_II',
  [normalizeName('TŐKETARTALÉK')]: 'D_III',
  [normalizeName('EREDMÉNYTARTALÉK')]: 'D_IV',
  [normalizeName('LEKÖTÖTT TARTALÉK')]: 'D_V',
  [normalizeName('ÉRTÉKELÉSI TARTALÉK')]: 'D_VI',
  [normalizeName('MÉRLEG SZERINTI EREDMÉNY')]: 'D_VII',

  // Arabic under E
  [normalizeName('Céltartalék a várható kötelezettségekre')]: 'E_1',
  [normalizeName('Céltartalék a jövőbeni költségekre')]: 'E_2',
  [normalizeName('Egyéb céltartalék')]: 'E_3',

  // Roman under F
  [normalizeName('HÁTRASOROLT KÖTELEZETTSÉGEK')]: 'F_I',
  [normalizeName('HOSSZÚ LEJÁRATÚ KÖTELEZETTSÉGEK')]: 'F_II',
  [normalizeName('RÖVID LEJÁRATÚ KÖTELEZETTSÉGEK')]: 'F_III',

  // Arabic under F/I
  [normalizeName('Hátrasorolt kötelezettségek kapcsolt vállalkozással szemben')]: 'F_I_1',
  [normalizeName('Hátrasorolt kötelezettségek egyéb részesedési viszonyban lévő vállalkozással szemben')]: 'F_I_2',
  [normalizeName('Hátrasorolt kötelezettségek egyéb gazdálkodóval szemben')]: 'F_I_3',

  // Arabic under F/II
  [normalizeName('Hosszú lejáratra kapott kölcsönök')]: 'F_II_1',
  [normalizeName('Átváltoztatható kötvények')]: 'F_II_2',
  [normalizeName('Tartozások kötvénykibocsátásból')]: 'F_II_3',
  [normalizeName('Beruházási és fejlesztési hitelek')]: 'F_II_4',
  [normalizeName('Egyéb hosszú lejáratú hitelek')]: 'F_II_5',
  [normalizeName('Tartós kötelezettségek kapcsolt vállalkozással szemben')]: 'F_II_6',
  [normalizeName('Tartós kötelezettségek egyéb részesedési viszonyban lévő vállalkozással szemben')]: 'F_II_7',
  [normalizeName('Egyéb hosszú lejáratú kötelezettségek')]: 'F_II_8',

  // Arabic under F/III
  [normalizeName('Rövid lejáratú kölcsönök')]: 'F_III_1',
  [normalizeName('Rövid lejáratú hitelek')]: 'F_III_2',
  [normalizeName('Vevőktől kapott előlegek')]: 'F_III_3',
  [normalizeName('Kötelezettségek áruszállításból és szolgáltatásból (szállítók)')]: 'F_III_4',
  [normalizeName('Váltótartozások')]: 'F_III_5',
  [normalizeName('Rövid lejáratú kötelezettségek kapcsolt vállalkozással szemben')]: 'F_III_6',
  [normalizeName('Rövid lejáratú kötelezettségek egyéb részesedési viszonyban lévő vállalkozással szemben')]: 'F_III_7',
  [normalizeName('Egyéb rövid lejáratú kötelezettségek')]: 'F_III_8',

  // Arabic under G
  [normalizeName('Bevételek passzív időbeli elhatárolása')]: 'G_1',
  [normalizeName('Költségek, ráfordítások passzív időbeli elhatárolása')]: 'G_2',
  [normalizeName('Halasztott bevételek')]: 'G_3',
};

const LETTER_CODE_TO_KEY: Record<string, string> = {
  'A': 'A',
  'B': 'B',
  'C': 'C',
  'D': 'D',
  'E': 'E',
  'F': 'F',
  'G': 'G',
};

/**
 * Returns the localized name for a statutory Balance Sheet row.
 * Safe against missing/null inputs and falls back to defaultName.
 */
export function getLocalizedBsRowName(
  rowOrName: BsRowLike | string | null | undefined,
  defaultName: string | null | undefined,
  t: (key: any, ...args: any[]) => any
): string {
  if (!rowOrName && !defaultName) return '';

  let resolvedKey: string | undefined;
  const fallback = defaultName || (typeof rowOrName === 'string' ? rowOrName : rowOrName?.name) || '';

  if (typeof rowOrName === 'object' && rowOrName !== null) {
    // 1. Match by order_num
    if (typeof rowOrName.order_num === 'number' && ORDER_NUM_TO_KEY[rowOrName.order_num]) {
      resolvedKey = ORDER_NUM_TO_KEY[rowOrName.order_num];
    }

    // 2. Match by UUID suffix
    if (!resolvedKey) {
      const id = rowOrName.id || rowOrName.bs_structure_id;
      if (id) {
        const suffix = id.replace(/-/g, '').slice(-12);
        if (ID_SUFFIX_TO_KEY[suffix]) {
          resolvedKey = ID_SUFFIX_TO_KEY[suffix];
        }
      }
    }

    // 3. Match by unique letter row_code (e.g. 'A.', 'B.')
    if (!resolvedKey && rowOrName.row_code) {
      const cleanLetter = rowOrName.row_code.replace(/\.$/, '').trim().toUpperCase();
      if (LETTER_CODE_TO_KEY[cleanLetter]) {
        resolvedKey = LETTER_CODE_TO_KEY[cleanLetter];
      }
    }

    // 4. Match by Hungarian name
    if (!resolvedKey && rowOrName.name) {
      resolvedKey = HU_NAME_TO_KEY[normalizeName(rowOrName.name)];
    }
  } else if (typeof rowOrName === 'string') {
    resolvedKey = HU_NAME_TO_KEY[normalizeName(rowOrName)];
  }

  // Also check defaultName if rowOrName was not matched
  if (!resolvedKey && defaultName) {
    resolvedKey = HU_NAME_TO_KEY[normalizeName(defaultName)];
  }

  if (resolvedKey) {
    return t(`accounting:balance_sheet.rows.${resolvedKey}`, {
      defaultValue: fallback
    });
  }

  return fallback;
}
