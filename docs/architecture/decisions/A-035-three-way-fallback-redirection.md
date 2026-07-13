# A-035: Háromirányú Szekvenciális Pipeline Átirányítás (Invoice ↔ Transaction ↔ Report) és Hibakezelés

**Status:** Decided
**Date:** 2026-07-11
**Utoljára frissítve:** 2026-07-13

## Context
Az e-mail aliasokról (webhookon keresztül) érkező dokumentumok besorolása a webhook / edge function szinten időnként pontatlan (pl. táblázatos futárjelentések vagy bankszámlakivonatok számlaként futnak be). Emiatt a workernek képesnek kell lennie a rossz pipeline-on elindult dokumentumok azonnali átirányítására a megfelelő cél-pipeline-ra.

Két fontos technikai kihívást kellett megoldani:
1. **Háromirányú skálázódás:** A korábbi kétirányú (Invoice ↔ Transaction) fallback helyett támogatni kellett a futár Riport (Report) pipeline-t is, illetve proaktív és szekvenciális (próba-szerencse) módszerrel kellett kiválasztani a helyes parsert a struktúrálatlan fájlokhoz.
2. **Duplikáció & Beragadás megelőzése:** A fallback során a sikertelen kísérletek nem hagyhatnak hátra inkonzisztens/duplikált rekordokat, és a sikeresen lefutott bizonylatok `job completed` bejegyzései nem jelenhetnek meg hibaként a felületen.
3. **Kézi újraküldés (Retry) inkonzisztencia:** Ha a felhasználó egy hibás fájlt egy másik pipeline-ba küldött vissza (pl. számlából tranzakcióba), a worker nem találta a rekordot a céltáblában (ValueError: transaction_upload record not found), mert a fájl rekordja még a forrástáblában (`invoice_uploads`) szerepelt.

## Decision

**1. Háromirányú szekvenciális fallback (Sequential Try):**
Bármelyik pipeline-ba is érkezik a bizonylat, a worker proaktív módon (fájlnév és kiterjesztés alapján), vagy szekvenciálisan (kipróbálva a GLS, MPL, Mixpack riportokat és a Tranzakciókat) átirányítja a folyamatot. Az első sikeres parser lefutása határozza meg a cél-pipeline-t.

**2. Tranzakciós tisztaság (Clean-on-Failure):**
A fallback próbálkozások alatt létrejövő ideiglenes célrekordokat a kód azonnal kitörli, ha az adott pipeline-on a feldolgozás meghiúsult. A kiinduló (hibás) szülő rekordot pedig csak akkor törli ki, ha a cél-pipeline-on a bizonylat sikeresen lefutott, vagy ha az összes lehetséges pipeline kísérlet véget ért (így a végső hibás állapot is csak egyetlen céltáblában jelenik meg).

**3. "Job completed" sikeres üzenet szűrése a frontend és backend oldalon:**
A sikeresen feldolgozott bizonylatok `error_message` oszlopa a naplózás miatt `"job completed"` értéket kap.
- **Backend (`management-stats` EF):** Az `isError` és `isSuccess` kiértékelésénél a `"job completed"` és `"Job completed."` üzenetek ki vannak zárva a hibák közül, így a statisztikák helyesek.
- **Frontend (`ManagementDashboard.tsx`):** A `normalizeStatus` függvény szintén figyelmen kívül hagyja a `"job completed"` státuszüzeneteket, megelőzve, hogy a sikeresen lefutott fájlok piros "Hiba" badge-dzsel jelenjenek meg.

**4. Memóriabeli (in-memory) fallback loop-védelem:**
A fallback hívások során a worker szekvenciálisan futtatja a többi pipeline-t in-memory létrehozott `new_job` paraméterekkel. Annak érdekében, hogy a többi handler felismerje, hogy már egy fallback lánc része (és ne indítson újabb felesleges fallback köröket, ami rekord-duplikációt eredményezne), a `new_job` szótárban kötelező továbbítani az eredeti szülő objektum fallback azonosítóját (`fallback_from_invoice_upload_id`, `fallback_from_transaction_upload_id`, vagy `fallback_from_report_upload_id`).

**5. Kézi újraküldés cross-pipeline tábla-migrációval (Manual Cross-Pipeline Retry):**
A Management Dashboard felületén lehetőség van a sikertelen / hibás bizonylatok kézi újraküldésére tetszőleges cél-pipeline-ba (Invoice, Transaction, Report).
Ha a cél-pipeline eltér a bizonylat jelenlegi forrástáblájától (pl. egy `invoice_uploads`-ban lévő hibás GLS fájlt a felhasználó `report_jobs` (Report) queue-ba küld vissza), a Deno Edge Function (`retryErrors`) egy atomi migrációs folyamatot hajt végre:
- Lekéri a teljes rekordot a forrástáblából.
- Beszúrja a céltáblába (`transaction_uploads` vagy `report_uploads`), megtartva az eredeti UUID azonosítót.
- Kitörli a rekordot a forrástáblából.
- Ha a beszúrás vagy törlés hibára fut, a folyamat automatikusan visszaállítja (insert vissza a forrásba) az adatvesztés elkerülésére.
- Enqueue-olja a PGMQ üzenetet a cél-queue-ba a megváltoztatott forrás megjelöléssel.
Ez biztosítja, hogy a worker a megfelelő céltáblában keresse és megtalálja a rekordot, és megmaradjon a kliens oldali UUID folytonosság.

## Consequences
**Pozitív:**
- Teljesen automata típusfelismerés és átirányítás a 3 legfontosabb pipeline (Invoice, Transaction, Report) között.
- Zero duplikált vagy beragadt rekord a Supabase-ben sikertelen fallback esetén.
- Pontos és tiszta frontend visszajelzés: a sikeres bizonylatok valóban zöld "Feldolgozva" állapotban jelennek meg.
- A kézi újraküldések zökkenőmentesek és nem okoznak "record not found" hibákat a Python workerben.

**Negatív:**
- A szekvenciális próbálkozás (amikor 3-4 parser is lefut egymás után egy hibás fájlon) több másodperccel megnövelheti az egyedi fájl feldolgozási idejét. Ez a pontosság érdekében elfogadható trade-off.

## Kapcsolódó
- [A-004: PGMQ mint aszinkron queue](./A-004-pgmq-queue.md)
- [A-019: Management Dashboard architektúra](./A-019-management-dashboard.md)
