# Decision 035: [eaisyBooks] Ügyfélportál (korábban: Accounty)

**Status:** Decided

**Category:** eaisyBooks & Integrált Modulok

**Question:** Hogyan kommunikál a könyvelő az ügyfeleivel és hogyan kéri be a hiányzó dokumentumokat?

**Decision:**
- **Magic link-es hozzáférés:** Az ügyfél auth nélkül, egyedi token-nel éri el a portált (`/portal/:token`)
- Az eaisyBooks felületen belül is elérhető preview-ként (`/accounty/payroll/:id/portal`)
- Funkciók:
  - Hiányzó számlák listája (könyvelő által összeállított)
  - Fájl feltöltés közvetlenül a portálról
  - Üzenetváltás a könyvelővel (`accounty_messages` tábla)
  - Határidő megjelenítés
- **Email értesítés:** Automatikus email a portál linkkel, amikor a könyvelő új hiányzó tételeket jelöl ki
- Email sablon generálás: `generateRequestEmail.ts` — személyre szabott, professzionális email szöveg
- Státusz tracking: az ügyfél látja, melyik tételeket töltötte fel és mi van még hátra

**Rationale:** A könyvelő-ügyfél kommunikáció legnagyobb szűk keresztmetszete a hiányzó bizonylatok bekérése. A magic link-es portál eliminál minden regisztrációs súrlódást — az ügyfél egyetlen kattintással feltöltheti a hiányzó dokumentumokat.
