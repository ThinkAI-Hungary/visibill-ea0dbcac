# A-070: Multi-Channel Upload Storage Bucket Alignment & Synchronized History Mapping

**Status:** Decided  
**Date:** 2026-08-31  
**Category:** Frontend & Storage Architektúra  
**Related Decisions:** [A-023](./A-023-upload-dedup-protection.md), [A-064](./A-064-multi-channel-upload-engine-modularization.md), [P-013](../../product/decisions/P-013-upload-ux.md)

---

## 1. Context

A frontend multi-channel dokumentumfeltöltési moduljának modularizációjakor a `bank` csatorna konfigurációjában a Supabase Storage bucket neve hibásan `bank-statement-uploads` néven lett definiálva a valós `bank-statements` helyett, valamint a `storageFolder` `'statements'` prefixszel indult, ami ütközött a Supabase Storage RLS szabályával (`Users can upload their own bank statements` -> az első mappa azonosítónak a felhasználó `auth.uid()`-jának kell lennie).

Továbbá az `UploadHistory.tsx` komponensben a tab slug ellenőrzések csak a `'bank-statements'` értéket vizsgálták, míg az útvonal slug a `'bank'` volt, ami miatt az előzmények és a cache invalidálás a tranzakciókra esett vissza.

---

## 2. Decision

1. **Storage Bucket & Folder Szinkronizáció (`src/features/upload/config/channelConfigs.ts`):**
   - A `bank` csatorna `storageBucket` mezőjét pontosítottuk: `'bank-statements'`.
   - A `storageFolder` mezőt `''`-re állítottuk, így a fájl útvonala közvetlenül `${userId}/${timestamp}-${fileName}` lesz, ami 100%-ban megfelel a Storage RLS szabályzatnak.
2. **Egységesített Tab Slug Támogatás (`src/components/UploadHistory.tsx`):**
   - Az `UploadHistory` mostantól mind a `'bank'`, mind a `'bank-statements'` slug-okat teljes jogú bankkivonat csatornaként kezeli (megfelelő tábla lekérdezés, ikon, toast és cache invalidálás).
3. **Feldolgozott Fájlok Modal (`src/components/UploadedFilesModal.tsx`):**
   - Hozzáadtuk a dedikált `bank` konfigurációt (`bank_statement_uploads` tábla és `bank-statements` bucket).

---

## 3. Consequences

### Pozitív:
- A bankkivonatok feltöltése (PDF, CSV, Excel) hibamentesen fut le minden tenant adatbázisban.
- A feltöltési előzmények és a feldolgozott fájlok nézete azonnal és pontosan mutatja a bankkivonatokat.
