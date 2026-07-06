# P-043 — Főkönyvi besorolás: NAV ↔ Beküldött dual-table szinkronizáció

**Státusz:** ✅ Decided  
**Dátum:** 2026-06-27  
**Implementálva:** `InvoiceItemsDialog.tsx`

---

## Kontextus

A főkönyvi (GL) besorolás a számlatételek szintjén történik, és két külön táblában él:
- `nav_invoice_items` — NAV-ból szinkronizált számla tételei
- `invoice_items` — Beküldött (feltöltött/emailben érkezett) számla tételei

Amikor egy NAV számla és egy beküldött számla ugyanazt a számlaszámot tartalmazza (a `nav_invoices.invoice_number` ↔ `invoices.bizonylatsorszam` normalizált egyezés alapján), logikailag „párosított" számlákról beszélünk. Elvárás, hogy a párosított számlák tételeinek GL besorolása mindig szinkronban legyen — ha az egyiknél módosítják, a másiknál is frissüljön.

---

## Döntések

### 1. Automatikus twin sync GL módosításkor

A GL besorolás szerkesztésekor (`InvoiceItemsDialog`) a rendszer automatikusan megkeresi a "testvér" tételt a másik táblában, és mindkettőt egyetlen RPC batch hívásban frissíti.

**Matching logika:**
- **NAV → Beküldött:** `nav_invoices.invoice_number` → normalizált keresés `invoices.bizonylatsorszam`-ban → `invoice_items` azonos `line_number`-rel
- **Beküldött → NAV:** `invoices.bizonylatsorszam` → normalizált keresés `nav_invoices.invoice_number`-ban → `nav_invoice_items` azonos `line_number`-rel

**Normalizálás:** Szóközök eltávolítása + case-insensitive összehasonlítás (pl. `"HP / 2026-002072"` ↔ `"HP/2026-002072"`)

### 2. Atomikus batch RPC hívás

A `findTwinItems()` függvény azonosítja a testvér tételt, majd a `handleSaveGlOverride()` mindkét tételt (elsődleges + twin) belecsomagolja egyetlen `override_gl_classifications_batch` RPC hívásba. Ez garantálja:
- **Konzisztencia:** Mindkét oldal azonos GL-t kap, vagy egyiket sem frissíti
- **Audit trail:** Az RPC ugyanúgy naplózza mindkét módosítást

### 3. Felhasználói visszajelzés

Ha a rendszer megtalálja és frissíti a twin tételt, a success toast kiegészül: *„Főkönyvi besorolás frissítve. (párosított számla is frissítve)"*. Ha nincs twin (pl. csak NAV-ban létező számla), a toast változatlan marad.

### 4. Cache invalidáció

A GL módosítás után az `invoiceItems` query-t széles körben (mind a két source-ra) invalidáljuk:
```ts
queryClient.invalidateQueries({ queryKey: ['invoiceItems'] });
```
Ez biztosítja, hogy ha a felhasználó ezután megnyitja a másik forrás tételes nézetét, az már a frissített GL besorolást mutatja.

### 5. Graceful degradation

Ha a twin keresés bármilyen okból sikertelen (hálózati hiba, nincs matching számla, nincs matching `line_number`), a rendszer továbbra is frissíti az elsődleges tételt — csak a szinkronizáció marad el, a fő funkció nem sérül.

---

## Implementáció részletek

| Elem | Leírás |
|------|--------|
| **`findTwinItems()`** | `useCallback` hook, amely az aktuális `source` és `invoiceId` alapján lekérdezi a párosított számla tételeit |
| **`handleSaveGlOverride()`** | A batch payload-ba belecsomagolja a twin tételt is, ha van |
| **RPC** | `override_gl_classifications_batch` — meglévő RPC, ami batch-ben dolgoz |
| **Normalizálás** | `str.replace(/\s+/g, '').toUpperCase()` — ugyanaz, mint az `InvoicesPage.tsx`-ben |

---

## Kapcsolódó döntések

- [P-019](./P-019-gl-suggestion.md) — GL kategorizálás javaslat UX
- [P-042](./P-042-categories-projects-sync.md) — Kategóriák és projektek dual-table szinkronizáció (analóg minta)
- [A-022](../../architecture/decisions/A-022-categories-projects-sync.md) — Architekturális dual-table szinkronizáció

## Kapcsolódó fájlok

- `src/components/InvoiceItemsDialog.tsx` — `findTwinItems()` + `handleSaveGlOverride()`
- Táblák: `nav_invoice_items`, `invoice_items`, `nav_invoices`, `invoices`
- RPC: `override_gl_classifications_batch`
