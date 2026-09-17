# Decision 058: Idegen Vevőre Szóló Számlák Jóváhagyási és Könyvelési Védelmi Szabályzata (Buyer Tax Validation & Misdirected Invoices Policy)

**Status:** Decided  
**Date:** 2026-09-17  
**Category:** Accounting / Compliance / Validation  
**Question:** Hogyan kezelje a rendszer azokat a számlákat, amelyeket a felhasználó feltölt egy céghez, de a számlán szereplő vevő adószáma nem egyezik meg az aktív cégével?  
**Decision:** A rendszer kötelező érvénnyel figyelmeztetést jelenít meg és naplózza az adószám-inkonzisztenciát a jóváhagyási folyamatban. A számla nem kerülhet automatikusan jóváhagyásra vagy bekönyvelésre a könyvelő / felhasználó explicit jóváhagyása nélkül.  
**Rationale:** A számviteli törvény (Sztv.) és az ÁFA törvény szerint a vállalkozás kizárólag a saját nevére és adószámára kiállított hiteles bizonylatok alapján számolhat el költséget és vonhat le előzetesen felszámított forgalmi adót. A tévesen felvitt idegen számlák súlyos adókockázatot és fiktív költségelszámolási kockázatot jelentenek.

---

## Üzleti Szabályok

1. **8 Számjegyű Törzsszám-Egyezőség Követelménye:**
   * A vizsgálat a belföldi adószám első 8 számjegyére vonatkozik. Amennyiben az első 8 számjegy nem egyezik, a bizonylat idegen számlának minősül.
2. **Kivételes Jóváhagyási Folyamat:**
   * Ha a könyvelő igazolja, hogy a számla jogosult költség (pl. kapcsolt vállalkozási átterhelés, megosztott rezsiköltség), felülbírálhatja a figyelmeztetést, de a művelet az audit naplóban rögzítésre kerül.
3. **Főkönyvi és ÁFA Hatás:**
   * A nem jóváhagyott, idegen számla nem vehet részt automatikus könyvelési napló feladásban (Journal draft generation), megelőzve az illegitim főkönyvi tételeket.

---

## Kapcsolódó
- [A-123: Buyer Tax Number Mismatch Guard](../../architecture/decisions/A-123-buyer-tax-mismatch-detection-and-approval-guard.md)
- [P-091: Buyer Tax Mismatch Warning UX](../../product/decisions/P-091-buyer-tax-mismatch-warning-ux.md)
- [048: NAV Cross-Check Approval Gate Policy](./048-nav-crosscheck-approval-gate.md)
