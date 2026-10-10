# A-244: Külföldi és Devizás Bejövő Számlák Integrálása az ÁFA Bevallásba és Taxology Baseline Igazítás

**Status:** Decided  
**Date:** 2026-10-10  
**Utoljára frissítve:** 2026-10-10  

---

## 🏛️ Context
A magyar ÁFA bevallási rendszerben (2665-ös nyomtatvány) a vállalkozások nemcsak belföldi forintos (HUF) számlákkal rendelkeznek, hanem:
1. **Közösségi (EU-s) termékbeszerzések és szolgáltatás-igénybevételek** (EUR, USD, stb., Áfa tv. fordított adózás / közösségi beszerzés).
2. **Harmadik országbeli import és vámhatározatok** (vámhatósági kivetéssel vagy önadózói levonással).
3. **Külföldi devizás számlák belföldi teljesítéssel** (ahol a számla devizás, de az ÁFA forintban törvényesen meghatározott árfolyamon számolandó).

A korábbi `calculate_vat_return` adatbázis RPC csak a belföldi `nav_invoices` tételeket vette figyelembe, aminek következtében a külföldi partnerektől érkező, vagy manuálisan rögzített devizás bejövő számlák lemaradtak a főlapról és az M-lapról. Ez számszaki eltérést okozott a könyvelői főkönyvi analitika és az automatikusan generált 65-ös bevallás között.

---

## 💡 Decision

### 1. `calculate_vat_return` RPC Bővítése Külföldi Számlákkal
A `20261010224500_include_foreign_inbound_invoices_in_vat_return.sql` migráció kibővítette a központi ÁFA számítási motort:
- **Deviza-forint átszámítás:** A devizás számlák forintösszegeit a tárolt forintosított mezőkből (`invoice_net_amount_huf`, `invoice_vat_amount_huf`), vagy hiányukban a vonatkozó MNB árfolyammal számítja ki.
- **Külföldi adószámok kezelése az M-lapon:** Az EU-s és harmadik országbeli partnerek adószámait a 65M lap megfelelő rovataiba (közösségi adószám, külföldi adóalany jelölés) sorolja be.
- **ÁFA kulcs alapú leképezés:** A külföldi fordított adózású beszerzések (pl. Google, Facebook, AWS számlák) automatikusan megjelennek mind a fizetendő, mind a levonható ÁFA oldalon, semleges egyenleget biztosítva.

### 2. Taxology Kft. Referencia Analitika (Golden Master) Megőrzése
A rendszer a Taxology Kft. 2026. júliusi auditált ÁFA analitikáját tekinti hiteles etalonnak (`tests/fixtures/vat_snapshot_taxology_2026_07.json`):
- **100%-os regresszióvédelem:** A Vitest Taxology regressziós teszt (`vatRegressionTaxology.test.ts`) és az élő adatbázis ellenőrző (`scripts/vat-snapshot-guard.mjs`) garantálja, hogy a külföldi számlák integrálása nem torzítja el a belföldi számlák ÁFA sorait.
- **Élő DEV egyezőség:** A DEV adatbázison (`qhvcdqkqpgpdxogqqvyr`) lefutott `npm run vat:guard` parancs 100%-os egyezést igazolt (1 016 649,77 Ft fizetendő, 659 917,69 Ft levonható, 11 főlap sor, 10 M-lap partner).

---

## ⚡ Consequences

### Pozitív:
- A könyvelőknek nem kell kézzel utólag rögzíteniük a külföldi számlákat az ÁNYK-ban.
- A bevallás főlapja és a főkönyv forintra pontosan egyezik.
- A VAT Guard automatizáció megelőzi a jövőbeli elcsúszásokat.

---

## 🔗 Kapcsolódó
- [A-240: ÁFA Számítási Regresszióvédelmi Kapu](./A-240-vat-regression-taxology-golden-master-and-snapshot-guard-architecture.md)
- [A-242: ÁFA Bevallás Változásvédelem és Kriptográfiai Pillanatkép](./A-242-vat-return-snapshots-and-self-revision-penalty-architecture.md)
- [P-179: ÁFA Bevallás Változásvédelem UX](../../product/decisions/P-179-vat-return-snapshots-and-amendments-workspace-ux.md)
