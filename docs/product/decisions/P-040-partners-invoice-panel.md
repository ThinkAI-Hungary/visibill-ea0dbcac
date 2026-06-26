# P-040 — Partnertörzs: Dual-table számlák + interaktív detail panel

> **Státusz:** ✅ Decided  
> **Dátum:** 2026-06-26  
> **Implementálva:** `PartnersPage.tsx`, `PartnerInvoiceDetailDialog.tsx`

---

## Kontextus

A Partnertörzs jobb oldali paneljén korábban csak NAV Online Számlák (nav_invoices) jelentek meg
statikus listaként. A user nem látott beküldött számlákat, nem tudott kattintani a számlákra,
és a számlaszámok aggregáció sem volt teljes a master listán.

---

## Döntések

### 1. Dual-table számlalekérdezés

A partner számlái mindkét forrásból lekérdezve adószám alapján:
- **NAV:** `nav_invoices` — `supplier_tax_number` / `customer_tax_number` egyezés
- **Beküldött:** `invoices` — `elado_vat_id` / `vevo_vat_id` prefix egyezés (első 8 karakter)

A két lista merge-elve, dátum szerint csökkenő sorrendben jelenik meg.

**Kapcsolat típusa:** loose coupling — nincs `partner_id` idegen kulcs az `invoices`-ban,
az egyeztetés adószám-prefix alapú (`tax_number.replace(/-/g,'').substring(0,8)`).

### 2. Master lista számlaszám aggregáció

A partnerek listájában az „X db" oszlop most mindkét táblából számítja az összes számlát.
A logika kliensoldali (`Promise.all` párhuzamos lekérdezéssel), nincs RPC/migráció.

### 3. Tab-alapú szétválasztás a jobb panelen

A számlákat egy belső tab-sáv választja szét:
- **NAV** tab — `nav_invoices` forrású számlák
- **Beküldött** tab — `invoices` forrású számlák

Minden tabon darabszám badge látható. Aktív tab vizuálisan kiemelve (pill-style switcher).

### 4. Számlakereső

A tabok fölött egy kompakt `h-8` keresőmező szűri az aktív tab számláit számlaszám alapján.
A kereső partner-váltáskor automatikusan törlődik.

### 5. Kattintható számla kártyák → PartnerInvoiceDetailDialog

Minden számla kártya kattintható (`<button>`), ami megnyitja a `PartnerInvoiceDetailDialog`-ot.
A dialógus tartalmazza:
- Fejléc: számlaszám, ellenpartner neve, kiállítás dátuma, fizetési határidő, bruttó összeg, fizetési mód
- Irány badge (Kimenő / Bejövő) + forrás badge (NAV / Beküldött)
- Tételek táblázat: Megnevezés, Mennyiség, Egység, Nettó, ÁFA kulcs, Bruttó, **Főkönyvi szám**

Tételek forrása:
- NAV → `nav_invoice_items` (`nav_invoice_id` join)
- Beküldött → `invoice_items` (`invoice_id` join)

Főkönyvi szám: `gl_classifications` JSONB első elérhető értékének `gl_number` mezője.

### 6. NAV státusz eltávolítása

A cégadatok grid-ből eltávolítva a statikus „NAV státusz: Kapcsolódva" mező — értéke
nem volt valós adatból számítva, félrevezető volt. Helyette a header-ben feltételes
„NAV szinkronizált" badge látható, csak akkor, ha valóban van NAV számla a partnernél.

---

## Elutasított alternatívák

- **RPC/View a számlaszámok aggregáláshoz:** Overhead, kliensoldali számítás elegendő.
- **partner_id idegen kulcs az invoices-ban:** Migráció kell, adószám alapú lazy match elég.
- **All-in-one lista (nincs tab):** Nehezen olvasható ha mindkét forrás vegyesen van.

---

## Kapcsolódó fájlok

- `src/pages/PartnersPage.tsx`
- `src/components/partners/PartnerInvoiceDetailDialog.tsx`
- Táblák: `partners`, `nav_invoices`, `nav_invoice_items`, `invoices`, `invoice_items`
