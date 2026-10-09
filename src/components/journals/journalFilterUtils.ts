export type MatchMode = 'EXACT' | 'STARTS_WITH' | 'CONTAINS';

export interface JournalFilterCriteria {
  // Napló hatókör
  journalScope: 'CURRENT' | 'ALL' | string;

  // Számlatípus / Irány jelölők
  vevoSzamlak: boolean;      // Vevő jellegű tételek (pl. 311 sor, vagy vevő napló)
  szallitoSzamlak: boolean;  // Szállító jellegű tételek (pl. 454 sor, vagy szállító napló)
  bankPenztar: boolean;      // Bank / Pénztár tételek (381/384 vagy bank/pénztár napló)
  vegyesNaplo: boolean;      // Vegyes naplós tételek

  // Státuszok / Rendezési állapotok
  statusKonyvelt: boolean;   // Könyvelt tételek (KONYVELT)
  statusPiszkozat: boolean;  // Piszkozatok (KEZI_PISZKOZAT, JOVAHAGYASRA_VAR, GEPI_JAVASLAT)
  statusSztorno: boolean;    // Sztornózott tételek (SZTORNOZOTT, SZTORNO)

  // RLB specifikus flag-ek
  csakJegyzet: boolean;      // Csak jegyzettel/leírással rendelkező tételek
  csakPfAfa: boolean;        // Csak pénzforgalmi áfát érintő tételek

  // Intervallumos szűrők (Tól - Ig)
  naplosorszamTol: string;
  naplosorszamIg: string;

  keltTol: string;           // document_date (YYYY-MM-DD)
  keltIg: string;

  teljesitesTol: string;     // posting_date (YYYY-MM-DD)
  teljesitesIg: string;

  afaEsedekessegTol: string; // tax_date / esedékesség
  afaEsedekessegIg: string;

  fizetesiHataridoTol: string; // fizetési határidő
  fizetesiHataridoIg: string;

  osszegTol: string;         // bruttó összeg minimum
  osszegIg: string;          // bruttó összeg maximum

  // Keresési mezők egyezési típussal
  fokonyviSzam: string;      // gl_number keresés
  fokonyviSzamMatch: MatchMode;

  munkaszam: string;         // project / cost_center
  munkaszamMatch: MatchMode;

  megjegyzes: string;        // description
  megjegyzesMatch: MatchMode;

  bizonylatszam: string;     // document_id
  bizonylatszamMatch: MatchMode;

  partnerNev: string;        // partner.name
  partnerNevMatch: MatchMode;

  partnerKod: string;        // partner azonosító / adószám / kód

  devizanem: string;         // 'ALL', 'HUF', 'EUR', 'USD' stb.
  fizetesiMod: string;       // 'ALL', 'Átutalás', 'Készpénz', 'Bankkártya' stb.

  evTol: string;             // év tól (pl. 2025)
  evIg: string;              // év ig (pl. 2026)
}

export const DEFAULT_JOURNAL_FILTER_CRITERIA: JournalFilterCriteria = {
  journalScope: 'CURRENT',
  vevoSzamlak: true,
  szallitoSzamlak: true,
  bankPenztar: true,
  vegyesNaplo: true,
  statusKonyvelt: true,
  statusPiszkozat: true,
  statusSztorno: false,
  csakJegyzet: false,
  csakPfAfa: false,
  naplosorszamTol: '',
  naplosorszamIg: '',
  keltTol: '',
  keltIg: '',
  teljesitesTol: '',
  teljesitesIg: '',
  afaEsedekessegTol: '',
  afaEsedekessegIg: '',
  fizetesiHataridoTol: '',
  fizetesiHataridoIg: '',
  osszegTol: '',
  osszegIg: '',
  fokonyviSzam: '',
  fokonyviSzamMatch: 'STARTS_WITH',
  munkaszam: '',
  munkaszamMatch: 'CONTAINS',
  megjegyzes: '',
  megjegyzesMatch: 'CONTAINS',
  bizonylatszam: '',
  bizonylatszamMatch: 'CONTAINS',
  partnerNev: '',
  partnerNevMatch: 'CONTAINS',
  partnerKod: '',
  devizanem: 'ALL',
  fizetesiMod: 'ALL',
  evTol: '',
  evIg: '',
};

