# Decision 048: NAV Online Számla Megfelelőség és Könyvelői Zárlat Üzleti Szabálya

**Status:** Decided  
**Date:** 2026-09-03  
**Category:** Business Rule / Accounting Compliance  

---

## Question
Hogyan garantálható, hogy a cég könyvelésébe, áfabevallásaiba és a könyvviteli szoftverekbe (RLB60, Kulcs-Soft, Novitax) exportált tételek közé ne kerülhessenek be olyan belföldi számlák, amelyek nem rendelkeznek kötelező NAV Online Számla adatszolgáltatással?

## Context
A magyar adójogszabályok értelmében a belföldi adóalanyok közötti ügyletekről kötelező az azonnali online számla adatszolgáltatás a NAV felé.
Könyvelői praxisban előfordulhat, hogy az ügyfél olyan bizonylatot tölt fel (pl. elgépelt bizonylatszám, tévesen kiállított vagy a kibocsátó által a NAV felé be nem küldött számla), amely valójában nem szerepel a NAV adatbázisában.
Ha a rendszer az ilyen számlákat automatikusan könyvelné és beemelné a főkönyvbe, az súlyos adókockázatot, levonási joggal kapcsolatos hibákat és adóhatósági megállapításokat vonhatna maga után.

## Decision
1. **Könyvelési Zárlat:**  
   Belföldi számlák esetén (a vevő vagy eladó magyar adóalany) az automatikus könyvelési tétel generálás (`get_gl_categorized_items`, főkönyv, naplók, pénztárkönyv) mindaddig **zárolva van**, amíg a számla nem rendelkezik igazolt NAV adatszolgáltatással (`nav_status = 'verified'`).
2. **Külföldi Ügyletek Kivétele:**  
   A külföldi partnerektől érkező számlák (ahol nincs magyar adószám vagy EU/harmadik országbeli az ügylet) mentesülnek a NAV ellenőrzés alól (`not_applicable`), és automatikusan könyvelhetők maradnak.
3. **Könyvelői Jóváhagyási Jogcím (Approval Gate):**  
   Ha egy belföldi számlához nem érkezik NAV adatszolgáltatás, az nem kerül automatikus elutasításra vagy törlésre. Ehelyett a könyvelő **jóváhagyási jogot kap**, amellyel indoklással ellátva feloldhatja a bizonylatot könyvelésre.
4. **Auditált Jóváhagyási Indoklások:**  
   A jóváhagyáshoz a könyvelőnek az alábbi jogcímek egyikét kell megjelölnie:
   - Papíralapú / kézi számlatömbös számla (nincs rá kötelező online NAV adatszolgáltatás),
   - NAV adatszolgáltatási késés vagy technikai hiba (a számla hamarosan beérkezik),
   - Külföldi vagy mentesített ügylet (belföldi adószámmal rendelkező, de nem adatszolgáltatás-köteles jogcím),
   - Egyéb egyedi könyvelői felelősségvállalás (részletes szöveges indoklással).
5. **Visszakövethetőség (Audit Trail):**  
   A jóváhagyás ténye, pontos időbélyege (`approved_at`), a jóváhagyó személye (`approved_by`) és a rögzített indoklás (`approval_note`) megmásíthatatlanul rögzül a bizonylat rekordjában.

## Rationale
Ez a szabály teljes biztonságot nyújt a könyvelőirodáknak és ügyfeleiknek az adóbírságokkal szemben, miközben fenntartja a rugalmasságot a papíralapú vagy átmenetileg késő bizonylatok jogszerű lekönyvelésére.

## Kapcsolódó
- ADR: [A-084: NAV Online Számla Cross-Check & Könyvelői Jóváhagyási Kapu](../../architecture/decisions/A-084-nav-crosscheck-approval-gate.md)
- PRD: [P-065: NAV Online Számla Ellenőrzés és Könyvelői Jóváhagyási Kapu UX](../../product/decisions/P-065-nav-crosscheck-approval-gate-ux.md)
- BRD: [012: Számla típusok](./012-invoice-types.md)
- BRD: [015: NAV integráció scope](./015-nav-integration.md)
