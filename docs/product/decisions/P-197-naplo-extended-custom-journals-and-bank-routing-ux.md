# P-197: Dinamikus Könyvelési Naplók (Napló Extended), Csoportosított Választó és Bankkapcsolat UX

**Status:** Decided  
**Category:** Könyvelés & Banki Utalások / UI & Workflow  
**Question:** Hogyan biztosíthatunk a könyvelők számára korlátlan, rugalmas naplólétrehozást (több bank, pénztár, vegyes), banki számlaszám és deviza alapú útválasztást, miközben a felület áttekinthető marad és a gépi rendszernaplók zároltak?  
**Decision:**
1. **Dinamikus Napló Létrehozó Dialógus (`CreateJournalModal`):**
   - A `JournalsPage` felületen megjelenő `➕ Új napló` gombra kattintva megnyíló modális ablak.
   - A felhasználó kiválasztja a napló kategóriáját (Bank, Pénztár, Vevő, Szállító, Vegyes), megadja a naplókódot (pl. B1, B2, P2, VF, VD, V1), a megnevezést (pl. „K&H EUR devizaszámla”), a pénznemet (HUF, EUR, USD, GBP, CHF stb.), valamint opcionálisan az alapértelmezett ellenszámlát (pl. 3841, 3861).
   - Banknapló esetén kötelező vagy ajánlott a bankszámlaszám / IBAN megadása, amely azonnal összekapcsolódik a cég banki törzsével.
2. **Hierarchikus Csoportosított Naplóválasztó (`GroupedJournalSelector`):**
   - Minden könyvelési és analitikai felületen (kézi tétel rögzítés, számlakontírozás, szűrés) a korábbi lapos naplólista helyett egy elegáns, kategóriák szerint csoportosított komponens jelenik meg:
     - 🏦 **Banknaplók:** (B1 HUF, B2 EUR, Wise, Revolut...) a kapcsolódó számlaszám és deviza badge kijelzésével.
     - 💵 **Pénztárnaplók:** (P1 HUF Főpénztár, P2 Telephely, P3 EUR...)
     - 📑 **Vevő és Szállító Naplók:** Belföldi és devizás számlák különválasztva.
     - ⚖️ **Vegyes Naplók:** Általános könyvelési naplók.
     - 🔒 **Rendszernaplók:** (TE - Tárgyi eszköz, ELH - Időbeli elhatárolás, BER - Bérfeladás, ARF - Árfolyamkülönbözet) lakat ikonnal ellátva, jelezve a gépi integritást.
     - 🏁 **Nyitó és Záró Naplók:** Évnyitási és zárlati tételek.
3. **Rendszernaplók Védelme és Státuszkijelzése:**
   - A gépi naplók nem törölhetők és kódjuk nem módosítható. A táblázatban diszkrét szürke badge és lakat jelzi, hogy ezekbe a modulokba automatikus háttérfolyamatok könyvelnek.
4. **Devizás Nyitott Tétel Párosítási Dialógus (`acc_settle_open_items_with_fx`):**
   - A folyószámla felületen devizás tétel kiegyenlítésekor a felugró ablak automatikusan kiszámítja és megmutatja a realizált árfolyamnyereséget vagy -veszteséget az alkalmazott árfolyamok alapján, és egyetlen kattintással lekönyveli az árfolyamkülönbözeti tételt az `ARF` naplóba.

**Current Implementation:**
- Komponensek: `src/components/journals/CreateJournalModal.tsx`, `src/components/journals/GroupedJournalSelector.tsx`, `src/pages/JournalsPage.tsx`.
- Szolgáltatások: `src/components/journals/services/bankJournalResolver.ts`, `src/lib/journalUtils.ts`.
- Automatizált tesztek: `src/test/accounty/naploExtended.test.ts`.

**Rationale:**
A könyvelők napi munkájában az egyik legnagyobb frusztráció a merev, kötött naplóstruktúra volt, ahol a forintos és devizás banki kivonatok vagy telephelyi kasszák egyetlen ömlesztett naplóban keveredtek. A csoportosított szelektálással és az automatikus bankkapcsolattal a bizonylatok rögzítése gyorsabbá és hibamentessé válik.

## Kapcsolódó
- [A-264: Napló Extended Architektúra](../../architecture/decisions/A-264-naplo-extended-custom-journals-bank-routing-and-fx-settlement.md)
- [BDR 077: Korlátlan Egyedi Könyvelési Naplók Szabályzata](../../business/decisions/077-custom-accounting-journals-system-isolation-and-fx-settlement-policy.md)
