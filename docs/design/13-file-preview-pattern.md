# 13 — File Preview Pattern

> **Egységes fájl előnézet minden helyzetben.** Az alkalmazásban bármilyen fájl megjelenítésekor (PDF, kép, Excel, CSV) kötelező a `FilePreviewModal` shared utility-t használni.

---

## A komponens

**Helye:** `src/components/ui/FilePreviewModal.tsx`

**Exportált API:**

| Export | Típus | Leírás |
|--------|-------|--------|
| `FilePreviewModal` | Component | Teljes overlay modal (portal-alapú) |
| `FilePreviewContent` | Component | Csak a tartalom-területet rendereli (modal nélkül) |
| `useFilePreview` | Hook | State kezelés: `{ previewFile, openPreview, closePreview }` |
| `PreviewFile` | Interface | `{ url: string; name: string }` |

---

## Alap használat

```tsx
import { FilePreviewModal, useFilePreview } from '@/components/ui/FilePreviewModal';

function MyComponent() {
  const { previewFile, openPreview, closePreview } = useFilePreview();

  return (
    <>
      <button onClick={() => openPreview({ url: file.url, name: file.name })}>
        Előnézet
      </button>

      <FilePreviewModal previewFile={previewFile} onClose={closePreview} />
    </>
  );
}
```

---

## Fájltípus detektálás

A `FilePreviewContent` a **fájlnév kiterjesztése** alapján választja ki a renderer-t:

| Kiterjesztés | Renderer | Megjegyzés |
|---|---|---|
| `.pdf` | Native `<iframe>` | `#toolbar=1` paraméterrel |
| `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.svg`, `.bmp` | `<img>` | Centered, `object-contain` |
| `.xls`, `.xlsx`, `.xlsm` | `<iframe>` → Office Online | `view.officeapps.live.com` |
| `.csv`, `.tsv` | Inline tábla | Max 100 sor, `;` vagy `,` delimiter |
| egyéb | Fallback | Letöltés gomb |

### ⚠️ Kritikus: a `name` prop kiterjesztést kell tartalmazzon

A URL-ekből érkező fájloknál (pl. Supabase Storage) a neve nem feltétlenül tartalmaz kiterjesztést (pl. bizonylatsorszám: `D-THINK-130`). Ilyen esetben az URL-ből kell kinyerni a kiterjesztést:

```tsx
// ❌ ROSSZ — nincs kiterjesztés, fallback-be esik
openPreview({ url: fileUrl, name: invoice.bizonylatsorszam });

// ✅ HELYES — kiterjesztés az URL-ből
const cleanUrl = fileUrl.split('?')[0];
const ext = cleanUrl.split('.').pop()?.toLowerCase() || '';
const knownExts = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'csv', 'tsv', 'xls', 'xlsx', 'xlsm'];
const name = knownExts.includes(ext) ? `${invoice.bizonylatsorszam}.${ext}` : invoice.bizonylatsorszam;
openPreview({ url: fileUrl, name });
```

> Ez a pattern már implementálva van az `InvoiceImageDialog`-ban (`getDisplayName` helper).

---

## URL követelmények

```
✅ Supabase Storage public URL   — közvetlenül átadható
✅ Supabase signed URL           — közvetlenül átadható (lejáratig)
✅ Bármely nyilvánosan elérhető HTTP URL

❌ blob:// URL                   — TILOS! Lejár a session-nel, nem nyitható új lapon
❌ data: URI                     — TILOS! Nem működik iframe-ben
```

**Ha a fájl csak letöltéssel érhető el** (pl. Supabase private bucket), először generáld a signed URL-t:

```tsx
const { data } = await supabase.storage
  .from('invoices')
  .createSignedUrl(path, 3600); // 1 óra

openPreview({ url: data.signedUrl, name: fileName });
```

---

## Modal viselkedés

- **Portal-alapú** (`createPortal` → `document.body`) — nincs z-index konfliktus semmi szűlővel
- **z-index: 110** — minden Dialog, Sheet és Sidebar felett
- **Háttérkattintás** (backdrop) → bezárás
- **Escape** — jelenleg **nem** implementált keyboard handler; ha szükséges, a hívó komponensnek kell kezelnie
- **Header gombok:** Letöltés (`download`), Megnyitás új lapon (`target="_blank"`), Bezárás (`×`)

---

## Speciális esetek

### Wrapper komponens meglévő API-val (InvoiceImageDialog)

Ha egy komponensnek saját props interface-t kell fenntartania (pl. `invoice` objektum, `isLoading` state), a `FilePreviewModal`-t belülről hívja — a hívóhelyeket nem kell módosítani:

