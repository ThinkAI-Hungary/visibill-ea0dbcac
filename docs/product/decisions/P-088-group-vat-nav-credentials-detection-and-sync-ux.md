# P-088: Csoportos ÁFA-tagok NAV Online Számla Beállítási Figyelmeztetése és Varázsló UX

**Status:** Decided  
**Date:** 2026-09-16  
**Category:** UI / Onboarding / NAV Integration / Error Prevention  
**Érintett komponensek:** `src/components/nav/NavCredentialsForm.tsx`, `src/components/dashboard/EmptyStateDashboard.tsx`, `src/lib/validationUtils.ts`  
**Kapcsolódó döntések:** [P-049: NAV Szinkronizálás UX](./P-049-nav-sync-dialog-ux.md), [A-120: Csoportos ÁFA Észlelés és Útmutatás](../../architecture/decisions/A-120-group-vat-entity-detection-and-technical-user-guidance.md), [BRD 056: Csoportos ÁFA Szabályzat](../../business/decisions/056-group-vat-entity-sync-policy.md)

---

## Question

Hogyan előzzük meg, hogy a csoportos ÁFA-alanyként működő cégek tagjai tévesen a saját egyéni adószámuk alatt létrehozott NAV technikai felhasználót kössék be a rendszerbe, aminek következtében a számlák 95-99%-a kimaradna a szinkronizációból?

---

## Decision

1. **Dinamikus Adószám Ellenőrzés (9. karakter detektálás):**
   - A rendszer a cég adószámának 9. karaktere (`4-es` ÁFA-kód) alapján automatikusan azonosítja, ha a vállalkozás csoportos ÁFA-tag.
2. **Kiemelt Vizuális Figyelmeztető Sáv (`Alert` borostyánsárga dizájnnal):**
   - **NAV Kapcsolat Kártya (`NavCredentialsForm.tsx`):**
     - Megjelenik egy kiemelt borostyánsárga `Alert` doboz `ShieldAlert` ikonnal, mind a már mentett kapcsolat nézetben, mind az új adatokat bekérő űrlapon.
     - A szöveg világosan megfogalmazza: *"A vállalkozás adószáma alapján csoportos ÁFA-tag (4-es ÁFA-kód). A számlák hiánytalan letöltéséhez a technikai felhasználót az onlineszamla.nav.gov.hu felületen a Csoport (5-ös adószám) alatt kell létrehozni!"*
   - **Onboarding Varázsló (`EmptyStateDashboard.tsx` 4. lépés):**
     - Az új cég felvételekor a varázsló 4. lépésében (NAV kapcsolat) a beviteli mezők felett azonnal látható a figyelmeztetés, megelőzve az ügyfélszolgálati hibajegyek keletkezését.

---

## Current Implementation

- `src/lib/validationUtils.ts` tartalmazza a megbízható `isGroupVatMember()` és `isGroupVatEntity()` logikát.
- `NavCredentialsForm.tsx` a `company.tax_number` vizsgálatával rendereli az `Alert` komponenst.
- `EmptyStateDashboard.tsx` az onboarding állapotban lévő cég adószáma alapján jeleníti meg az infósávot.

---

## Rationale

A felhasználók többsége nincs tisztában azzal, hogy az Online Számla 3.0 API szigorúan szétválasztja a tagi és a csoportos lekérdezéseket. A vizuális figyelmeztetés a beállítás pillanatában megállítja a hibás konfigurációt, időt spórolva a könyvelőnek és az ügyfélszolgálatnak egyaránt.
