# A-195: NAV 26A60 v3.0 Közösségi Összesítő Nyilatkozat ÁNYK XML Export & 65-ös Bevallási Rekonciliáció

**Dátum:** 2026-10-04  
**Státusz:** ELFOGADVA / IMPLEMENTÁLVA  
**Érintett modulok:** `supabase/migrations/20261004150000_add_vat_return_a60_lines.sql`, `src/lib/vatA60Xml.ts`, `src/features/vat/components/VatXmlExportModal.tsx`, `src/features/vat/components/VatA60Table.tsx`, `src/features/vat/hooks/useVatReturnData.ts`, `src/features/vat/types.ts`  
**Referencia minta:** `docs/NAV_26A60_2026_07_Taxology_Kft.xml`  

---

## 1. Kontextus & Üzleti Igény

A NAV 2665 ÁFA bevallás után a tagállami ügyletekkel rendelkező vállalkozások törvényi kötelezettsége a **26A60-as Közösségi Összesítő Nyilatkozat** rendszeres benyújtása.
Korábban az A60 analitika kizárólag a kliens memóriájában, heurisztikus alapon futott, és a napi devizaárfolyam lekérdezés miatt elcsúszhatott a 65-ös bevallástól. Szükségessé vált:
1. Egy hatóságilag hiteles, AbevJava-kompatibilis XML export generátor (`26A60` v`3.0`).
2. Az A60 tételek adatbázis-szintű perzisztálása és szigorú egyeztetése a 65-ös bevallás közösségi soraival (02., 11–16., 18., 91–92. sorok).

---

## 2. Döntések (A jóváhagyott D-1 – D-11 döntési mátrix alapján)

1. **Adatbázis-oldali perzisztencia (D-1 a):**
   - Új tábla: `public.vat_return_a60_lines` partner × kategória szintű sorokkal, eFt kerekítéssel (`base_amount_rounded`) és `invoice_details` JSONB audit naplóval.
   - A `calculate_hungarian_vat_return` RPC számlánkénti snapshot/delta mechanizmussal követi a 02, 11-16, 18, 91/92 sorok növekményét, és közvetlenül feltölti a táblát.
   - Így az A60 és a 65-ös bevallás matematikai pontossággal egyezik, a teljesítés napi MNB devizaárfolyamot használva.

2. **Közösségi adószám feloldási hierarchia (D-2):**
   - Számlán szereplő adószám → `partners.eu_tax_number` → `partners.tax_number` (ha EU előtagú) → `KNOWN_EU_VENDORS` katalógus (Google, Anthropic, Zoho, OpenAI, Meta, Hetzner, Adobe, Microsoft, AWS, LinkedIn, Apple) → `'0'` fallback.

3. **ÁNYK 26A60 XML Szerkezet & Formátum (D-4, D-5, D-6, D-7):**
   - AbevJava v.3.50.0 boríték és 8 jegyű adószám törzsszám (`0A0001C003A`).
   - Telefonszám szigorúan `06...` belföldi formátumra tisztítva (`0A0001C010A`).
   - 4 al-lapra bontás: `0B` termékértékesítés (02. sor), `0C` termékbeszerzés (11–16. sorok), `0D` szolgáltatásnyújtás (91–92. sorok), `0E` szolgáltatás-igénybevétel (18. sor).
   - Lapszámozás (`B001A`), 24 partner sor / lap lapozás, és 25. sori lapösszesítő (`0X0001C0025CA`).
   - Éves gyakoriság (`E`) validáció: ÁNYK tiltás miatt az export letiltva.
   - Technikai OSS számlák (`EU...`) kiszűrése figyelmeztetéssel.

4. **UI Kompozíció:**
   - `VatXmlExportModal` újrahasznosítása `formKind: '65' | 'A60'` variánssal.
   - `VatA60Table` felületen a 4 hivatalos lap táblázatos összesítője és letöltés gomb.

---

## 3. Verifikáció & Tesztelés

- Unit tesztek: `src/lib/__tests__/vatA60Xml.test.ts` (8/8 passed, 1:1 egyezés a Taxology éles minta XML-lel).
- Komponens tesztek: `src/features/vat/components/__tests__/VatA60Table.test.tsx` (2/2 passed).
- pgTAP adatbázis tesztek: `calculate_vat_return.test.sql` (7/7 passed rollback tranzakcióban a távoli DB-n).
- Élő DB számítás: Taxology Kft. 2026/07 forintra pontosan generálja a DE 13 eFt és IE 31 eFt sorokat a 14. és 18. sorral egyezően.
- Mély típusellenőrzés: `npx tsc -p tsconfig.app.json --noEmit` (0 hiba).
- Production build: `npm run build` sikeres (18.27s).
