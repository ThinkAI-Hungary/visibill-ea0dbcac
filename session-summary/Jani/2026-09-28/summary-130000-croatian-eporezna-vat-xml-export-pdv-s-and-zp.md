# Session Summary — 2026-09-28 13:00

**Fejlesztő:** Jani  
**Dátum:** 2026-09-28  
**Téma:** Horvát ePorezna ÁFA bevallás XML export (Obrazac PDV-S & Obrazac ZP) és automatikus ÁFA kódoló motor  

---

## 🚀 Összefoglaló (Conventional Commit)

```text
feat(vat): horvát ePorezna ÁFA bevallás XML export (Obrazac PDV-S & Obrazac ZP)

- Horvát ÁFA kódok automatikus hozzárendelésének kiterjesztése szolgáltatás-kulcsszavakra (assign_croatian_vat_codes RPC és invoice_items trigger)
- get_croatian_eu_vat_statements Postgres RPC implementálása közösségi ügyletek aggregálásához és EUR devizakonverzióhoz
- Hivatalos Porezna uprava v1-0 XML generátor és letöltő motor (croatianPoreznaXml.ts)
- Interaktív előnézeti modál (VatPoreznaExportDialog.tsx) PDV-S, ZP és Sastavljač fülekkel
- Cég-specifikus localStorage perzisztencia a beadó adataihoz
- Export menü kontextusfüggő átváltása horvát cégeknél (VatReturnViewTab.tsx)
- Teljes körű unit tesztek (croatianPoreznaXml.test.ts) és dokumentáció szinkronizáció (A-170, P-130)
```

---

## 🛠️ Részletes Módosítások

### 1. Adatbázis & RPC réteg
- `supabase/migrations/20260928120000_auto_assign_croatian_vat_codes.sql`:
  - `assign_croatian_vat_codes(uuid, boolean)` RPC kibővítése horvát szolgáltatás kulcsszavakra (`uslug`, `poslov`, `najam`, `plać` stb.).
  - `trg_auto_assign_croatian_vat_code` trigger létrehozása az `invoice_items` táblán.
- `supabase/migrations/20260928130000_croatian_eu_vat_statements_rpc.sql`:
  - `get_croatian_eu_vat_statements(uuid, integer, integer, text)` SECURITY DEFINER RPC.
  - EU partnerek aggregálása ISO tagállami kód és PDVID alapján, tételbesorolás (`I1`..`I4`), keresztárfolyamos átváltás EUR-ra.

### 2. Frontend & XML Motor
- `src/lib/croatianPoreznaXml.ts`:
  - Hivatalos ePorezna v1-0 XML generálás (`ObrazacPDVS` és `ObrazacZP`), Dublin Core metaadatokkal.
  - OIB normalizáció és címfelbontás (`parseCroatianAddress`).
  - Kliensoldali fájlletöltés (`downloadPdvSXml`, `downloadZpXml`).
- `src/features/vat/components/VatPoreznaExportDialog.tsx`:
  - 3 füles előnézeti dialógus KPI kártyákkal, partnerlistával és szerkeszthető beadói adatokkal.
- `src/features/vat/components/VatReturnViewTab.tsx`:
  - Horvát cégeknél az ÁNYK menüpont helyett az ePorezna XML export indítása.

### 3. Tesztek & Minőségbiztosítás
- `src/lib/__tests__/croatianPoreznaXml.test.ts`: 4/4 passed unit teszt.
- `src/features/vat/__tests__/`: 20/20 passed ÁFA teszt.
- `npx tsc --noEmit`: 0 hiba.
- Live DB tesztelés: D-INVOICE D.O.O-n fillérre megegyezik a hatósági minta XML fájlokkal.

### 4. Dokumentáció & Architektúra
- `docs/architecture/decisions/A-170-croatian-eporezna-vat-xml-export-pdv-s-and-zp.md`
- `docs/product/decisions/P-130-croatian-eporezna-vat-xml-export-pdv-s-and-zp-ux.md`
- `docs/architecture/decisions/index.md` & `docs/product/decisions/index.md` frissítve.
- `graphify update .` lefutott (22 332 node, 37 073 él).
