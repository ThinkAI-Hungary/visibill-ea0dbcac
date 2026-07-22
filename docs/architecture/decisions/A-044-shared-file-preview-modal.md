# A-044: Shared FilePreviewModal Utility — Egységes Fájl Előnézet

**Status:** Decided
**Date:** 2026-07-22
**Utoljára frissítve:** 2026-07-22

---

## Context

A Visibill/eaisybill alkalmazásban 4+ helyen volt önállóan implementálva fájl preview logika:

1. `ManagementDashboard.tsx` — 4 különböző inline portal/Dialog implementáció
2. `UploadHistory.tsx` — `useState` trio + 100 soros Dialog + inline iframe/img
3. `InvoiceFilesDialog.tsx` — async blob fetch + magic bytes detekció + Dialog
4. `InvoiceImageDialog.tsx` — saját Dialog + iframe/img + error state

Minden implementáció önállóan kezelte:
- A fájltípus detektálását (kiterjesztés vagy magic bytes)
- A loading/error state-et
- A z-index kezelést (portal vs. Dialog-ba ágyazott)
- A PDF/kép/Excel/CSV ágakat

Ez **inkonzisztens UX**-hez, **code duplication**-hoz (~500+ sor ismétlődő kód), és **memory leak kockázathoz** vezetett (blob URL-ek nem mindig kerültek revoke-olásra).

---

## Decision

Bevezettük a `FilePreviewModal` shared utility-t (`src/components/ui/FilePreviewModal.tsx`), amely:

1. **Portal-alapú** overlay (`createPortal` → `document.body`) — nincs z-index konfliktus
2. **Egységes fájltípus detektálás** — kiterjesztés alapján (`name.split('.').pop()`)
3. **Egységes header** — letöltés + új lap gomb minden preview-ban
4. **Hook API** — `useFilePreview()` → `{ previewFile, openPreview, closePreview }`
5. **Kötelező** az alkalmazásban minden file preview esetén

A korábbi implementációk (blob URL fetch, inline Dialog) ki lettek cserélve.

### Kulcsdöntés: `name` prop kiterjesztést tartalmaz

A rendszer a **fájlnévből** olvassa a kiterjesztést, **nem a URL-ből**, mert:
- Supabase Storage URL-ek query param-ot tartalmaznak (`?token=...`)
- A bizonylatsorszámok (pl. `D-THINK-130`) nem tartalmaznak kiterjesztést

**Ezért kötelező:** ha az identifier nem tartalmaz kiterjesztést, az URL-ből kell kinyerni:

```tsx
const cleanUrl = fileUrl.split('?')[0];
const ext = cleanUrl.split('.').pop()?.toLowerCase() || '';
const name = knownExts.includes(ext) ? `${identifier}.${ext}` : identifier;
```

### Kulcsdöntés: blob URL tiltás

A korábbi `InvoiceFilesDialog` implementáció a fájlt letöltötte blob-ként, majd `URL.createObjectURL`-lal konvertálta. Ez:
- **Felesleges latency** (extra HTTP kérés)
- **Memory leak kockázat** (revoke nem garantált)
- **Nem nyitható új lapon** (blob URL session-kötött)

→ A signed/public Supabase URL közvetlenül átadható a `FilePreviewModal`-nak.

---

## Consequences

**Pozitív:**
- ~400 sor duplikált kód eltávolítva
- Egységes UX minden preview esetén (azonos header, animáció, error state)
- Instant preview — nincs blob letöltési várakozás
- Memory safe — nincs blob URL lifecycle probléma
- Könnyű kiterjesztés (új fájltípus egy helyen adható hozzá)

**Negatív:**
- Magic bytes-alapú detektálás (MIME típus detektálás a blob tartalmából) elveszett — most kiterjesztés alapú
  - Kockázat: rosszul elnevezett fájl rossz renderer-be kerül
  - Elfogadott kockázat: a Visibill által feltöltött fájlok mindig helyes kiterjesztéssel rendelkeznek

---

## Implementáló komponensek

| Komponens | Módszer |
|-----------|---------|
| `ManagementDashboard.tsx` | `useFilePreview()` hook |
| `UploadHistory.tsx` | `useFilePreview()` hook |
| `InvoiceFilesDialog.tsx` | `useFilePreview()` hook |
| `InvoiceImageDialog.tsx` | Wrapper — megtartja a `invoice`/`isLoading` props API-t, belül `FilePreviewModal` |

---

## Kapcsolódó

- [Design doc 13: File Preview Pattern](../../design/13-file-preview-pattern.md)
- [Design doc 12: Dialogs & Modals](../../design/12-dialogs-modals.md)
- [A-019: Management Dashboard architektúra](./A-019-management-dashboard.md) — a fő felhasználó komponens
- [A-003: Multi-tenancy RLS](./A-003-multi-tenancy-rls.md) — Supabase Storage URL-ek jogosultság kezelése
