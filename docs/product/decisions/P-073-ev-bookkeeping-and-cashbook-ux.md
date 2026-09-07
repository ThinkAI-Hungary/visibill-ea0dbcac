# P-073: [eaisyBooks] Egyéni Vállalkozói (EV) Könyvvitel & Pénztárkönyv Zárási Varázsló UX

**Status:** Decided  
**Category:** eaisyBooks  
**BRD Reference:** REQ-8b.14, Decision 051 (EV és szervezeti könyvvitel)

**Question:** Hogyan jelenik meg és hogyan vezethető az egyéni vállalkozók egyszeres könyvvitele és pénztárkönyve az eaisyBooks felületén?

**Decision:** Dedikált `EvBookkeepingPage` felület (`/eaisybooks/:companyId/:dateRange/ev`) tabos navigációval:
1. **Áttekintés:** Aktuális adózási forma (Átalányadó, VSZJA, KATA), göngyölt jövedelemkeret, bevételi plafon figyelés, adómentes keret progress bar.
2. **Kalkulátor & Járulékok:** Havi minimálbér / garantált bérminimum alapú SZJA, TB és Szocho kalkuláció (főállású, másodállású, nyugdíjas státusz figyelembevételével).
3. **Pénztárkönyv (CashBookGrid):** Hivatalos egyszeres könyvviteli pénztárkönyv (készpénz és bank oszlopok, bevételek, költségek, egyéb pénzmozgások).
4. **Zárási Varázsló:** Havi/negyedéves/éves zárási asszisztens:
   - Negatív pénztáregyenleg vizsgálata és figyelmeztetés.
   - Banki egyenlegek egyeztetése a kivonatokkal.
   - Nyitó és záró tételek automatikus összefésülése.
   - Nyomtatható és archiválható PDF pénztárkönyv generálása.
5. **Nyilvántartások:** 14 törvényes SZJA nyilvántartás (gépjárműhasználat, tárgyi eszközök, selejtezés, vevő-szállító analitika).

**Current Implementation:**
- Komponensek: `src/pages/accounty/EvBookkeepingPage.tsx`, `CashBookGrid.tsx`, `CashBookClosingWizard.tsx`
- Adatbázis: `ev_cashbook_entries`, `ev_registers`, `ev_tax_profiles`

**Rationale:** Az EV könyvelés más logikát követ, mint a kettős könyvvitel: pénzforgalmi szemléletű, és a készpénzegyenleg sosem lehet negatív. A beépített zárási varázsló és a valós idejű keretfigyelő megvédi a könyvelőt és az ügyfelet a büntetésektől.
