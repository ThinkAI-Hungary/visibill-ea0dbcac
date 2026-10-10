# Decision 069: Könyvvizsgálói Adatszolgáltatási, Zárlati és Integritási Szabályzat (MKVK, ISA 500, ISA 560)

**Status:** Decided  
**Category:** Business Rule / Statutory Audit & Accounting Compliance  
**Date:** 2026-10-10  

---

## Question

Hogyan kell a rendszernek támogatnia a számviteli törvény szerinti éves zárlati folyamatot, az auditorok (MKVK, ISA) felé történő kötelező adatszolgáltatást, valamint a fordulónap utáni események (ISA 560) és az utólagos módosítások (ISA 500) követését?

---

## Decision

A Számviteli törvény (2000. évi C. törvény), a Magyar Könyvvizsgálói Kamara (MKVK) adatexport ajánlása és a nemzetközi könyvvizsgálati szabványok alapján a rendszer az alábbi üzleti folyamatokat és adatszolgáltatási szabályokat rögzíti:

### 1. Strukturált Éves Zárlati Folyamat (9 Lépéses Ellenőrzőlista)
A beszámoló jóváhagyása és letétbe helyezése előtt a vállalkozásnak el kell végeznie a számviteli zárlat kötelező lépéseit:
1. Fizikai leltározás és készletértékelés lezárása (Január 31.)
2. Vevő és szállító analitikák egyeztetése, egyenlegközlők kiküldése (Február 15.)
3. Bankkivonatok és pénztárrovancsok zárlata (Február 10.)
4. Devizás eszközök és források MNB árfolyam-átértékelése (Február 20.)
5. Időbeli elhatárolások (AIE és PIE) könyvelése (Március 15.)
6. Terv szerinti értékcsökkenés (ÉCS) elszámolása (Március 20.)
7. Társasági adó (TAO) / KIVA és HIPA megállapítása (Április 15.)
8. Könyvvizsgálói adatszolgáltatási csomag átadása (Április 30.)
9. Éves beszámoló és Kiegészítő melléklet jóváhagyása, letétbe helyezése (Május 31.)

### 2. Standardizált Könyvvizsgálói Adatszolgáltatás (20-Oszlopos Karton és MKVK Audit XML)
- **20-oszlopos karton:** Minden tétel tartalmazza a könyvelési dátumot, bizonylat keltét, esedékességet, főkönyvi számot, megnevezést, T/K jelölést, forgalmat forintban és devizában, partner adószámát/nevét, költséghelyet, munkaszámot, projektet és rögzítőt.
- **Egyezőség-ellenőrzés:** A karton fejlécében a rendszernek ellenőriznie kell a kettős könyvvitel alapegyezőségét (Tartozik forgalom = Követel forgalom).
- **Hivatalos MKVK XML:** A rendszer támogatja a Magyar Könyvvizsgálói Kamara hivatalos v1.0.23.0 XML sémáját tömörített `.zip` formátumban.

### 3. ISA 560: Mérlegfordulónap Utáni Rendezések (Subsequent Events)
- A december 31-i nyitott vevőkövetelések és szállítói kötelezettségek április 30-ig történt banki jóváírásait és kifizetéseit tételesen ki kell mutatni.
- A rendszernek automatikusan ki kell számolnia a rendezési arányt (%), amely alátámasztja a mérlegben szereplő követelések megtérülését és a kötelezettségek fennállását.

### 4. ISA 500: Adatintegritás és Elavulás-védelem (Staleness Guard)
- A könyvvizsgálónak átadott hivatalos exportokról kriptográfiai SHA-256 ujjlenyomat és adatbázis bejegyzés készül (Pillanatkép).
- Ha a lezárt pillanatkép rögzítése után bárki akár egyetlen könyvelési tételt is módosít, töröl vagy felvisz az adott évben, a rendszer azonnal elavultnak jelöli a csomagot, és figyelmeztető sávval jelzi az audit Working Paper-ök és az élő könyvelés elmozdulását.

---

## Rationale

A könyvvizsgálatok során a legnagyobb kockázatot az jelenti, ha a könyvvizsgáló olyan adathalmazon dolgozik, amely a könyvelés utólagos módosítása miatt már nem fedi a valóságot. Az ISA 500 / ISA 560 megfelelés, a SHA-256 integritásnapló és az automatikus fordulónap utáni rendezések egyeztetése minimalizálja az auditori megállapításokat és biztosítja a hatósági transzparenciát.

---

## Kapcsolódó
- [A-241: Könyvvizsgálói Adatszolgáltatási Architektúra](../../architecture/decisions/A-241-auditor-export-and-subsequent-settlements-architecture.md)
- [P-178: Könyvvizsgálói Export és Adatszolgáltatás UX](../../product/decisions/P-178-auditor-export-and-data-provision.md)
- [043: Könyvelési Naplók és Kettős Könyvvitel](./043-accounting-journals.md)
