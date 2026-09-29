# P-140: Számlázz.hu Saját Kimenő Számlaképek Lehívása és NAV Párosítás

**Dátum:** 2026-09-29  
**Státusz:** ✅ Elfogadva és Implementálva (Decided & Implemented)  
**Érintett képernyők:** eaisyBooks Számlák (`/eaisybooks/client-invoices`), Visibill Számlák (`/invoices`), Főkönyvi kivonat (`/general-ledger`), ÁFA analitika (`/vat`), Számlakép előnézet (`InvoiceImageDialog`)  
**Kapcsolódó döntések:** [P-010](./P-010-invoice-list.md), [P-031](./P-031-accounty-layout.md), [P-049](./P-049-nav-sync-dialog-ux.md), [P-120](./P-120-general-ledger-invoice-document-preview-and-osa-fallback-ux.md)

---

## 1. Felhasználói Igény és Probléma

A Visibill és az eaisyBooks rendszerekben a NAV Online Számla (OSA) integráció révén a cégek minden bejövő és kimenő számlájának strukturált XML adata automatikusan bekerül a rendszerbe (`nav_invoices`). 

Azonban a NAV OSA kizárólag strukturált adatokat szolgáltat, **nem tartalmazza a számla ember által olvasható, hiteles számlaképét (PDF)**. Kimenő (saját kibocsátású) számlák esetén a könyvelőknek és az ügyfeleknek elengedhetetlen látni az eredeti számlaképet (arculat, céges logó, megjegyzések, fizetési határidők, számlatételek vizuális elrendezése).

A hazai kkv-k jelentős része (például a Think AI Kft.) a **Számlázz.hu** rendszerét használja számlázásra. A cél az volt, hogy a rendszer a Számlázz.hu Számla Agent API-ján keresztül egyetlen gombnyomással (vagy akár tételenként azonnal) hívja le az eredeti PDF számlaképeket, mentse el a védett felhőtárhelyre (`invoice-uploads` Supabase Storage bucket), és automatikusan párosítsa a létező NAV számlarekordokkal.

---

## 2. Architektúra és Biztonság

### 2.1. Biztonságos Edge Function (`sync-szamlazz-outbound-invoices`)
- A Számlázz.hu Számla Agent kulcsa kizárólag a szerver oldalon (Supabase Edge Function) kerül feloldásra a `get_szamlazz_agent_key(p_company_id)` tárolt eljáráson keresztül. A kulcs soha nem jut el a kliens böngészőbe.
- Támogatja a felhasználói JWT-t és a belső rendszer-hívásokat is.
- A PDF letöltése a Számlázz.hu `action-szamla_agent_pdf` végpontján keresztül történik HTTP POST form-data küldéssel, UTF-8 kódolású XML igénylőlappal.
- A válaszban kapott base64 kódolású PDF-et a funkció dekódolja és a Supabase Storage `invoice-uploads` bucketbe menti: `${companyId}/szamlazz/${cleanInvNum}.pdf`.

### 2.2. Automatikus Adatbázis Párosítás (Dual-Table Upsert)
Hogy az összes létező komponens (Főkönyv, ÁFA, Számlák, `InvoiceImageDialog`, `ExpandedInvoiceRow`) azonnal és módosítás nélkül megjelenítse a számlaképet:
1. Rekord jön létre az `invoice_uploads` táblában a tárolási útvonallal és metaadatokkal.
2. Rekord jön létre / frissül az `invoices` táblában (`melleklet_url`, `statusz: 'feldolgozott'`, `nav_status: 'verified'`, `is_self_issued: true`).
3. A `nav_invoices` rekord állapota frissül: `submitted = true`.

---

## 3. Felhasználói Felület és UX

### 3.1. Fejléc Szinkronizációs Gomb és Értesítő Jelvény
- Mind az eaisyBooks felületen (`ClientInvoicesPage.tsx`), mind a Visibill Számlák oldalon (`InvoiceHeader.tsx`) megjelenik a **„Számlázz.hu szinkron”** gomb felhő letöltés (`DownloadCloud`) ikonnal.
- Ha a cégnek vannak letöltetlen számlaképei, a gombon kék számláló jelvény (`Badge`) mutatja a hiányzó darabszámot (pl. `86`).

### 3.2. Részletes Kötegelt Letöltő Modális Ablak (`<SzamlazzSyncModal>`)
A gombra kattintva megnyílik a szinkronizációs dialógus:
- **Metrikák:** Összes kimenő számla, már csatolt számlaképek, még hiányzó számlaképek.
- **Valós idejű haladás:** Százalékos progress bar („10 / 86 letöltve (12%)”).
- **Vezérlés:** *Szinkronizálás indítása*, *Megállítás* / *Folytatás* gombok. A kérések 5-10-es csomagokban futnak 250ms késleltetéssel, megvédve a Számlázz.hu API sebességkorlátait (rate limits).
- **Eseménynapló:** Valós idejű log felület a sikeresen letöltött számlaszámokról és az esetleges API hibákról.
- **Hiányzó kulcs figyelmeztetés:** Ha nincs beállítva a céghez Agent kulcs, sárga figyelmeztetés jelenik meg közvetlen navigációs hivatkozással a Beállítások / Integrációk oldalra.

### 3.3. Tételes, Egykattintásos Letöltés a Táblázatból
- A táblázatban (`NavInvoiceRow.tsx` és `ClientInvoicesPage.tsx`) minden olyan kimenő számlánál, amelyhez még nincs számlakép, a fájl ikon helyén egy kék letöltő gomb jelenik meg.
- Egyetlen kattintással lehívható és másodpercek alatt megjeleníthető az adott bizonylat számlaképe anélkül, hogy a teljes köteget le kellene futtatni.
- A letöltést követően a sor azonnal átvált az előnézeti gombra (`FileText`), és a számla az `InvoiceImageDialog`-ban megtekinthető, nyomtatható vagy letölthető.
