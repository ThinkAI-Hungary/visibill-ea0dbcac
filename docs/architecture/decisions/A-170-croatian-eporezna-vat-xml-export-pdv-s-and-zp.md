# A-170: Horvát ePorezna ÁFA Bevallás XML Export (Obrazac PDV-S & Obrazac ZP)

**Status:** Decided  
**Date:** 2026-09-28  
**Érintett modulok:**  
- `supabase/migrations/20260928130000_croatian_eu_vat_statements_rpc.sql`
- `src/lib/croatianPoreznaXml.ts`
- `src/lib/__tests__/croatianPoreznaXml.test.ts`
- `src/features/vat/components/VatPoreznaExportDialog.tsx`
- `src/features/vat/components/VatReturnViewTab.tsx`
- `src/features/vat/index.ts`

---

## 1. Context

A Visibill horvátországi lokalizációjában (lásd [A-156: Horvát ÁFA Bevallás](./A-156-croatian-vat-return-obrazac-pdv-and-tax-codes.md) és [A-140: Multi-Jurisdiction](./A-140-multi-jurisdiction-and-croatian-chart-of-accounts.md)) a cégek az Obrazac PDV fő bevallás mellett a hatósági előírásoknak megfelelően kötelesek elektronikus úton benyújtani a közösségi ügyletek összesítő nyilatkozatait a horvát adóhivatal (**Porezna uprava — ePorezna**) portálján:
1. **`Obrazac PDV-S`** (*Prijava za stjecanje dobara i primljene usluge iz drugih država članica Europske unije*, v1-0):  
   EU-s termékbeszerzések és igénybe vett közösségi szolgáltatások összesítője partnerenkénti bontásban (`I1` Stjecanje dobara, `I2` Primljene usluge).
2. **`Obrazac ZP`** (*Zbirna prijava za isporuke dobara i usluga u druge države članice Europske unije*, v1-0):  
   EU-s termékértékesítések és nyújtott szolgáltatások VIES összesítője partnerenkénti bontásban (`I1` Isporuke dobara, `I2` Trostrani posao, `I3` Premještanje dobara, `I4` Obavljene usluge).

A korábbi rendszerben nem volt elektronikus XML export a horvát adóhatóság felé, kizárólag PDF nyomtatási nézet állt rendelkezésre.

---

## 2. Decision

### 1. Szerveroldali Atomi Aggregáció (`get_croatian_eu_vat_statements` RPC)
Kliensoldali ciklusok helyett egy dedikált Postgres RPC függvényt hoztunk létre:
- **Multi-tenancy & RLS:** Csak a megadott `company_id` horvát (`HR`) cégének számláit összesíti.
- **Keresztárfolyamos devizakonverzió:** Ha egy számla nem EUR-ban lett kiállítva, a `daily_exchange_rates` alapján naprakészen átváltja EUR-ra.
- **Partner összesítés (PDVID):** Az EU partnereket tagállami ISO kód (`country_code`) és tiszta adószám (`pdv_id`) alapján egyetlen sorba vonja össze, számlaszámlálóval (`invoice_count`).
- **Tételbesorolás:** A tételszintű ÁFA kódok (`HR_UL_EU_DOB_*` vs `HR_UL_EU_USL_*` és `HR_IZL_EU_DOB` vs `HR_IZL_EU_USL`), valamint leírás-kulcsszavak alapján automatikusan megosztja az összegeket az `I1`..`I4` kategóriák között.

### 2. Kliensoldali Hivatalos XML Generátor (`croatianPoreznaXml.ts`)
Kifejlesztettük a hivatalos ePorezna XML formázó modult:
- Szigorúan megfelel az `http://e-porezna.porezna-uprava.hr/sheme/zahtjevi/ObrazacPDVS/v1-0` és `ObrazacZP/v1-0` sémáknak.
- Tartalmazza a Dublin Core metaadatokat (`Metapodaci`, `Naslov`, `Autor`, `Identifikator` UUIDv4, `Uskladjenost`).
- 2 tizedesjegy pontosságú euró formázás (`.toFixed(2)`).
- Intelligens címbontás (`parseCroatianAddress`) közterületre, házszámra és településre.
- OIB normalizáció (11 számjegy, 'HR' prefix leválasztása).

### 3. Interaktív Előnézeti Modál (`VatPoreznaExportDialog.tsx`)
A könyvelők számára kényelmes, átlátható felületet biztosítunk:
- Két külön fül a PDV-S és ZP nyomtatványoknak, KPI kártyákkal és partnerlistával.
- Beadó személy (`ObracunSastavio`: Ime, Prezime, Telefon, Email) és kirendeltség (`Ispostava`, pl. 3301) szerkesztő űrlap.
- Automatikus `localStorage` perzisztálás cégenként, így nem kell minden hónapban újra kitölteni.
- Egy kattintásos közvetlen letöltés mindkét nyomtatványhoz.

### 4. Integráció a Fő ÁFA Nézetbe (`VatReturnViewTab.tsx`)
Horvát cégeknél az "Export" menü alatt az ÁNYK helyett közvetlenül az *ePorezna XML export (PDV-S / ZP)* lehetőség jelenik meg és nyitja meg az interaktív modált.

---

## 3. Consequences

### Pozitív
- A horvát cégek és könyvelőik közvetlenül feltölthetik a letöltött XML fájlokat az ePorezna felületére.
- Fillérre pontos egyezés a valós adóhivatali adatokkal (verifikálva a `D-INVOICE D.O.O` 2026. augusztusi tételeivel).
- A magyar ÁNYK export teljesen független és érintetlen maradt.
- 100%-os típus- és tesztfedettség (vitest tesztekkel ellátva).

### Kockázatok / Jövőbeli Teendők
- Amennyiben a Porezna uprava az Obrazac PDV fő bevallásra is közzétesz hivatalos XML XSD sémát (a jelenlegi PDF mellett), a generátor könnyen kiegészíthető a 3. nyomtatvánnyal.

---

## 4. Kapcsolódó Dokumentáció
- [P-130: Horvát ePorezna ÁFA Bevallás XML Export UX](../../product/decisions/P-130-croatian-eporezna-vat-xml-export-pdv-s-and-zp-ux.md)
- [A-156: Horvát ÁFA Bevallás (Obrazac PDV) és Adókód Architektúra](./A-156-croatian-vat-return-obrazac-pdv-and-tax-codes.md)
- [P-116: Horvát ÁFA Bevallás (Obrazac PDV) Replika UX](../../product/decisions/P-116-croatian-vat-return-obrazac-pdv-and-codes-ux.md)
- [A-140: Multi-Jurisdiction Cégkezelés és Horvát Számlatükör](./A-140-multi-jurisdiction-and-croatian-chart-of-accounts.md)