export function matchesStringPattern(value: string | null | undefined, query: string, mode: MatchMode): boolean {
  if (!query) return true;
  if (!value) return false;
  const v = value.toLowerCase().trim();
  const q = query.toLowerCase().trim();
  switch (mode) {
    case 'EXACT':
      return v === q;
    case 'STARTS_WITH':
      return v.startsWith(q);
    case 'CONTAINS':
    default:
      return v.includes(q);
  }
}

export function getActiveFilterCount(criteria: JournalFilterCriteria): number {
  let count = 0;

  if (criteria.journalScope !== 'CURRENT') count++;

  // Ha nem mind a négy irány aktív, az szűkítésnek számít
  if (!criteria.vevoSzamlak || !criteria.szallitoSzamlak || !criteria.bankPenztar || !criteria.vegyesNaplo) {
    count++;
  }

  // Státusz szűkítés ha eltér az alapértelmezettől
  if (!criteria.statusKonyvelt || !criteria.statusPiszkozat || criteria.statusSztorno) {
    count++;
  }

  if (criteria.csakJegyzet) count++;
  if (criteria.csakPfAfa) count++;

  if (criteria.naplosorszamTol || criteria.naplosorszamIg) count++;
  if (criteria.keltTol || criteria.keltIg) count++;
  if (criteria.teljesitesTol || criteria.teljesitesIg) count++;
  if (criteria.afaEsedekessegTol || criteria.afaEsedekessegIg) count++;
  if (criteria.fizetesiHataridoTol || criteria.fizetesiHataridoIg) count++;
  if (criteria.osszegTol || criteria.osszegIg) count++;

  if (criteria.fokonyviSzam.trim()) count++;
  if (criteria.munkaszam.trim()) count++;
  if (criteria.megjegyzes.trim()) count++;
  if (criteria.bizonylatszam.trim()) count++;
  if (criteria.partnerNev.trim()) count++;
  if (criteria.partnerKod.trim()) count++;

  if (criteria.devizanem !== 'ALL') count++;
  if (criteria.fizetesiMod !== 'ALL') count++;
  if (criteria.evTol || criteria.evIg) count++;

  return count;
}

export interface ActiveFilterChip {
  id: string;
  label: string;
}

export function getActiveFilterChips(criteria: JournalFilterCriteria, journalNamesById?: Map<string, string>): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];

  if (criteria.journalScope === 'ALL') {
    chips.push({ id: 'journalScope', label: 'Napló: Minden napló' });
  } else if (criteria.journalScope !== 'CURRENT') {
    const jName = journalNamesById?.get(criteria.journalScope) || criteria.journalScope;
    chips.push({ id: 'journalScope', label: `Napló: ${jName}` });
  }

  if (!criteria.vevoSzamlak || !criteria.szallitoSzamlak || !criteria.bankPenztar || !criteria.vegyesNaplo) {
    const types: string[] = [];
    if (criteria.vevoSzamlak) types.push('Vevő');
    if (criteria.szallitoSzamlak) types.push('Szállító');
    if (criteria.bankPenztar) types.push('Bank/Pénztár');
    if (criteria.vegyesNaplo) types.push('Vegyes');
    chips.push({ id: 'directions', label: `Típus: ${types.join(', ')}` });
  }

  if (criteria.statusSztorno && !criteria.statusKonyvelt && !criteria.statusPiszkozat) {
    chips.push({ id: 'status', label: 'Státusz: Csak sztornó' });
  } else if (!criteria.statusPiszkozat && criteria.statusKonyvelt) {
    chips.push({ id: 'status', label: 'Státusz: Csak könyvelt' });
  } else if (criteria.statusPiszkozat && !criteria.statusKonyvelt) {
    chips.push({ id: 'status', label: 'Státusz: Csak piszkozatok' });
  }

  if (criteria.csakJegyzet) {
    chips.push({ id: 'csakJegyzet', label: 'Csak jegyzettel' });
  }

  if (criteria.csakPfAfa) {
    chips.push({ id: 'csakPfAfa', label: 'Pénzforgalmi ÁFA' });
  }

  if (criteria.naplosorszamTol || criteria.naplosorszamIg) {
    chips.push({
      id: 'naplosorszam',
      label: `Sorszám: ${criteria.naplosorszamTol || '1'} – ${criteria.naplosorszamIg || '∞'}`,
    });
  }

  if (criteria.keltTol || criteria.keltIg) {
    chips.push({
      id: 'kelt',
      label: `Kelt: ${criteria.keltTol || '…'} – ${criteria.keltIg || '…'}`,
    });
  }

  if (criteria.teljesitesTol || criteria.teljesitesIg) {
    chips.push({
      id: 'teljesites',
      label: `Teljesítés: ${criteria.teljesitesTol || '…'} – ${criteria.teljesitesIg || '…'}`,
    });
  }

  if (criteria.fokonyviSzam.trim()) {
    chips.push({
      id: 'fokonyv',
      label: `Főkönyv: ${criteria.fokonyviSzam} (${getMatchModeShortLabel(criteria.fokonyviSzamMatch)})`,
    });
  }

  if (criteria.bizonylatszam.trim()) {
    chips.push({
      id: 'bizonylatszam',
      label: `Bizonylatszám: ${criteria.bizonylatszam}`,
    });
  }

  if (criteria.partnerNev.trim()) {
    chips.push({
      id: 'partnerNev',
      label: `Partner: ${criteria.partnerNev}`,
    });
  }

  if (criteria.megjegyzes.trim()) {
    chips.push({
      id: 'megjegyzes',
      label: `Megjegyzés: ${criteria.megjegyzes}`,
    });
  }

  if (criteria.munkaszam.trim()) {
    chips.push({
      id: 'munkaszam',
      label: `Munkaszám: ${criteria.munkaszam}`,
    });
  }

  if (criteria.devizanem !== 'ALL') {
    chips.push({
      id: 'devizanem',
      label: `Deviza: ${criteria.devizanem}`,
    });
  }

  if (criteria.fizetesiMod !== 'ALL') {
    chips.push({
      id: 'fizetesiMod',
      label: `Fiz. mód: ${criteria.fizetesiMod}`,
    });
  }

  if (criteria.osszegTol || criteria.osszegIg) {
    chips.push({
      id: 'osszeg',
      label: `Összeg: ${criteria.osszegTol || '0'} – ${criteria.osszegIg || '∞'}`,
    });
  }

  return chips;
}

