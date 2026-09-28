# P-130: Horvát ePorezna ÁFA Bevallás XML Export (Obrazac PDV-S & Obrazac ZP) UX

**Státusz:** Elfogadva (Decided)  
**Dátum:** 2026-09-28  
**Kategória:** UI / Workflow / Export  
**Kapcsolódó ADR:** [A-170: Horvát ePorezna ÁFA Bevallás XML Export (Obrazac PDV-S & Obrazac ZP)](../../architecture/decisions/A-170-croatian-eporezna-vat-xml-export-pdv-s-and-zp.md), [A-156: Horvát ÁFA Bevallás (Obrazac PDV) és Adókód Architektúra](../../architecture/decisions/A-156-croatian-vat-return-obrazac-pdv-and-tax-codes.md)  
**Kapcsolódó PRD:** [P-116: Horvát ÁFA Bevallás (Obrazac PDV) Replika UX](./P-116-croatian-vat-return-obrazac-pdv-and-codes-ux.md), [P-081: Horvát Lokalizáció és Navigáció UX](./P-081-eaisybill-croatia-localization-and-demo-ux.md), [P-058: Egységes Export & Dokumentumgeneráló Motor UX](./P-058-unified-document-engine-ux.md)  
**Érintett modulok:** [VatPoreznaExportDialog.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/components/VatPoreznaExportDialog.tsx), [VatReturnViewTab.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/vat/components/VatReturnViewTab.tsx), [croatianPoreznaXml.ts](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/lib/croatianPoreznaXml.ts)

---

## 1. Kontextus és Felhasználói Igény

A Visibill horvátországi könyvelési moduljában (`/vat-return`) a cégek a havi/negyedéves ÁFA bevallás (Obrazac PDV) mellett törvényi kötelezettségként kötelesek elektronikus úton benyújtani az Európai Unió tagállamaival folytatott közösségi ügyletek összesítő nyilatkozatait a horvát adóhivatal (**Porezna uprava — ePorezna**) hivatalos portálján:
1. **`Obrazac PDV-S`** (*Prijava za stjecanje dobara i primljene usluge iz drugih država članica Europske unije*):  
   EU-s termékbeszerzések és igénybe vett közösségi szolgáltatások bejelentése tagállami partnerbontásban (`I1` Stjecanje dobara, `I2` Primljene usluge).
2. **`Obrazac ZP`** (*Zbirna prijava za isporuke dobara i usluga u druge države članice Europske unije* - VIES összesítő):  
   EU-s termékértékesítések és nyújtott szolgáltatások bejelentése tagállami partnerbontásban (`I1` Isporuke dobara, `I2` Trostrani posao, `I3` Premještanje dobara, `I4` Obavljene usluge).

Korábban a felületen kizárólag a magyar ÁNYK XML letöltése és egy generikus PDF nyomtatási nézet állt rendelkezésre. A könyvelőknek hiányzott az adóhatóság által megkövetelt hivatalos v1-0 XML sémának megfelelő fájlexport, valamint az adatok benyújtás előtti tételes áttekintésének lehetősége.

---

## 2. Termékdöntés és Felhasználói Felület (UX)

### 2.1 Kontextusfüggő Export Menü (`VatReturnViewTab.tsx`)
A cég joghatósága (`country_code`) alapján az "Export" gomb intelligensen alkalmazkodik:
- **Magyar joghatóságú cégeknél:** A menüben a megszokott *"ÁNYK XML letöltés"* opció jelenik meg a 2665-ös nyomtatványhoz.
- **Horvát joghatóságú cégeknél (`HR`):** A menü automatikusan az **`ePorezna XML export (PDV-S / ZP)`** menüpontot kínálja fel kék Lucide ikonnal, amely megnyitja a dedikált interaktív előnézeti dialógust.

### 2.2 Interaktív Előnézeti és Export Dialógus (`VatPoreznaExportDialog.tsx`)
A könyvelők a fájl letöltése előtt egy 3 füles, átlátható modálban ellenőrizhetik az adatokat:

#### 1. Fül: `Obrazac PDV-S` (EU Beszerzések és Igénybe vett szolgáltatások)
- **KPI Kártyák:**
  - `I1. Stjecanje dobara`: EU-s termékbeszerzések adóalapja euróban.
  - `I2. Primljene usluge`: Igénybe vett közösségi szolgáltatások adóalapja euróban.
  - `Ukupno`: Összesített forgalom.
- **Partnerlista Táblázat:**
  - `#` (sorszám), `Država` (ISO tagállami kód, pl. `HU`, `IE`, `DE`), `PDV-ID` (partner közösségi adószáma), `Naziv partnera` (partner neve), `I1` összeg, `I2` összeg, és érintett számlák darabszáma (`invoice_count`).
- **Preuzmi PDV-S XML gomb:** Egyetlen kattintással generálja és tölti le a hivatalos fájlt (`HR_PDV-S_08.2026.xml`).

#### 2. Fül: `Obrazac ZP` (EU Értékesítések és Nyújtott szolgáltatások)
- **KPI Kártyák:** 5-ös bontás az `I1` (Termék), `I2` (Háromszögügylet), `I3` (Vevői készlet), `I4` (Szolgáltatásnyújtás) és `Ukupno` összegekhez.
- **Partnerlista Táblázat:** Az EU-ba számlázott kimenő partnerek listája az `I1`..`I4` kategóriákba rendezve.
- **Preuzmi ZP XML gomb:** Egyetlen kattintással generálja és tölti le a hivatalos fájlt (`HR_ZP_08.2026.xml`).

#### 3. Fül: `Sastavljač & Ispostava` (Beadó személy & Kirendeltség)
- **Beadó adatai (`ObracunSastavio`):**
  - Keresztnév (`Ime`), Vezetéknév (`Prezime`), Telefonszám (`Telefon`), E-mail cím (`Email`).
- **Adóhivatali kirendeltség kódja (`Ispostava`):**
  - Pl. `3301` (Osijek kirendeltség).
- **Cég székhelyének finomhangolása:**
  - Utca, házszám és település ellenőrzése.
- **Automatikus perzisztencia (`localStorage`):**
  - A könyvelő által kitöltött adatokat a rendszer cégenként megjegyzi (`porezna_preparer_${companyId}`), így azokat a következő hónapokban nem kell újra bepötyögni.

---

## 3. Rendszermegbízhatóság és Hibakezelés

1. **Üres időszakok kezelése:**
   Amennyiben egy adott hónapban nem volt EU-s forgalom, a táblázat helyén diszkrét, informatív üres állapot jelenik meg, és a letöltés gomb inaktívvá válik (`disabled`), megelőzve az üres hibás fájlok beküldését.
2. **Kétnyelvűség (i18n):**
   A dialógus támogatja a magyar és a horvát felületi nyelvet is: horvát nyelven az adóhatóság hivatalos szakkifejezéseit használja (*Stjecanje dobara*, *Isporuke dobara*, *Sastavljač obračuna*, stb.).
3. **Kliensoldali atomi letöltés:**
   A generált XML fájl közvetlenül a böngésző memóriájából töltődik le `text/xml` MIME típussal, szerveroldali ideiglenes fájltárolás nélkül.

---

## 4. Kapcsolódó Dokumentáció
- [A-170: Horvát ePorezna ÁFA Bevallás XML Export ADR](../../architecture/decisions/A-170-croatian-eporezna-vat-xml-export-pdv-s-and-zp.md)
- [P-116: Horvát ÁFA Bevallás (Obrazac PDV) Replika UX](./P-116-croatian-vat-return-obrazac-pdv-and-codes-ux.md)
