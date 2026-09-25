# A-154: NAV ÜPO (Ügyfélportál) M2M Integráció és Hitelesítési Biztonsági Architektúra

**Status:** Decided  
**Date:** 2026-09-24  
**Utoljára frissítve:** 2026-09-25  
**Érintett modulok:** `supabase/functions/nav-m2m-proxy/index.ts`, `supabase/migrations/20260924163000_nav_upo_m2m.sql`, `src/components/integrations/NavUpoM2mCard.tsx`  

---

## 1. Context

A Nemzeti Adó- és Vámhivatal (NAV) Ügyfélportál (ÜPO) gépi interfészt (Machine-to-Machine, M2M) biztosít a könyvelőprogramok számára adózói adatok, biztosítotti jogviszonyok és egyszerűsített foglalkoztatási (EFO) kvóták közvetlen, automatizált lekérdezésére.
A NAV M2M Általános Szerződési Feltételei (ÁSZF 2025.02.01, specifikáció v0.5 és v1.2) szigorú biztonsági és naplózási előírásokat támasztanak:
1. **Többlépcsős kriptográfiai aktiválás:** A felhasználónév, jelszó, aláírókulcs 1. része és a 72 óráig érvényes egyszer használatos nonce kód összefűzéséből kell levezetni a végleges aláírókulcsot.
2. **Kérésszintű aláírás:** Minden API kéréshez egyedi `messageId`, UTC időbélyeg és a titkos kulcs összefűzésével generált SHA-256 Base64 Uppercase digitális aláírás szükséges.
3. **Kötelező 90 napos audit naplózás:** Az ÁSZF 6.2 szakasza előírja minden gép-gép hívás (sikeres és sikertelen kísérlet egyaránt) naplózását időbélyeggel, azonosítókkal és válaszkódokkal.
4. **Biztonságos titoktárolás & RLS:** A kliensoldali böngésző soha nem láthatja a nyers aláírókulcsot vagy jelszót.

---

## 2. Decision

Központi, szerveroldali **Supabase Edge Function (`nav-m2m-proxy`)** és PostgreSQL séma architektúrát vezettünk be a teljes NAV M2M életciklus kezelésére:

### 1. Kriptográfiai Pipeline és Kétrétegű Hitelesítés
- **Sandbox és Production végpontok:** `https://m2m-dev.nav.gov.hu` és `https://m2m.nav.gov.hu`.
- **Token szolgáltatás (`/tokenService/Token`):** A szerveroldali `NAV_M2M_CLIENT_ID` és `NAV_M2M_CLIENT_SECRET` (rendszer-szintű titkok) segítségével a felhasználói hitelesítő adatokkal ideiglenes, phantom hozzáférési tokent igényel.
- **Nonce beváltás (`/userregistrationService/Nonce`):** A phantom tokennel beváltja az egyszer használatos kódot, amely visszaadja az aláírókulcs 2. felét (`signatureKeySecondPart`).
- **Összetett kulcsképzés:** `signatureKey = keyPart1 + keyPart2`.
- **Hitelesített regisztrációs aktiválás (`/userregistrationService/Activation`):** Digitális aláírással hitelesíti a gép-gép kapcsolatot a NAV felé.
- **SHA-256 Hash generálás:**
  $$\text{Signature} = \text{Base64}(\text{SHA-256}(messageId + timestampUtc + operationData + signatureKey)).\text{toUpperCase}()$$

### 2. Adatbázis Séma és RLS Védelem (`20260924163000_nav_upo_m2m.sql`)
- **`accounty_upo_credentials`:** Cég- és környezet-izolált tábla (`company_id, environment` UNIQUE). Tárolja a maszkolt adatokat és a titkosított kulcsokat.
- **`nav_m2m_audit_logs`:** Céghez kötött audit tábla kötelező 90 napos megőrzéssel (`idx_nav_m2m_audit_logs_company_created` kompozit index).
- **`accounty_efo_entries`:** Cég, adóazonosító és tárgyév szerinti EFO kvóta- és naptár-nyilvántartás (alkalmi, mezőgazdasági, turisztikai, filmipari napok és 120/90 napos plafon).
- **Multi-tenancy RLS:** A táblák kizárólag a cég tagjai (`company_members`) és tulajdonosa számára érhetők el. Névtelen (`anon`) hozzáférés teljesen tiltva.

### 3. Biztonsági Maszkolás és Revokáció RPC-k
- **`get_upo_credentials_status(p_company_id, p_env)`:** `SECURITY DEFINER` eljárás, amely ellenőrzi a cégtagságot, és kizárólag maszkolt felhasználónevet (`abc••••xy`) és státusz metaadatokat ad vissza, a nyers jelszót és aláírókulcsot soha nem adja át a kliensnek.
- **`revoke_upo_credentials(p_company_id, p_env)`:** Irrevokábilisan törli a tárolt titkokat az adatbázisból, és kötelező audit naplóbejegyzést hoz létre a visszavonás tényéről.

### 4. Automatizált Háttérszinkronizáció (`cron_sync_all`)
- A `pg_cron` vagy külső webhook hívó `x-cron-secret` fejléccel indíthatja a napi kötegelt szinkronizációt.
- Automatikusan lekérdezi az összes aktív cégnél:
  1. Az egyszerűsített foglalkoztatottak listáját (`/EgyszerusitettFoglalkoztatasFoglalkoztatottLista`), frissítve az `accounty_efo_entries` rekordokat.
  2. A biztosítotti jogviszonyokat (`/BiztositottiJogviszonyFoglalkoztatoAdat`), frissítve az `accounty_employees` és `accounty_employments` bérszámfejtési adatokat (név, adóazonosító, TAJ, születési adatok, FEOR, heti óraszám).

### 5. Egészségügyi Ellenőrzés (`test_health`)
- KOMA (Köztartozásmentesség) lekérdezés (`/KoztartozasMentesseg`), amely ellenőrzi az adózó tartozásmentes státuszát és a kapcsolat érvényességét valós idejű NAV hívással.

---

## 3. Consequences

- **Pozitív:**
  - Teljes megfelelőség a NAV M2M jogi és technikai előírásainak (2025 ÁSZF).
  - Zero Credential Exposure a frontenden: a böngésző csak maszkolt státuszt kap.
  - Automatizált EFO és munkavállalói adatfrissítés manuális könyvelői adminisztráció nélkül.
  - Auditálható: minden hívás, hiba és sikeres válasz 90 napig visszakövethető.
- **Negatív / Kockázat:**
  - A szerveroldali NAV partner titkok (`NAV_M2M_CLIENT_SECRET`) konfigurációja elengedhetetlen a működéshez.
  - A NAV M2M hívások időnként `FOLYAMATBAN` aszinkron állapotot adnak, amely kliensoldali vagy szerveroldali pollingot igényel.

---

## 4. Kapcsolódó
- [P-114: NAV ÜPO M2M Integráció UI/UX](../../product/decisions/P-114-nav-upo-m2m-integration-ui-ux.md)
- [A-005: Supabase Edge Functions Katalógus](./A-005-edge-functions.md)
- [05-nav.md Database Schema](../database/05-nav.md)
