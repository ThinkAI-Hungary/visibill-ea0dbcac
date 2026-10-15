# Decision 074: Számlatételek Többes Projekt-Költségmegosztása és 100%-os Érvényesítése

**Status:** Decided  
**Category:** Business Rule / Invoices / Projects / Cost Control  
**Date:** 2026-10-15  

## Question
Hogyan kezelje a rendszer azt az üzleti esetet, amikor egy beszerzési vagy alvállalkozói számla egyetlen tétele több munkaszámot vagy beruházási projektet terhel egyszerre?

## Decision
1. **Többes Projektmegosztási Szabály:**
   Egy tétel költsége tetszőleges számú projekt között osztható meg, százalékos arányban megadva.
2. **Kizárólagos 100%-os Egyezőség:**
   Üzleti szabályként a megadott százalékok összegének szigorúan el kell érnie és nem haladhatja meg a 100.00%-ot. Részben allokált (pl. 70%-os) tétel nem menthető; a fennmaradó 30%-ot vagy másik projekthez kell rendelni, vagy egy „Általános rezsi / Központi” projektre kell allokálni.
3. **Pénzügyi és Kontrolling Hatás:**
   A Projektek modulban a tétel bruttó értéke az aránynak megfelelően kerül levonásra (költség) vagy hozzáadásra (bevétel), biztosítva a pontos költségvetési elszámolást.
4. **Visszafelé Kompatibilitás:**
   Amennyiben egy tétel 100%-ban egyetlen projekthez tartozik, az a hagyományos egyedi projekt hozzárendeléssel azonosnak minősül, és kitölti az egyedi `project_id` mezőt is.
5. **Csoportos Műveletek (Bulk Actions):**
   A számlák tömeges kijelölése esetén a felhasználó egyetlen lépésben érvényesítheti a megadott költségfelosztást az összes kijelölt bizonylatra.

## Rationale
A valós vállalati működésben gyakori, hogy egy nagyobb beszerzés (pl. irodaszer, informatikai licencek, alvállalkozói szolgáltatás) több párhuzamos projektet szolgál ki. A tételszintű százalékos megosztás biztosítja, hogy ne kelljen mesterségesen több külön számlát kérni a szállítótól, miközben a projektköltség-elszámolások fillérre pontosak maradnak.

## Kapcsolódó
- ADR: [A-260: Multi-Project Line Item Allocations Architecture](../../architecture/decisions/A-260-multi-project-item-allocations-and-financial-split.md)
- PRD: [P-190: Számlatételek Többes Projekt-Költségmegosztása UX](../../product/decisions/P-190-multi-project-item-allocations-ux.md)
