# A-118: Atomi Partner Skontó Újraszámolás és Kliensoldali Ciklusok Felszámolása

**Status:** Decided  
**Date:** 2026-09-17  
**Category:** Architecture / Database / Finance / Performance / Partners  
**Érintett komponensek:** `supabase/migrations/20260917120000_add_recalculate_partner_skonto_rpc.sql`, `src/pages/PartnersPage.tsx`, `invoices`, `nav_invoices`, `invoice_items`, `nav_invoice_items`, `partners`  
**Kapcsolódó döntések:** [A-016: PostgreSQL Query Stratégia](./A-016-postgresql-query-strategy.md), [A-024: Partner Upsert Strategy](./A-024-partner-upsert-strategy.md), [A-058: Banki Utalások és Csomagkészítés](./A-058-bank-transfers-architecture.md), [P-044: Külföldi Partnerek Megjelenítése](../../product/decisions/P-044-foreign-partner-display.md)

---

## Context

A Visibill partnerkezelő felületén ([`PartnersPage.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/PartnersPage.tsx)) beállítható a beszállító partnerekhez skontó fizetési kedvezmény (fizetési határidő napokban, skontó százalék, szállítási díj levonásának kizárása).

Amikor egy felhasználó módosította egy partner skontó paramétereit vagy bekapcsolta azt, a frontend korábban szekvenciális kliensoldali JavaScript `for` ciklusokban próbálta frissíteni a partnerhez tartozó összes nyitott, kifizetetlen számlát:
1. Lekérdezte a nyitott manuális számlákat (`invoices`), majd egyenként tétel-lekérdezéseket indított az `invoice_items` táblára szállítási díj kereséséhez, majd egyesével UPDATE hívásokat küldött vissza a böngészőből.
2. Ugyanezt megismételte a nyitott NAV számlákra (`nav_invoices`) a `nav_invoice_items` lekérdezésével.

### A korábbi megoldás súlyos kockázatai és hibái:
1. **Tranzakcióbiztonság hiánya (Megszakadás veszélye):** 30–50 nyitott számla esetén a folyamat 60–100 szekvenciális hálózati kérést generált a böngészőből. Ha a felhasználó a mentés után azonnal elnavigált az oldalról, vagy ingadozott az internetkapcsolat, a ciklus félbeszakadt. Így a számlák egy része megkapta a skontót, míg a másik része változatlan maradt.
2. **Kikapcsolási inkonzisztencia (Disabled Skonto Gap):** Ha a felhasználó kikapcsolta a partner skontóját (`has_skonto = false`), a korábbi kód egyáltalán nem futott le (`if (selectedCompany?.id && data.has_skonto)`), így a korábban megjelölt nyitott számlákon rajta maradt az érvénytelenített skontó kedvezmény.
3. **Nem létező mezők hivatkozása:** A tétel-lekérdezés olyan oszlopokat kért le (`termek_nev`, `brutto_ar`), amelyek nem léteztek az `invoice_items` táblában, PostgreSQL 42703 hibaüzeneteket generálva a hibanaplókba.
4. **N+1 hálózati terhelés:** Feleslegesen terhelte a kliens processzort és a hálózati sávszélességet.

---

## Decision

### 1. Atomi PostgreSQL Tárolt Eljárás (`public.recalculate_partner_skonto`)
A szekvenciális kliensoldali ciklusokat egyetlen atomi, tranzakció-biztos, `SECURITY DEFINER` PostgreSQL RPC funkcióval váltottuk ki:
- **Függvény szignatúra:**
  ```sql
  CREATE OR REPLACE FUNCTION public.recalculate_partner_skonto(
    p_company_id uuid,
    p_partner_name text,
    p_partner_tax text DEFAULT NULL,
    p_has_skonto boolean DEFAULT false,
    p_skonto_days integer DEFAULT 8,
    p_skonto_percent numeric DEFAULT 2.0,
    p_excludes_shipping boolean DEFAULT false
  )
  RETURNS jsonb
  ```

### 2. Egyetlen Tranzakcióban Történő Frissítés (CTE Update)
- Az eljárás PostgreSQL Common Table Expressions (CTE) használatával aggregálja az adatokat és hajtja végre a módosításokat.
- Mind az operatív `invoices`, mind a `nav_invoices` táblák frissítése ugyanabban az atomi adatbázis-tranzakcióban fut le. Sikertelenség esetén azonnali automatikus rollback történik, garantálva a zero partial state állapotot.

### 3. Skontó Kikapcsolásának Kezelése
- Ha `p_has_skonto = false`, a funkció azonnal és atomian törli az összes kapcsolódó, még kifizetetlen nyitott számla skontó mezőit (`has_skonto = false`, `skonto_days = NULL`, `skonto_amount = NULL`, `skonto_shipping_amount = 0`, `skonto_selected = false`).

### 4. Szerveroldali Szállítási Díj Detektálás
- A szállítási díjak azonosítása az adatbázis motoron belül történik regex mintaillesztéssel a tételek megnevezésén (`line_description`):
  ```sql
  '(transport|shipping|fracht|fuvard[ií]j|sz[aá]ll[ií]t[aá]s|posta|delivery|porto)'
  ```
- Amennyiben `p_excludes_shipping = true`, a fenti mintára illeszkedő sorok bruttó/nettó összege automatikusan levonásra kerül a kedvezményalapból a számítás előtt.

### 5. Külföldi és Belföldi Partnerek Kezelése
- Belföldi partnerek esetén szigorú adószám szerinti egyezést (`elado_vat_id` / `supplier_tax_number`) vizsgál az eljárás.
- Nemzetközi vagy szintetikus adószámmal rendelkező partnereknél (`FOREIGN:<nev>` vagy adószám hiánya) a partnernév kis- és nagybetűt nem megkülönböztető mintaillesztése (`ILIKE`) biztosítja az összerendelést.

### 6. Jogosultságvédelem (Security Definer Guard)
- A függvény szigorúan ellenőrzi a hívó jogosultságát:
  - `auth.role() = 'service_role'`, VAGY
  - Aktív tagság a `public.company_members` táblában az adott céghez (`company_id = p_company_id`), VAGY
  - Rendszerszintű adminisztrátor: `public.is_support_admin()`, `profiles.role IN ('management', 'thinkai', 'support_admin')`, illetve `@thinkai.hu` e-mail cím.
- Névtelen és publikus hívások letiltva (`REVOKE EXECUTE FROM anon, PUBLIC`).

### 7. Vékony Kliens Implementáció (`PartnersPage.tsx`)
A frontend komponens kizárólag a paraméterek átadásáért és az egyetlen RPC meghívásáért felel:
```typescript
if (selectedCompany?.id) {
  const { error: rpcError } = await supabase.rpc('recalculate_partner_skonto' as any, {
    p_company_id: selectedCompany.id,
    p_partner_name: data.name.trim(),
    p_partner_tax: data.tax_number?.trim() || null,
    p_has_skonto: !!data.has_skonto,
    p_skonto_days: Number(data.skonto_days) || 8,
    p_skonto_percent: Number(data.skonto_percent) || 2.0,
    p_excludes_shipping: !!data.skonto_excludes_shipping,
  });
  if (rpcError) {
    console.error("Failed to recalculate partner skonto via RPC:", rpcError);
  }
}
```

---

## Consequences

### Pozitív:
- **Azonnali lefutás és nulla hálózati terhelés:** 60–100 külön kérés helyett 1 darab RPC hívás fut le, tipikusan 20–50 ms alatt.
- **Megszakadás elleni védelem:** Ha a felhasználó mentés után azonnal bezárja az ablakot vagy elnavigál, a PostgreSQL a háttérben hibátlanul befejezi a tranzakciót.
- **Konzisztens állapotok:** A skontó bekapcsolása, módosítása és kikapcsolása minden nyitott számlán szinkronban marad.
- **Hibanaplók tisztasága:** Megszűntek a nem létező `invoice_items.termek_nev` oszlop miatti 42703 hibák.

### Negatív / Trade-off:
- A szállítási díj regex logikája a TypeScript utility (`skontoUtils.ts`) mellett most a PostgreSQL tárolt eljárásban is definiálva van; új szállítási kifejezések esetén mindkét helyet szinkronban kell tartani.

---

## Kapcsolódó
- [A-016: PostgreSQL Query Stratégia](./A-016-postgresql-query-strategy.md)
- [PostgreSQL RPC Katalógus](../rpc-catalog.md)
- [Törzsadatok Adatbázis Séma](../database/21-master-data.md)
