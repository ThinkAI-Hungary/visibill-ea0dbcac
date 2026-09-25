# A-155: Házipénztár Bejövő/Szállítói Számlák Kiegyenlítése és Időszaki Zárás Egyenleg Számítási Modell

**Status:** Decided  
**Date:** 2026-09-24  
**Utoljára frissítve:** 2026-09-25  
**Érintett modulok:** `supabase/migrations/20260924200000_petty_cash_inbound_settlement.sql`, `src/components/petty-cash/CashClosingDialog.tsx`, `src/components/petty-cash/EntriesTab.tsx`, `src/components/petty-cash/types.ts`  

---

## 1. Context

A magyar számviteli és pénzkezelési szabályzatok szerint a vállalkozások házipénztárából nemcsak vevői készpénzes befizetések (bevétel) keletkeznek, hanem mindennapos a szállítói (bejövő) készpénzes számlák azonnali vagy utólagos kiegyenlítése is (kiadás).
A korábbi implementációban a `settle_invoices_via_petty_cash` adatbázis RPC kizárólag kimenő számlákat tudott kezelni pozitív előjellel. Ha a könyvelő szállítói számlát akart készpénzzel rendezni, manuális egyedi pénztárbizonylatot kellett rögzítenie, ami elveszítette a számlakapcsolatot és a számla kifizetettségi státuszát nem állította át automatikusan.
Továbbá az időszaki pénztárzárás (`CashClosingDialog`) kizárólag az időszaki forgalmat mutatta nyitó és záró egyenlegek nélkül, így a könyvelő nem tudta ellenőrizni a pénztár tényleges záró egyenlegét és a jogszabály által tiltott negatív készpénzegyenleget.

---

## 2. Decision

### 1. Kétirányú Számlakiegyenlítő RPC (`settle_invoices_via_petty_cash`)
A `20260924200000_petty_cash_inbound_settlement.sql` migrációval az eljárás előjel-érzékennyé és kétirányúvá vált:
```sql
SELECT 
  COUNT(*),
  COALESCE(SUM(
    CASE 
      WHEN invoice_direction ILIKE '%outbound%' THEN brutto_vegosszeg 
      ELSE -brutto_vegosszeg 
    END
  ), 0),
  string_agg(bizonylatsorszam, ', ' ORDER BY kibocsatas_datuma, bizonylatsorszam),
  MIN(id::text)::uuid,
  MIN(partner_id::text)::uuid
INTO v_inv_count, v_total_amount, v_biz_sorszamok, v_first_inv_id, v_first_partner_id
FROM invoices
WHERE id = ANY(p_invoice_ids) AND company_id = p_company_id;
```
- **Kimenő (vevői) számla:** `+brutto_vegosszeg` → pénztári növekmény (bevétel).
- **Bejövő (szállítói) számla:** `-brutto_vegosszeg` → pénztári csökkenés (kiadás).
- **Partner reláció:** Egyedi számla esetén a `partner_id` automatikusan átkerül a `petty_cash_entries` tételbe, biztosítva a partnerkarton analitika integritását.
- **Atomi tranzakció:** A pénztári tétel rögzítésével egyidejűleg a számlák `fizetve = true` és `fizetes_napja = p_entry_date` értékei lefrissülnek.

### 2. Időszaki Pénztárzárás és Egyenlegmodell (`CashClosingDialog`)
A zárási dialógusban és a nyomtatási/PDF export sablonban bevezetésre került az 5-oszlopos pénzkezelési egyenleglevezetés minden aktív devizára:
1. **Nyitó egyenleg ($O$):** A pénztár alap nyitóegyenlege + az időszak kezdete előtti összes bizonylat kumulált összege.
2. **Időszaki bevétel ($I$):** Az időszakon belüli pozitív tételek összege.
3. **Időszaki kiadás ($E$):** Az időszakon belüli negatív tételek összege.
4. **Időszaki forgalom ($N$):** $N = I + E$.
5. **Záró egyenleg ($C$):** $C = O + N = O + I + E$.

### 3. Negatív Kassza Integritási Védelem
- Ha a számított záró egyenleg negatív ($C < 0$), a felület azonnal piros kiemeléssel (`border-destructive/40 bg-destructive/5`) és figyelmeztetéssel jelzi az anomáliát, segítve a könyvelőt az adminisztrációs vagy fizetési hibák felderítésében még a hivatalos zárás előtt.

---

## 3. Consequences

- **Pozitív:**
  - Szállítói és vevői számlák egységesen, egyetlen kattintással rendezhetők készpénzben.
  - A számla fizetett státusza azonnal szinkronizálódik az ÁFA analitikával és a főkönyvvel.
  - Számvitelileg pontos pénztárzárási jegyzőkönyv generálható PDF-ben nyitó és záró egyenlegekkel.
- **Negatív / Kockázat:**
  - Vegyes (vevői és szállítói egyszerre) kijelölés esetén a leírás összesített szöveggel generálódik, és a tételhez nem rendelhető egyetlen partner ID (ilyenkor a partner_id NULL marad, és a számlahivatkozások a leírásban szerepelnek).

---

## 4. Kapcsolódó
- [P-115: Házipénztár Bejövő/Szállítói Számlák Kiegyenlítése és Időszaki Zárás Egyenleg UX](../../product/decisions/P-115-petty-cash-inbound-settlement-and-period-closing-ux.md)
- [09-petty-cash.md Database Schema](../database/09-petty-cash.md)
- [A-125: Atomi Házipénztár Számlakiegyenlítés és Jogosultsági Reziliencia](./A-125-atomic-petty-cash-invoice-settlement-and-auth-resilience.md)
