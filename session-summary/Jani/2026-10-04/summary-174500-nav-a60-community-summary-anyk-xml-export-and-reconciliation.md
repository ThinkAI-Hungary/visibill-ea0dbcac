# Session Summary — 2026-10-04 17:45

```text
feat(vat, a60, anyk): NAV 26A60 v3.0 Közösségi Összesítő Nyilatkozat ÁNYK XML export, vat_return_a60_lines perzisztálás és 65-ös bevallási egyeztetés

- NAV ÁNYK 26A60 v3.0 Közösségi Összesítő Nyilatkozat XML Export Motor (D-1 a, D-4, D-5, D-6)
  - Hivatalos hatósági XML minta mélyelemzése (docs/NAV_26A60_2026_07_Taxology_Kft.xml): AbevJava v.3.50.0 boríték, 8 jegyű adószám törzsszám (0A0001C003A), 06-os belföldi telefonszám formátum (0A0001C010A), 4 al-lapstruktúra (0B termékértékesítés, 0C termékbeszerzés, 0D szolgáltatásnyújtás, 0E szolgáltatás-igénybevétel), lapozás (B001A), 24 partner sor / lap korlát és 25. sori lapösszesítő (0X0001C0025CA)
  - Tiszta függvény alapú generátor megvalósítása (src/lib/vatA60Xml.ts): buildVatA60Xml és generateVatA60Xml böngészős közvetlen letöltéssel
  - Automatikus telefonszám formázás 06-os ÁNYK formátumra (formatA60PhoneNumber), Görögország országkód normalizálás (GR -> EL)
  - 24 partner sor feletti automatikus lapozás kezelése (0X0001..., 0X0002...) laponkénti és rovatösszesítőkkel
  - Technikai OSS EU-előtagos számlák (pl. DigitalOcean EU528002224) kiszűrése (az ÁNYK a nem tagállami országkódot hibaként elutasítja) és felhasználói figyelmeztetés a modálban
  - Éves gyakoriság (E) validáció: az ÁNYK nem engedélyezi az éves A60 benyújtást, ezért a generátor hibát dob, az UI pedig letiltja és magyarázattal látja el
  - D-6 szerinti 0 eFt-os kerekítési sorok kezelése és lapösszesítőbe vonása
  - Átfogó tesztcsomag (src/lib/__tests__/vatA60Xml.test.ts): 8/8 sikeres teszt, köztük a Taxology éles XML minta 1:1 mezőszintű golden tesztje

- Adatbázis Séma & calculate_hungarian_vat_return Számítási Motor (D-1 a, D-2, D-3)
  - Új tábla létrehozása (public.vat_return_a60_lines): partner × kategória szerkezet, base_amount (HUF) és base_amount_rounded (eFt), partner_vat_number ('0' fallback), invoice_count, invoice_details audit JSONB
  - Kényszerek és jogosultságok: ON DELETE CASCADE idegen kulcsok a vat_returns és companies táblákra, uq_vat_return_a60_lines_partner összetett egyedi index (vat_return_id, category, country_code, partner_vat_number), RLS policy (vat_return_a60_lines_access) cégtagság és Accounty jogosultság ellenőrzéssel, anon jogosultság megvonása
  - calculate_hungarian_vat_return motor refaktorálása: számlánkénti snapshot/delta mechanizmus, amely pontosan követi a közösségi sorok (02, 11-16, 18, 91/92) növekményét és automatikusan feltölti a vat_return_a60_lines táblát a 65-ös számítással azonos tranzakcióban (megszüntetve az F-1 árfolyam-eltérést, a teljesítés napi MNB devizaárfolyamot használva)
  - D-2 Közösségi adószám feloldási hierarchia: számlán szereplő adószám -> partners.eu_tax_number -> partners.tax_number (ha EU előtagú) -> KNOWN_EU_VENDORS lista (Google, Anthropic, Zoho, OpenAI, Meta, Hetzner, Adobe, Microsoft, AWS, LinkedIn, Apple) -> '0' fallback
  - Migrációk:
    - 20261004143000_sync_paired_nav_invoice_items_and_vat_breakdown.sql: LATERAL join net_amount és gross_amount javítása
    - 20261004150000_add_vat_return_a60_lines.sql: A60 tábla, index, RLS és számítási motor élesítése
  - Élő DB verifikáció: Taxology Kft. (acc22ca9-e9ff-4f9f-9495-ca7612b2e5e2) 2026/07 időszak újraszámítása után a DE (Digital Charging Solutions, 13 eFt) és IE (Google Cloud EMEA, 31 eFt) sorok pontosan forintra egyeznek a 65-ös bevallás 14. és 18. sorával

- Frontend Állapotkezelés & Felhasználói Felület (D-9, D-10, D-11)
  - Típusdefiníciók bővítése (src/features/vat/types.ts): A60Line és A60ItemCategory interfészek
  - Hook bővítés (src/features/vat/hooks/useVatReturnData.ts): a60Lines lekérdezés a vat_return_a60_lines táblából, calculate.mutate esetén automatikus query cache invalidálás
  - VatXmlExportModal újrahasznosítás (src/features/vat/components/VatXmlExportModal.tsx): formKind: '65' | 'A60' variáns, kontakt-gyorsválasztó, cégadat mentés (representative_name, phone), 26A60 sablon, A60 specifikus figyelmeztetések (OSS szűrés, hiányzó adószám, éves gyakoriság tiltás)
  - VatA60Table felület (src/features/vat/components/VatA60Table.tsx): "ÁNYK A60 Export" gomb, hivatalos 26A60 lapok (0B, 0C, 0D, 0E) strukturált táblázatos összesítője partner adószámmal, darabszámmal és lapösszesen eFt végösszegekkel
  - VatReturnContainer & VatReturnViewTab: A60 export menüpont az Export lenyílóban és dedikált A60 modál integráció

- Minőségbiztosítás, Morfi Implementation Review & Audit Kapuk
  - Morfi Implementation Review mélyaudit (/morfi-implementation-review) sikeresen lefutott
  - Surgical Auto-Fix: VatXmlExportModal.tsx TS2353 prop név elütés (lines vs a60Lines) és vatA60Xml.ts formVersionOverride azonnali helyszíni javítása
  - Mély szemantikus TypeScript ellenőrzés: npx tsc -p tsconfig.app.json --noEmit (0 hiba, code 0)
  - Oxlint kódminőség ellenőrzés: npx oxlint 10 érintett fájlra (0 hiba)
  - Vitest tesztek: 46/46 passed (8 A60 XML teszt, 2 VatA60Table komponens mount teszt, 36 általános ÁFA teszt)
  - PostgreSQL pgTAP tesztek: calculate_vat_return.test.sql (7/7 passed rollback tranzakcióban a távoli DB-n)
  - Production Vite build: npm run build sikeres (18.27s, exit code 0)
  - Kódbázis tudásgráf: graphify update . lefutott (23 535 csomópont, 39 563 él frissítve)
```
