# A-037: Jegyzetek Rendszer Architektúra (Notes System Architecture)
**Status:** Decided
**Date:** 2026-07-14

## Context
A felhasználók és könyvelők számára szükségessé vált egy általános feljegyzés-készítő és dokumentum-kommentáló funkció ("Jegyzetek"). A jegyzeteknek támogatniuk kell a személyes feljegyzéseket (privát) és a cégcsoport szintű kollaborációt (közös), valamint a számlákhoz való közvetlen rendelést.

## Decision
Létrehozunk egy dedikált `public.notes` táblát a Supabase adatbázisban a jegyzetek tárolására, ahelyett hogy a meglévő táblákat (pl. `invoices`) egészítenénk ki JSONB oszlopokkal.

**Adatszerkezet:**
- `id` (uuid PRIMARY KEY)
- `company_id` (uuid, cég tenant)
- `user_id` (uuid, létrehozó user)
- `title` (text, jegyzet címe)
- `content` (text, tartalom)
- `is_private` (boolean, privát-e)
- `invoice_id` (uuid, opcionálisan csatolt elsődleges számla visszamenőleges kompatibilitás miatt)
- `invoice_ids` (uuid[], többszörös számla-összekapcsoláshoz)
- `created_at` / `updated_at` (timestamptz)

**Többszörös számla-összekapcsolás (Multi-Invoice Linking):**
- A jegyzetekhez akár több számla is rendelhető egyszerre az `invoice_ids` UUID tömb segítségével.
- A frontend a PostgREST JOIN korlátai miatt egy kliensoldali batch query segítségével, egyetlen kérésben kérdezi le az összes érintett számla adatait (egy `.in('id', allInvoiceIds)` lekérdezéssel), megelőzve az N+1 adatbázis lekérési problémákat.

**Csatolmányok és Mellékletek Architektúra (Note Attachments):**
- **Adattábla:** `public.note_attachments`
  - `id` (uuid PRIMARY KEY)
  - `note_id` (uuid REFERENCES notes(id) ON DELETE CASCADE)
  - `company_id` (uuid REFERENCES companies(id) ON DELETE CASCADE)
  - `file_name` (text, eredeti fájlnév)
  - `file_path` (text, tárolási útvonal a storage bucketben)
  - `file_size` (bigint, fájlméret bájtban)
  - `mime_type` (text, MIME típus)
  - `public_url` (text, közvetlen elérési URL)
  - `created_at` (timestamptz)
- **Supabase Storage Bucket:** `invoice-attachments`
  - Nyilvános olvasás (`public: true`) a gyors PDF/kép beágyazás és előnézet érdekében.
  - Elérési útvonal formátum: `${companyId}/${noteId}/${crypto.randomUUID()}.${ext}` (kiszámíthatatlan UUID védelem).
  - Fájlméret korlát: maximum 20 MB / fájl.
  - Engedélyezett formátumok: `application/pdf`, `image/jpeg`, `image/png`, `image/webp`.
- **Táblázati Melléklet Indikáció (Aggregation & Cross-matching):**
  - A `useInvoiceAttachmentCounts` hook aggregálja az aktív cég csatolmányait, megjelölve a TIG (teljesítésigazolás) állományokat.
  - A táblázati sorokban (`NavInvoiceRow`, `SubmittedInvoiceRow`) a bizonylatszám mellett közvetlen gémkapocs badge jelzi a mellékletek jelenlétét, szinkronban tartva a párosított NAV és beküldött bizonylatokat is.

**Row Level Security (RLS) szabályok:**
- **Select:** A felhasználó láthatja a jegyzetet, ha:
  1. Az saját privát jegyzete (`is_private = true` és `user_id = auth.uid()`).
  2. Közös jegyzet (`is_private = false`), és a felhasználó tagja az adott cégnek (`company_members` táblán alapuló tagsági ellenőrzés).
- **Insert / Update / Delete:** Hasonlóan korlátozva: a privát jegyzeteket csak a létrehozó módosíthatja, a közös jegyzeteket a cégtagok módosíthatják vagy törölhetik.
- **note_attachments RLS:** A csatolmányok RLS-e a `notes` szülő tábla láthatóságához és a `company_members` tagsághoz igazodik (külön SELECT, INSERT, UPDATE, DELETE policy-k).

**Frontend integráció:**
- React Query alapú gyorsítótárazás és valós idejű cache invalidáció (`['notes']`, `['invoice-attachment-counts']`, `['invoice-notes']`).
- Split-Pane (osztott kétpaneles) felület a gyors áttekinthetőségért.
- `NoteAttachmentUploader` és `NoteAttachmentList` komponensek a rugalmas drag-and-drop és azonnali előnézet támogatására.

## Consequences
**Pozitív:**
- Tiszta adatbázis-szeparálás: a jegyzetek és csatolmányok nem terhelik a számlák lekérdezését feleslegesen.
- Dedikált TIG (teljesítésigazolás) és szerződés csatolás a számlákhoz, a könyvelők közvetlenül a számlasorból látják a mellékleteket.
- Biztonságos RLS alapú hozzáférés-szabályozás: nem szivároghatnak ki privát adatok.
- Kényelmes számla-kapcsolat: a számla részletező popupban és a lenyíló sorban azonnal láthatóak és kezelhetőek a kapcsolódó jegyzetek és csatolmányaik.

**Negatív:**
- Külön JOIN-ok szükségesek a profilnév és csatolmányok feloldásához (PostgREST `note_attachments (*)` beágyazással és külön Supabase lekérésekkel optimalizálva a teljesítmény érdekében).