function getMatchModeShortLabel(mode: MatchMode): string {
  switch (mode) {
    case 'EXACT':
      return 'pontos';
    case 'STARTS_WITH':
      return 'eleje';
    case 'CONTAINS':
      return 'tartalmazza';
  }
}

export function filterJournalEntries(
  entries: any[],
  criteria: JournalFilterCriteria,
  search?: string,
  stornoFilter?: 'all' | 'active' | 'storno'
): any[] {
  return entries.filter((e: any) => {
    // 1. Gyors keresőmező (search input a fejlécből)
    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      const matchSearch =
        (e.description && e.description.toLowerCase().includes(q)) ||
        (e.document_id && e.document_id.toLowerCase().includes(q)) ||
        (e.partner?.name && e.partner.name.toLowerCase().includes(q)) ||
        (e.journal_number && `${e.journal?.code}/${e.journal_number}`.toLowerCase().includes(q));
      if (!matchSearch) return false;
    }

    // 2. Gyors sztornó gombok (ha aktív)
    if (stornoFilter === 'active') {
      if (e.status === 'SZTORNOZOTT' || e.entry_type === 'SZTORNO') return false;
    } else if (stornoFilter === 'storno') {
      if (e.status !== 'SZTORNOZOTT' && e.entry_type !== 'SZTORNO') return false;
    }

    // 3. Státusz szűrés a Szűkítés ablak szerint
    const isStorno = e.status === 'SZTORNOZOTT' || e.entry_type === 'SZTORNO';
    const isKonyvelt = e.status === 'KONYVELT' && !isStorno;
    const isPiszkozat = ['KEZI_PISZKOZAT', 'JOVAHAGYASRA_VAR', 'GEPI_JAVASLAT'].includes(e.status);

    // Státusz szűrés: ha csak a könyvelt VAGY csak a piszkozat van kiválasztva
    const hasStatusRestriction = criteria.statusKonyvelt !== criteria.statusPiszkozat;
    if (hasStatusRestriction) {
      if (isKonyvelt && !criteria.statusKonyvelt) return false;
      if (isPiszkozat && !criteria.statusPiszkozat) return false;
    }
    // Ha csak a sztornó van bejelölve egyedül, a nem sztornózottakat ki kell szűrni
    if (criteria.statusSztorno && !criteria.statusKonyvelt && !criteria.statusPiszkozat) {
      if (!isStorno) return false;
    }
    // Sztornózott tétel csak akkor jelenjen meg, ha a statusSztorno be van jelölve
    if (isStorno && !criteria.statusSztorno) return false;

    // 4. Irány / Típus (Vevő, Szállító, Bank/Pénztár, Vegyes)
    const journalCode = (e.journal?.code || '').toUpperCase();
    const journalName = (e.journal?.name || '').toLowerCase();
    const hasGlPrefix = (prefix: string) =>
      e.lines?.some((l: any) => {
        const num = l.gl_account?.gl_number || (l.gl_account_id ? String(l.gl_account_id) : '');
        return num.startsWith(prefix);
      });

    const isVevo =
      journalCode.startsWith('V') ||
      journalName.includes('vevő') ||
      hasGlPrefix('31') ||
      (e.entry_type === 'INVOICE' && e.invoice_direction === 'OUTBOUND') ||
      e.invoice_direction === 'OUTBOUND' ||
      e.direction === 'OUTBOUND';

    const isSzallito =
      journalCode.startsWith('SZ') ||
      journalCode.startsWith('K') ||
      journalName.includes('szállító') ||
      hasGlPrefix('45') ||
      (e.source === 'AUTO_SZAMLA' && !isVevo) ||
      (e.entry_type === 'INVOICE' && e.invoice_direction === 'INBOUND') ||
      e.invoice_direction === 'INBOUND' ||
      e.direction === 'INBOUND';

    const isBankPenztar =
      journalCode.startsWith('B') ||
      journalCode.startsWith('P') ||
      journalName.includes('bank') ||
      journalName.includes('pénztár') ||
      hasGlPrefix('381') ||
      hasGlPrefix('384') ||
      hasGlPrefix('38') ||
      e.source === 'AUTO_BANK' ||
      e.source === 'AUTO_PENZTAR';

    const isVegyes =
      journalCode.startsWith('VE') ||
      journalCode.startsWith('NY') ||
      journalCode.startsWith('Z') ||
      journalCode.startsWith('BÉR') ||
      (!isVevo && !isSzallito && !isBankPenztar);

    // Irány szűkítés: ha valamelyik irány nincs bejelölve, akkor a bejelöltek bármelyikére illeszkednie kell
    const directionFilterActive =
      !criteria.vevoSzamlak || !criteria.szallitoSzamlak || !criteria.bankPenztar || !criteria.vegyesNaplo;

    if (directionFilterActive) {
      let matchesDirection = false;
      if (criteria.vevoSzamlak && isVevo) matchesDirection = true;
      if (criteria.szallitoSzamlak && isSzallito) matchesDirection = true;
      if (criteria.bankPenztar && isBankPenztar) matchesDirection = true;
      if (criteria.vegyesNaplo && isVegyes) matchesDirection = true;

      if (!matchesDirection) return false;
    }

    // 5. Csak jegyzet
    if (criteria.csakJegyzet) {
      const hasNote = (e.description && e.description.trim().length > 0) || (e.justification && e.justification.trim().length > 0);
      if (!hasNote) return false;
    }

    // 6. Csak pénzforgalmi áfa
    if (criteria.csakPfAfa) {
      const hasPf =
        e.lines?.some((l: any) => l.vat_role?.includes('cash') || l.gl_account?.gl_number?.includes('4668')) ||
        e.vat_type === 'CASH_ACCOUNTING';
      if (!hasPf) return false;
    }

    // 7. Naplósorszám tól - ig
    if (criteria.naplosorszamTol) {
      const minNum = Number(criteria.naplosorszamTol);
      if (!isNaN(minNum) && (e.journal_number == null || Number(e.journal_number) < minNum)) {
        return false;
      }
    }
    if (criteria.naplosorszamIg) {
      const maxNum = Number(criteria.naplosorszamIg);
      if (!isNaN(maxNum) && (e.journal_number == null || Number(e.journal_number) > maxNum)) {
        return false;
      }
    }

    // 8. Dátumok
    // Kelt (document_date)
    if (criteria.keltTol && e.document_date && e.document_date < criteria.keltTol) return false;
    if (criteria.keltIg && e.document_date && e.document_date > criteria.keltIg) return false;

    // Teljesítés (posting_date)
    if (criteria.teljesitesTol && e.posting_date && e.posting_date < criteria.teljesitesTol) return false;
    if (criteria.teljesitesIg && e.posting_date && e.posting_date > criteria.teljesitesIg) return false;

    // ÁFA esedékesség (tax_date vagy posting_date)
    const taxDate = e.tax_date || e.document_date || e.posting_date;
    if (criteria.afaEsedekessegTol && taxDate && taxDate < criteria.afaEsedekessegTol) return false;
    if (criteria.afaEsedekessegIg && taxDate && taxDate > criteria.afaEsedekessegIg) return false;

    // Fizetési határidő (due_date)
    const dueDate = e.due_date || e.document_date;
    if (criteria.fizetesiHataridoTol && dueDate && dueDate < criteria.fizetesiHataridoTol) return false;
    if (criteria.fizetesiHataridoIg && dueDate && dueDate > criteria.fizetesiHataridoIg) return false;

    // 9. Év tól - ig
    const year = e.accounting_year || (e.posting_date ? new Date(e.posting_date).getFullYear() : null);
    if (criteria.evTol && year != null) {
      const minYear = Number(criteria.evTol);
      if (!isNaN(minYear) && year < minYear) return false;
    }
    if (criteria.evIg && year != null) {
      const maxYear = Number(criteria.evIg);
      if (!isNaN(maxYear) && year > maxYear) return false;
    }

    // 10. Összeg tól - ig
    const totalAmount = e.lines?.reduce((acc: number, l: any) => (l.dc_type === 'T' ? acc + Number(l.amount || 0) : acc), 0) || 0;
    if (criteria.osszegTol) {
      const minAmt = Number(criteria.osszegTol);
      if (!isNaN(minAmt) && totalAmount < minAmt) return false;
    }
    if (criteria.osszegIg) {
      const maxAmt = Number(criteria.osszegIg);
      if (!isNaN(maxAmt) && totalAmount > maxAmt) return false;
    }

    // 11. Devizanem
    if (criteria.devizanem && criteria.devizanem !== 'ALL') {
      const curr = (e.currency || 'HUF').toUpperCase();
      if (curr !== criteria.devizanem.toUpperCase()) return false;
    }

    // 12. Főkönyvi szám egyezés (Bármelyik sor T vagy K főkönyvi számára)
    if (criteria.fokonyviSzam.trim()) {
      const q = criteria.fokonyviSzam.trim();
      const hasMatch = e.lines?.some((l: any) => {
        const glNum = l.gl_account?.gl_number || (l.gl_account_id ? String(l.gl_account_id) : '');
        return matchesStringPattern(glNum, q, criteria.fokonyviSzamMatch);
      });
      if (!hasMatch) return false;
    }

    // 13. Munkaszám / Projekt
    if (criteria.munkaszam.trim()) {
      const q = criteria.munkaszam.trim();
      const hasMatch = e.lines?.some((l: any) => {
        const projName = l.project?.name || l.cost_center_id || '';
        return matchesStringPattern(projName, q, criteria.munkaszamMatch);
      });
      if (!hasMatch) return false;
    }

    // 14. Bizonylatszám
    if (criteria.bizonylatszam.trim()) {
      if (!matchesStringPattern(e.document_id, criteria.bizonylatszam.trim(), criteria.bizonylatszamMatch)) {
        return false;
      }
    }

    // 15. Partnernév
    if (criteria.partnerNev.trim()) {
      const pName = e.partner?.name || '';
      if (!matchesStringPattern(pName, criteria.partnerNev.trim(), criteria.partnerNevMatch)) {
        return false;
      }
    }

    // 16. Partnerkód / Adószám
    if (criteria.partnerKod.trim()) {
      const pCode = e.partner_id || e.partner?.tax_number || e.partner?.code || '';
      if (!matchesStringPattern(pCode, criteria.partnerKod.trim(), 'CONTAINS')) {
        return false;
      }
    }

    // 17. Megjegyzés
    if (criteria.megjegyzes.trim()) {
      const desc = e.description || '';
      if (!matchesStringPattern(desc, criteria.megjegyzes.trim(), criteria.megjegyzesMatch)) {
        return false;
      }
    }

    return true;
  });
}
