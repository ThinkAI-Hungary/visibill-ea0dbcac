# A-120: Csoportos ÁFA-alanyok Észlelése, Technikai Felhasználó Útmutatás és Szinkronizációs Védőháló

**Status:** Decided  
**Date:** 2026-09-16  
**Category:** Architecture / NAV Integration / Multi-Tenancy / Validation / UI  
**Érintett komponensek:** `src/lib/validationUtils.ts`, `NavCredentialsForm.tsx`, `EmptyStateDashboard.tsx`, `src/data/knowledgeBaseFallback.ts`, `knowledge_base_articles`  
**Kapcsolódó döntések:** [A-010: Credential Titkosítás](./A-010-credential-encryption.md), [A-096: Hivatalos NAV Tételsor Védőháló](./A-096-authoritative-nav-line-items-crosscheck-and-sync-guard.md), [P-088: Csoportos ÁFA NAV UI](../product/decisions/P-088-group-vat-nav-credentials-detection-and-sync-ux.md), [BRD 056: Csoportos ÁFA Szabályzat](../../business/decisions/056-group-vat-entity-sync-policy.md)

---

## Context

Egy csoportos ÁFA-alany tagvállalat (pl. holding tag, leányvállalat — konkrét eset: Kuik Imre / AdóCsillapító Kft., adószám: `23108594-4-15`) NAV Online Számla kapcsolatának beállítását követően az óránkénti automatikus szinkronizáció és a manuális lekérdezés lefutott hibajelzés nélkül, azonban mindössze **2 db bejövő számla** érkezett meg a rendszerbe, és **0 db kimenő számla**, holott a cég valós havi forgalma több tucat bizonylatot tett ki.

### A probléma jogszabályi és technikai oka:
1. **Adószám struktúra (Áfa tv. 8. §):**
   - **Tagi adószám:** A cégjegyzékbe bejegyzett önálló társasági adószám, ahol a 9. karakter (ÁFA-kód) **`4`** (pl. `23108594-4-15`). Ez az adószám szolgál a társasági adó (TAO), a helyi iparűzési adó (HIPA) és a foglalkoztatási járulékok (NAV 08) bevallására.
   - **Csoportazonosító szám (csoportos adószám):** A NAV által képzett csoportos ÁFA-alanyi azonosító, ahol a 9. karakter **`5`** (pl. `17799999-5-42`). A magyar Áfa törvény 8. §-a kimondja, hogy a csoportos adóalanyiság időszaka alatt az általános forgalmi adó alanya **maga a Csoport**, a tagok pedig önállóan nem minősülnek ÁFA-alanynak.
2. **NAV Online Számla 3.0 REST API működése:**
   - A gazdasági partnerek a számlákat a Csoport azonosító számára (5-ös kód) kötelesek kiállítani, így a NAV rendszerében vevőként vagy kibocsátóként a Csoport szerepel.
   - Ha a felhasználó a technikai felhasználót a saját tagvállalatának egyéni adószáma (4-es kód) alatt hozza létre az `onlineszamla.nav.gov.hu` felületen, a NAV API lekérdezések (`/queryInvoiceData`, `/queryInvoiceDigest`) **kizárólag azokat a számlákat szolgáltatják**, amelyeken a számlakiállító tévedésből a tag egyéni adószámát szerepeltette vevőként.
   - Az összes szabályosan, a csoportazonosítóra kiállított bejövő és kimenő számla **láthatatlan marad** az egyéni technikai felhasználó számára.

---

## Decision

### 1. Kliensoldali Csoportos ÁFA Validációs Segédfüggvények (`validationUtils.ts`)
Létrehoztunk két dedikált, tiszta ellenőrző függvényt a magyar adószámok 9. karaktere (ÁFA-kód) alapján történő gyors és determinisztikus detektálására:
- `isGroupVatMember(taxNumber: string | null | undefined): boolean`
  - Igazat ad vissza, ha az adószám érvényes 8 vagy 11 jegyű magyar adószám formátumú, és az ÁFA-kódja `'4'`.
- `isGroupVatEntity(taxNumber: string | null | undefined): boolean`
  - Igazat ad vissza, ha az adószám érvényes magyar adószám, és az ÁFA-kódja `'5'` (maga a Csoportképviselő / Csoport).
- **Egységtesztek:** `src/lib/validationUtils.test.ts` fájlban 36/36 átfogó teszteset fedi le a kötőjeles, egybefüggő, hibás, hiányos és nemzeti formátumokat.

### 2. Figyelmeztető UI Védőháló a NAV Kapcsolat Beállítási Felületein
1. **`NavCredentialsForm.tsx` (Beállítások -> Integrációk -> NAV kapcsolat):**
   - Amikor a csatlakoztatott cég adószámának 9. karaktere `'4'`, az űrlap mind az aktív kapcsolat kártyán, mind az új/módosító modálban dinamikusan megjelenít egy kiemelt sárga/borostyánsárga `Alert` figyelmeztetést (`ShieldAlert` ikonnal).
   - A figyelmeztetés explicite tájékoztat: a vállalkozás csoportos ÁFA-tag (4-es kód), ezért a teljes számlaállomány szinkronizálásához a technikai felhasználót a **Csoport (5-ös adószám)** alatt kell létrehozni az Online Számla felületen.
2. **`EmptyStateDashboard.tsx` (Új Cég Onboarding Varázsló — 4. Lépés):**
   - A NAV kapcsolat varázsló lépésnél azonnal figyelmezteti a regisztráló felhasználót, megelőzve, hogy hibás technikai felhasználót hozzon létre és hiányos adatokkal kezdje el a könyvelést.

### 3. Hivatalos Tudástár Útmutató Integráció (`nav-group-vat-sync`)
Létrehoztunk egy dedikált, RAG-optimalizált tudástári cikket:
- **Azonosító (ID):** `nav-group-vat-sync`
- **Kategória:** `system` (*Integrációk & Rendszer*)
- **Cím:** *Csoportos ÁFA-alanyok és NAV szinkronizáció beállítása*
- **Menü útvonal:** `/integrations`
- **Tudástár adatbázis & Frontend Fallback szinkron:** Az idempotens SQL upsert lefutott a Supabase adatbázisban, és a `src/data/knowledgeBaseFallback.ts` állományban is rögzítésre került (a `system` kategória cikkszámlálója 6-ról 7-re emelkedett).
- **RAG Teljesítmény:** A `search_knowledge_base` RPC tesztelése során `/integrations` útvonalon `rank = 1.0`, általános csoportos ÁFA keresésekre pedig `rank = 0.38 - 0.54` eredménnyel az 1. helyen jelenik meg.

---

## Consequences

### Pozitív
- **Azonnali Hibamegelőzés:** A felhasználó nem a könyvelési záráskor vagy ÁFA bevalláskor szembesül azzal, hogy több tucat számla hiányzik a rendszerből.
- **Nulla Adatbázis-migrációs Kockázat:** A detektálás a már meglévő `companies.tax_number` mező alapján történik, nem igényel új DB oszlopot vagy sémamódosítást.
- **RAG & AI Támogatás:** Az AI Chat Asszisztens a Tudástár cikk alapján azonnal pontos, jogszabályi hátterű és lépésről lépésre követhető választ ad az ilyen jellegű kérdésekre.

### Negatív / Kötöttségek
- A csoportos technikai felhasználó létrehozásához a NAV Online Számla felületen olyan Ügyfélkapus azonosító szükséges, aki rendelkezik képviseleti joggal vagy UJEGYKE meghatalmazással a Csoport felé. A szoftver ezt nem tudja automatikusan pótolni, a felhasználónak kell elvégeznie.
