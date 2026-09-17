# Decision 056: Csoportos ÁFA-alanyok és NAV Szinkronizáció Üzleti Szabályzata

**Status:** Decided  
**Date:** 2026-09-16  
**Category:** Business Rule / Tax Law / NAV Integration / Multi-Company  
**Érintett területek:** Adóalanyiság, NAV Online Számla szinkron, számlázási kötelezettség, könyvelési integráció  
**Kapcsolódó döntések:** [A-120: Csoportos ÁFA Észlelés és Útmutatás](../../architecture/decisions/A-120-group-vat-entity-detection-and-technical-user-guidance.md), [P-088: Csoportos ÁFA NAV UI](../../product/decisions/P-088-group-vat-nav-credentials-detection-and-sync-ux.md), [BRD 015: NAV Integráció](./015-nav-integration.md)

---

## Question

Hogyan kell kezelnie az eaisyBill és eaisyBooks rendszereknek a magyar Áfa tv. 8. §-a szerinti csoportos általános forgalmi adóalanyokat (holding tagok, kapcsolt vállalkozások) az adatbázisban, a NAV Online Számla technikai felhasználó bekötésében, valamint a számlák partner- és céghozzárendelésében?

---

## Decision

1. **Jogszabályi Illeszkedés (Áfa tv. 8. §):**
   - A csoportos ÁFA-alanyiság fennállása alatt az általános forgalmi adó szempontjából **egyetlen adóalany létezik: a Csoport** (5-ös ÁFA-kódú csoportazonosító szám: `XXXXXXXX-5-YY`).
   - A csoport tagjai (4-es ÁFA-kódú tagi adószám: `XXXXXXXX-4-YY`) önállóan nem minősülnek ÁFA-alanynak, de a társasági adó (TAO), a helyi iparűzési adó (HIPA) és a foglalkoztatási járulékok (NAV 08) tekintetében önálló jogi és gazdasági személyek maradnak.
2. **NAV Online Számla Szinkronizációs Követelmény:**
   - A számlák teljes körű letöltéséhez a csoporttag vállalkozásoknál a **Csoport (5-ös adószám) alatt regisztrált technikai felhasználót** kötelező alkalmazni az eaisyBill / Visibill felületén.
   - A tagi egyéni adószámon regisztrált technikai felhasználó bekötése üzletileg és funkcionálisan hibásnak minősül, mivel a NAV 3.0 API nem szolgáltatja a csoport nevére kiállított bizonylatokat.
3. **Rendszerbeli Felelősség és Tájékoztatás:**
   - A rendszernek automatikusan detektálnia kell a 4-es ÁFA-kódot a cég adószámában, és a NAV konfigurációs képernyőkön, valamint az Onboarding során egyértelmű, cselekvésre ösztönző tájékoztatást kell nyújtania a felhasználónak.
   - A Tudástárban (`nav-group-vat-sync`) kötelező naprakészen tartani a Csoportképviselő általi technikai felhasználó generálás lépéseit.

---

## Rationale

A csoportos adóalanyok számláinak elmaradása azonnali könyvelési és adózási kockázatot jelent (levonható ÁFA elmaradása, késedelmi pótlék kockázata). Az üzleti szabály egyértelművé teszi, hogy a szoftver proaktívan irányítja a felhasználót a helyes NAV konfiguráció felé.