```tsx
// InvoiceImageDialog — megtartja a props interface-t, belül FilePreviewModal-t használ
const InvoiceImageDialog = ({ invoice, open, onClose, isLoading }) => {
  if (!open) return null;
  if (isLoading || !invoice) return <LoadingPortal />;

  const displayUrl = invoice.image_url || invoice.melleklet_url;
  const name = getDisplayName(invoice, displayUrl); // kiterjesztés URL-ből!

  return <FilePreviewModal previewFile={{ url: displayUrl, name }} onClose={onClose} />;
};
```

### Csak a tartalom terület kell (beágyazott nézet)

Ha nem overlay kell, hanem a fájlt egy meglévő container-ben kell megjeleníteni:

```tsx
import { FilePreviewContent } from '@/components/ui/FilePreviewModal';

<div className="h-[500px]">
  <FilePreviewContent previewFile={{ url: fileUrl, name: fileName }} />
</div>
```

---

## Komponensek ahol már bevezetve van

| Komponens | Fájl |
|-----------|------|
| Management Dashboard (ErrorControlPanel, FilesPanel, CompanyPanel) | `src/pages/ManagementDashboard.tsx` |
| Feltöltési előzmények | `src/components/UploadHistory.tsx` |
| Számlafájlok dialog | `src/components/invoices/InvoiceFilesDialog.tsx` |
| Számlakép dialog (wrapper) | `src/components/InvoiceImageDialog.tsx` |

---

## Anti-patternok — TILOS

```tsx
// ❌ TILOS: egyedi Dialog + inline iframe/img
<Dialog open={open}>
  <DialogContent>
    <iframe src={url} />
  </DialogContent>
</Dialog>

// ❌ TILOS: blob URL generálás csak previewhoz
const blob = await fetch(url).then(r => r.blob());
const blobUrl = URL.createObjectURL(blob);
setPreviewUrl(blobUrl); // felesleges letöltés + memory leak kockázat

// ❌ TILOS: createPortal + inline JSX preview implementáció egyedi komponensben
{previewFile && createPortal(
  <div className="fixed inset-0 ...">
    {/* 60+ sor inline kód */}
  </div>,
  document.body
)}
```

---

---

## Feltöltési Dropzone & Batch Fájlkezelési Patternek

### 1. Drag & Drop Zóna Állapotai (`src/pages/UploadInvoices.tsx`)

| Állapot | Vizuális Stílus | Jelzés |
|---|---|---|
| **Alap (Idle)** | `border-dashed border-2 border-border/80 bg-muted/20 hover:border-primary/50 hover:bg-muted/40 rounded-xl p-8` | Kattints vagy húzd ide a fájlokat |
| **Aktív húzás (Drag-over)** | `border-primary bg-primary/10 ring-4 ring-primary/10 scale-[1.01]` | Engedd el a fájlokat a feltöltéshez |
| **Érvénytelen fájl (Reject)** | `border-destructive bg-destructive/10 ring-4 ring-destructive/10` | Nem támogatott fájlformátum vagy méretkorlát túllépés |

### 2. Többfájlos Feltöltési Várólista (Multi-File Queue)

- **Fájltípus Ikonok:** PDF = Piros (`FileText` text-red-500), Kép = Kék (`Image` text-blue-500), Excel/CSV = Zöld (`Table` text-emerald-500).
- **Folyamatjelző:** Minden feltöltés alatt álló sorhoz `h-1.5 rounded-full bg-primary` animált csík és KB/MB méretjelző tartozik.
- **Állapotjelzők:** Feltöltés alatt (`animate-spin`), OCR feldolgozás alatt (`animate-pulse`), Kész (`CheckCircle2` text-success), Hiba (`AlertCircle` text-destructive).

### 3. Csatolt Fájlok Batch Menedzser (`InvoiceFilesDialog.tsx`, `UploadedFilesModal.tsx`)

- **A / B Nézetváltó:** Gombbal váltható a kompakt táblázatos lista és a vizuális képrács (thumbnail gallery).
- **Tömeges Műveletek:** Összes kijelölése checkbox, tömeges ZIP letöltés és megerősítéshez kötött tömeges törlés.

---

## Kapcsolódó

- [ADR A-044: Shared FilePreviewModal utility](../architecture/decisions/A-044-shared-file-preview-modal.md)
- [12 — Dialogs & Modals](./12-dialogs-modals.md)
- [FilePreviewModal forrás](../../src/components/ui/FilePreviewModal.tsx)
