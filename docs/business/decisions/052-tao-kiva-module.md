# Decision 052: Társasági Adó (TAO) és Kisvállalati Adó (KIVA) Modul

**Status:** Decided

**Category:** eaisyBooks & Integrált Modulok

**Question:** Hogyan támogassa az eaisyBooks a társas vállalkozások évközi adókövetését, év végi adózási zárását és az optimális adónem kiválasztását?

**Decision:**

1. **Évközi Követés és Adóelőleg Naptár:**
   - A könyvelt főkönyvi adatok alapján a rendszer valós időben kalkulálja a társasági adó (9%) és a kisvállalati adó (10%) várható alapját.
   - Negyedéves adóelőleg kötelezettségek és befizetési határidők megjelenítése az irodai Adónaptárban.

2. **Év Végi Zárási Ellenőrző Lista és Adóalap-korrekciók:**
   - Strukturált zárási checklist a könyvelő számára az év végi kötelezettségek ellenőrzésére.
   - TAO adóalap növelő és csökkentő tételek (pl. értékcsökkenés számviteli vs adótörvény szerinti különbözete, céltartalék, elhatárolások, bírságok, K+F kedvezmény) vezetése.
   - KIVA alap elemeinek pontos bontása: személyi jellegű kifizetések és jóváhagyott osztalék / tőkeműveletek egyenlege.

3. **Adókalkulátor és Összehasonlító Szimuláció:**
   - Interaktív szimulátor, amely a cég bérköltsége, árbevétele, anyagköltsége és eredménye alapján összehasonlítja a TAO és a KIVA alatti adóterhelést.
   - Szakmai döntéstámogatás a könyvelőiroda számára az ügyfél adóoptimalizálási tanácsadásához a tárgyév végén vagy az új adóév kezdetén.

**Rationale:** A KKV szektorban az egyik legfontosabb stratégiai kérdés a TAO vs. KIVA közötti választás. Az adatok automatizált előkészítése és a valós idejű adóelőleg-követés minimálisra csökkenti a könyvelőirodák év végi túlterheltségét és az adóbírságok kockázatát.
