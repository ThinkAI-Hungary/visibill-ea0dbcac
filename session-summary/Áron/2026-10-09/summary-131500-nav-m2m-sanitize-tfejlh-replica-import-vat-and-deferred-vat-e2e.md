# Session Summary — 2026-10-09 13:15

```text
feat(vat, invoices, nav, integrations): ÁFA levonásba helyezés halasztása és Kérdéses számlák (Áfa tv. 153/A. §), Import ÁFA könyvelési és bevallási támogatás, 26TFEJLH nyomtatvány replika és PDF generálás, valamint NAV ÜPO M2M API kulcs sanitizáció

- ÁFA levonásba helyezés halasztása és Kérdéses számlák szekció (Áfa tv. 153/A. § és 137. §)
  - Jogszabályi megfelelőség: a költségszámlák könyvelésből való kivételekor a végleges kizárás mellett bevezettük a „Későbbre halasztom a számla elszámolását és az ÁFA levonását” funkciót a 2 éves jogvesztő határidőn belüli későbbi elszámoláshoz
  - Adatbázis sémabővítés és migráció: accounting_exclusion_type ('DEFERRED_VAT' | 'PERMANENT'), deferred_vat_reason, deferred_vat_since, deferred_vat_target_period oszlopok és részleges indexek hozzáadása a nav_invoices, invoices, nav_invoice_items, invoice_items táblákon (20261009140000_add_deferred_vat_deduction_and_questionable_invoices.sql)
  - Tranzakcióbiztos tárolt eljárások (RPC):
    - set_invoice_accounting_exclusion: kizárás vagy halasztás beállítása / feloldása tételes könyvelési audit naplózással (accounting_exclusion_logs)
    - get_questionable_invoices: kérdéses tételek listázása 2 éves countdown határidő-számítással (days_remaining_statutory), PL/pgSQL oszlopnév ütközésének javításával (#variable_conflict use_column a 42702-es hiba elhárítására)
    - include_deferred_invoice_in_period: halasztott számla célzott beemelése a kiválasztott havi bevallásba
  - ÁFA kalkulációs motor frissítése (calculate_hungarian_vat_return): a halasztott számlák automatikus beemelése a célidőszak 64-66. levonható soraiba és a 65M belföldi tételes összesítő lapjaira
  - Műszerfali Kérdéses számlák widget (DeferredInvoicesWidget.tsx): 4 db KPI kártya (db, függőben lévő ÁFA, függőben lévő nettó költség, határidő állapot), kereső, célidőszak választó, csoportos beemelés, és színes törvényi jogvesztő határidő badge (<180 nap piros, 180-365 nap sárga, >365 nap zöld)
  - ÁFA bevallás figyelmeztető banner és modal (DeferredVatPromptBanner.tsx, DeferredVatPromptDialog.tsx): borostyán figyelmeztetés a bevallási felületen nyitott kérdéses számlák esetén, interaktív beemelési dialógussal
  - Bejövő számla kizárási dialógus (ExclusionReasonDialog.tsx): modern rádiókártyás választó törvényi hivatkozásokkal, indoklással és visszaállítási funkcióval

- Import ÁFA Rögzítés és Bevallási Integráció (Áfa tv. 2. § c), 24. §, 74–75. §)
  - Vámhatározatok adatbázis struktúrája: import_customs_declarations tábla (VPID/EORI szám, határozatszám, határozat kelte, teljesítés, devizanem, vámérték, járulékos költségek, egyéb terhek, adóalap, importáfa, vámteher, önadózási jogállás, csatolmányok)
  - Rendszerszintű Import ÁFA kódok: IMPORT_27, IMPORT_18, IMPORT_5, IMPORT_MENTES rögzítése
  - Felhasználói felület: ImportCustomsDeclarationDialog.tsx és VatImportCustomsSection.tsx új vámhatározat rögzítéséhez, adóalap és import ÁFA kalkulációval
  - Bevallási motor integráció: vámhatározatok import ÁFA tételeinek automatikus beszámítása a 65-ös bevallás 70-72. (levonható import áfa) és 18-20. (önadózói fizetendő import áfa) soraiba

- 26TFEJLH Nyomtatvány Replika és PDF Generálás (Turizmusfejlesztési Hozzájárulás)
  - Vizuális nyomtatvány-replika konténer és főlap (Nav26TfejlhReplicaContainer.tsx, Nav26TfejlhSheetFolap.tsx) a hivatalos NAV ÁNYK nyomtatvány hű grafikai megjelenítésével
  - Számítási motor és PDF export (tfejlhPdf.ts): adózó törzsadatok, 4%-os hozzájárulási adóalap, vendéglátás / szálláshely sorok, fizetendő hozzájárulás számítása, nyomtatási stíluslap és PDF exportálási lehetőség
  - Integráció az ÁFA modul fejlécébe és a replika export választóba

- NAV ÜPO M2M API Kulcs Sanitizáció (NavUpoM2mCard.tsx, nav-m2m-proxy/index.ts)
  - Rugalmas kulcsformátum kezelés: a NAV ÜPO felületéről másolt kötőjeles (3 kötőjellel tagolt) API kulcsok elfogadása és automatikus strip-elése a nyers 40 karakteres formátumra a kliensen és a backend proxyban
  - Validációs regex és maszkolt megjelenítés javítása, megakadályozva a formátumhiba miatti autentikációs elakadást

- Minőségbiztosítás, Tesztek és Élő E2E Böngészős Verifikáció
  - Élő böngészős E2E tesztelés a Teszt Kft éles környezetében (Chrome DevTools Protocol / Playwright):
    - Számla elhalasztása: Royal Borház Európa Kft (RBK-2026-2541, 334 000 Ft nettó, 90 180 Ft ÁFA) elhalasztása
    - Műszerfal ellenőrzése: kérdéses számlák widget automatikus megjelenése, adatok, 700 napos badge
    - ÁFA bevallás ellenőrzése: figyelmeztető banner megjelenése, beemelési dialógus megnyitása, beemelés 2026-12 célidőszakra
    - Újraszámolás verifikációja: calculate_hungarian_vat_return lefutása, 65M belföldi tételes sor legenerálása 90 180 Ft ÁFA összeggel
    - Záró állapot: műszerfali widget visszaállása a tiszta zöld 0 db függőben lévő állapotra
    - 9 lépéses képernyőkép-galéria mentve az artifact tárba
  - Oxlint kódminőségi kapu: 0 hiba, 0 figyelmeztetés az érintett komponenseken (17ms)
  - TypeScript típusellenőrzés: npx tsc --noEmit exit code 0
  - Automatizált Vitest tesztcsomag: npx vitest run src/test/vat/ (14 teszt suite, 91/91 sikeres teszt, 100% zöld)
  - Dokumentáció szinkronizáció: 065-deferred-vat-deduction-and-questionable-invoices.md létrehozva és bejegyezve az ADR/BDR indexbe
```
