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

**Row Level Security (RLS) szabályok:**
- **Select:** A felhasználó láthatja a jegyzetet, ha:
  1. Az saját privát jegyzete (`is_private = true` és `user_id = auth.uid()`).
  2. Közös jegyzet (`is_private = false`), és a felhasználó tagja az adott cégnek (`company_members` táblán alapuló tagsági ellenőrzés).
- **Insert / Update / Delete:** Hasonlóan korlátozva: a privát jegyzeteket csak a létrehozó módosíthatja, a közös jegyzeteket a cégtagok módosíthatják vagy törölhetik.

**Frontend integráció:**
- React Query alapú gyorsítótárazás és valós idejű cache invalidáció.
- Split-Pane (osztott kétpaneles) felület a gyors áttekinthetőségért.

## Consequences
**Pozitív:**
- Tiszta adatbázis-szeparálás: a jegyzetek nem terhelik a számlák lekérdezését feleslegesen.
- Biztonságos RLS alapú hozzáférés-szabályozás: nem szivároghatnak ki privát adatok.
- Kényelmes számla-kapcsolat: a számla részletező popupban azonnal láthatóak a kapcsolódó jegyzetek.

**Negatív:**
- Külön JOIN-ok szükségesek a profilnév feloldásához (külön Supabase lekéréssel optimalizálva a teljesítmény érdekében).
