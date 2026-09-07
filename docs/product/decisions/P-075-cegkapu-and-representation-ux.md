# P-075: [eaisyBooks] Cégkapu / KÜNY Tárhely Szinkronizáció és EGYKE Képviseleti Nyilvántartás UX

**Status:** Decided  
**Category:** eaisyBooks  
**BRD Reference:** REQ-8b.16, REQ-8b.17, Decision 031

**Question:** Hogyan kezeli az eaisyBooks a hivatalos állami tárhelyek (Cégkapu / KÜNY) és a könyvelői meghatalmazások (EGYKE) adatait?

**Decision:** Két dedikált felület az ügyfél kontextusban:
1. **Cégkapu Tárhely (`/eaisybooks/:companyId/:dateRange/cegkapu`):**
   - Hivatalos hatósági küldemények és értesítések beolvasása, letöltése és kategorizálása (NAV, KSH, Önkormányzat, Bíróság).
   - Olvasott/olvasatlan státusz, archiválás, és értesítés továbbítása a cégvezetőnek.
   - Adófolyószámla-kivonatok automatikus párosítása.
2. **Képviselet & EGYKE (`/eaisybooks/:companyId/:dateRange/representation`):**
   - Könyvelői meghatalmazások nyilvántartása ügyintézőnként és hatóságonként.
   - EGYKE adatlap azonosítók, hatályossági idők, lejárati riasztások.
   - Meghatalmazási sablonok és PDF generálás.

**Current Implementation:**
- Útvonalak: `/eaisybooks/:companyId/:dateRange/cegkapu`, `/eaisybooks/:companyId/:dateRange/representation`
- Komponensek: `CegkapuPage.tsx`, `RepresentationPage.tsx`

**Rationale:** A könyvelőirodák felelőssége a hatósági levelek határidőben történő átvétele és a meghatalmazások folyamatos érvényessége. A beépített tárhely- és EGYKE modul megszünteti az elfelejtett levelekből és lejárt jogosultságokból adódó mulasztási bírságokat.
