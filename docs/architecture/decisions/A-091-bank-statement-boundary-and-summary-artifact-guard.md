# A-091: Bank Statement Boundary Governance & Defense-in-Depth Summary Artifact Filtering

**Status:** Decided  
**Date:** 2026-09-05  
**Utoljára frissítve:** 2026-09-05  
**Kategória:** 🗄️ Adatbázis & Pénzügy / Worker Pipeline  

## Context
A bankszámlakivonatok feldolgozása a Visibill rendszerben determinisztikus regex alapú (`_regex_parse_pdf`) és mesterséges intelligencia alapú (`_ai_cleanup_pdf`) pipeline-on keresztül történik.

A Raiffeisen Bank bankszámlakivonatok feldolgozásakor súlyos tranzakció-torzulási hiba lépett fel:
1. **Determinisztikus folytatólagos sorok beszivárgása:** A bankszámlakivonat utolsó tranzakciója (pl. havi záró kamatjóváírás: `228,42 HUF`) után következő sorok (kivonati záróegyenleg, időszaki forgalmi adatok, valamint a devizaforgalmi árfolyam-elszámoló táblázat lábléce: `EUR 760,00`) nem tartalmaztak könyvelési dátumot. A parser a dátum nélküli sorokat korlátlanul hozzáfűzte az utolsó tranzakció leírásához.
2. **Ékezet-dekódolási anomália és zajszűrő sorrend:** A MarkItDown a nem beágyazott PDF fontok miatt a magyar ékezeteket torzítva (`Z¶RøEGYENLEG`) adta át. Mivel a zajszűrő a karakterkódolás helyreállítása előtt futott, a záróegyenleg zajminták nem illeszkedtek, így a lábléc benne maradt a leírásban.
3. **Téves devizakonverziós felülírás:** A ciklus végén az `_extract_foreign_currency` megtalálta a felhalmozott láblécben az `EUR 760,00` mintát, és a valós `228.42 HUF` kamattételt átírta `760.0 EUR` devizaátutalássá, közvetlen pénzügyi és könyvelési hibát okozva a `public.transactions` táblában.
4. **Lapfejlécek beégése:** Hasonló jelenség miatt a többoldalas kivonatok lapfejlécei (`BANKSZÁMLAKIVONAT Oldal 2/11`) hozzáfűződtek az előző oldal utolsó tranzakciójának leírásához.

## Decision

1. **Determinisztikus Határoló Logika (`_STATEMENT_BOUNDARY_PATTERNS` & `in_summary_block`):**
   - Bevezetésre került a kivonat záró szakaszait, lapfejléceit és információs mellékleteit azonosító regex szabályrendszer (`BANKSZÁMLAKIVONAT`, `Oldal \d+/\d+`, `Kivonatsorszám`, `Tárgyidőszak`, `Pénzforgalmi jelzőszám`, `NYITÓEGYENLEG`, `ZÁRÓEGYENLEG`, `ELÉRHETŐ EGYENLEG`, `összes terhelés/jóváírás`, `Devizaforgalmi tételek`).
   - Határoló minta észlelésekor a parser aktiválja az `in_summary_block = True` állapotot, megtiltva a további dátum nélküli sorok hozzáfűzését az előző tranzakcióhoz.
   - Új, valós tranzakció (dátum + összeg) észlelésekor az állapot automatikusan visszaáll (`in_summary_block = False`), biztosítva a laphatárok közötti zökkenőmentes átmenetet.
   - Dátumot tartalmazó összesítő sorok (`is_boundary_line`) kizárása mind az új tranzakciók, mind a leírás-hozzáfűzések közül.

2. **Partner Név Ütközésvédelem (Erste Bank és Memo Biztonság):**
   - Eltávolításra kerültek az általános szavak (`Számlatulajdonos`, `Számlaazonosító`) a zaj- és határmintákból, hogy az Erste Bank kivonatok `Partner számlatulajdonos: <Név>` sorai és a közlemények számlaazonosítói véletlenül se csonkolódjanak.

3. **Szigorú Szűrési Sorrend:**
   - A leírások utófeldolgozásában a font-kódolás helyreállítása (`_fix_pdf_text_encoding`) kötelezően MEGELŐZI a zajszűrést (`_clean_description_noise`), így a magyar ékezetes minták (`ZÁRÓ EGYENLEG`) megbízhatóan levágásra kerülnek a devizafelismerés (`_extract_foreign_currency`) lefutása előtt.

4. **Kétszintű Védelem (Defense-in-Depth Artifact Filter):**
   - Létrejött az `is_statement_summary_artifact()` biztonsági szűrő.
   - Ha egy kinyert tétel leírásában legalább két független kivonati záró kulcsszó szerepel, a rendszer záróösszesítő műtermékként elveti a tételt.
   - A szűrő mind a determinisztikus parser végén, mind a központi `extract_transactions()` belépési ponton aktív, megvédve a rendszert az LLM esetleges hallucinációitól is.

5. **AI Extractor Prompt Szigorítás:**
   - A `tranzakcio_tetelesites.md` prompt 1-es szabálya expliciten megtiltja a záró összesítő blokkokból, fejléc/lábléc ismétlődésekből és tájékoztató devizaforgalmi kalkulációs táblázatokból való tranzakció-képzést.

## Consequences

**Pozitív:**
- **Pénzügyi Pontosság:** A Raiffeisen és más banki kivonatok záró kamattételei és utolsó tranzakciói pontos összeggel és devizával rögzülnek. A valós tesztkivonaton mind a 63 tranzakció, a 9 413 023,42 HUF jóváírás és a -7 819 013,52 HUF terhelés 0,00 HUF eltéréssel, fillérre egyezik a banki záróegyenleggel.
- **Tiszta Tranzakció Leírások:** A lapfejlécek (`BANKSZÁMLAKIVONAT OldalX/11`) többé nem szemetelik a tranzakciók leírását a többoldalas kivonatokban.
- **Regressziómentesség:** Az OTP, Erste, K&H, CIB és GLS formátumok működése érintetlen, az Erste partnernevek megőrzése automatizált teszttel garantált.

**Negatív / Kockázatok:**
- Ha egy banki kivonaton egy valódi tranzakció leírása közvetlenül egybeesne egy specifikus zárómintával (extrém valószínűtlen), a folytatólagos sorok elvágásra kerülnének. A kulcsszavak körültekintő szűkítése ezt a kockázatot minimalizálja.

## Kapcsolódó
- [ADR-062 (Worker)](../../../worker/docs/DECISIONS.md) — Bankszámlakivonat Határoló Logika és Ékezet-Dekódolási Sorrend
- [Worker GOTCHAS](../../../worker/docs/GOTCHAS.md) — MarkItDown ékezetes zaj és folytatólagos sorok
- [Worker PROMPTS](../../../worker/docs/PROMPTS.md) — `tranzakcio_tetelesites.md` specifikáció
- [A-059: TransactionMatchingCore & Moduláris UI](./A-059-transaction-matching-core-and-modular-ui.md)
- [A-084: NAV Online Számla Cross-Check & Könyvelői Jóváhagyási Kapu](./A-084-nav-crosscheck-approval-gate.md)
