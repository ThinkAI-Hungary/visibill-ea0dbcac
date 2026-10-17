# A-264: Napló Extended — Korlátlan Egyedi Naplótörzs, Céges Bankszámla Útválasztás, Gépi Rendszernapló Védelem és Devizás Folyószámla Különbözet-rendezés

**Status:** Decided  
**Date:** 2026-10-17  
**Utoljára frissítve:** 2026-10-17  

## Context

A könyvelőirodai és vállalati kettős könyvviteli folyamatok során (különösen több devizanemű, több bankszámlával vagy több házipénztárral működő gazdasági társaságoknál) a fix, statikus naplókészlet (egyedi V, SZ, B, P, VE) alkalmatlannak bizonyult a valós számviteli igények kielégítésére:

1. **Hiányzó Rugalmas Naplódefiníció:** A vállalkozásoknak szükségük van több, önálló bankszámlához kapcsolt banknaplóra (pl. B1 HUF K&H, B2 EUR K&H, B3 USD OTP, Revolut, Wise), telephelyi vagy devizás házipénztárakra (P1–P5), valamint speciális forgalmi naplókra (pl. VF - Belföldi vevő, VD - Devizás vevő, SZF - Belföldi szállító, SZD - Devizás szállító, V1–V10 egyedi vegyes naplók).
2. **Banknapló ↔ Bankszámlaszám Elcsatoltság:** Korábban a banki tranzakciók importálásakor vagy az Aggreg8 PSD2 szinkronizáció során a rendszer nem tudta determinisztikusan eldönteni, hogy az adott bankszámlakivonat tételeit melyik könyvelési banknaplóba kell irányítani, ami manuális átsorolást vagy téves kontírozást eredményezett.
3. **Gépi Feladások Keveredése (Contamination Risk):** Az automatikus háttérfolyamatok (számla-autoposter, bérfeladás, tárgyi eszköz aktiválás/ÉCS feladás, időbeli elhatárolások, árfolyamkülönbözet elszámolás) mind a standard Vegyes (`VE`) vagy fix naplókba könyveltek, ahol keveredtek a könyvelő által kézzel rögzített vegyes bizonylatokkal. Ez ellehetetlenítette az automatikus feladások izolált auditálását, tömeges visszavonását és zárlati rekonciliációját.
4. **Devizás Nyitott Tételek Rendezése Árfolyamkülönbözettel:** Ha egy külföldi devizás vevő- vagy szállítószámlát (pl. 1 000 EUR 395 Ft-os árfolyamon = 395 000 Ft) eltérő árfolyamon fizettek ki (pl. 402 Ft = 402 000 Ft), a folyószámla-párosítás nem számolta el automatikusan a realizált árfolyamnyereséget (`976 Pénzügyi műveletek egyéb bevételei`) vagy árfolyamveszteséget (`876 Pénzügyi műveletek egyéb ráfordításai`), ami nyitva maradt forint-különbözeteket és manuális korrekciós igényt eredményezett.

## Decision

1. **Kiterjesztett `acc_journals` Séma és Altípus Rendszer (`sub_type`):**
   - Bővítettük a `public.acc_journals` táblát:
     - `company_bank_account_id UUID REFERENCES public.company_bank_accounts(id) ON DELETE SET NULL`
     - `petty_cash_register_id UUID REFERENCES public.petty_cash_registers(id) ON DELETE SET NULL`
     - `sub_type VARCHAR(32)` (pl. `BANK_HUF`, `BANK_FX`, `PETTY_CASH_HUF`, `DOMESTIC_CUSTOMER`, `FOREIGN_CUSTOMER`, `DOMESTIC_SUPPLIER`, `FOREIGN_SUPPLIER`, `GENERAL_MIXED`, `ASSET`, `FX`, `ACCRUAL`, `PAYROLL`, `OPENING`, `CLOSING`)
     - `default_contra_gl_number VARCHAR(16)` (pl. 3841, 3861, 3811, 3111, 4541, 491, 492)
     - `is_system_locked BOOLEAN NOT NULL DEFAULT false` (rendszernaplók zárolása)
   - Indextámogatás: `idx_acc_journals_company_bank_acc`, `idx_acc_journals_petty_cash_reg`, `idx_acc_journals_company_sub_type`.

2. **Kétirányú Banki Szinkronizációs Triggerek:**
   - `acc_sync_bank_account_to_journal`: amikor a `company_bank_accounts` táblában új számla jön létre vagy módosul a számlaszám/deviza, a trigger automatikusan frissíti a kapcsolt `acc_journals` rekordot.
   - `acc_sync_journal_to_bank_account`: amikor a felhasználó a felületen új Banknaplót vesz fel bankszámlaszámmal, a trigger automatikusan felveszi vagy összeköti a megfelelő `company_bank_accounts` rekordot, garantálva a számlaszám és deviza 100%-os egyezőségét.

3. **Célzott Gépi Rendszernaplók és Autoposter Útválasztás:**
   - Rendszerszinten elkülönítettük az automatikus gépi feladásokat:
     - **Tárgyi eszköz aktiválás és ÉCS:** a dedikált `TE` (Tárgyi eszköz) naplóba irányítva (`is_system_locked = true`, ellenszámla: 571 / 161).
     - **Időbeli elhatárolások (AIE/PIE):** a dedikált `ELH` naplóba irányítva (`is_system_locked = true`, ellenszámla: 391 / 481).
     - **Bérfeladás:** a dedikált `BER` naplóba irányítva (`is_system_locked = true`, ellenszámla: 471).
     - **Árfolyamkülönbözet:** a dedikált `ARF` naplóba irányítva (`is_system_locked = true`, ellenszámla: 876 / 976).
   - A `is_system_locked = true` jelölés megakadályozza a könyvelő általi véletlen törlést vagy kódmódosítást, miközben a felületen a rendszerbizonylatok szűrhetők és elkülöníthetők.

4. **Atomi Devizás Folyószámla-rendezés Árfolyamkülönbözettel (`acc_settle_open_items_with_fx`):**
   - Bevezettük az `acc_settle_open_items_with_fx` tárolt eljárást, amely a devizás számla tétel és a banki kiegyenlítés sor párosításakor:
     - Kiszámolja a kifizetett devizaösszeg számla-árfolyamon (`p_exchange_rate_invoice`) és fizetéskori árfolyamon (`p_exchange_rate_payment`) számított forintértékének különbözetét.
     - Vevőkövetelés esetén: ha a fizetéskori árfolyam magasabb → Árfolyamnyereség (`T 384/386 → K 976`), ha alacsonyabb → Árfolyamveszteség (`T 876 → K 311/316`).
     - Szállítói kötelezettség esetén: ha a fizetéskori árfolyam alacsonyabb → Árfolyamnyereség (`T 454 → K 976`), ha magasabb → Árfolyamveszteség (`T 876 → K 384/386`).
     - Automatikusan létrehozza a kiegyenlítést az `acc_open_item_matches` táblában, lekönyveli az árfolyamkülönbözeti bizonylatot a cég `ARF` vagy `VE` naplójába, és naprakészre állítja a tételek `settled_amount` és `is_settled` mezőit.

5. **Felületi Komponensek:**
   - `CreateJournalModal`: új napló felvétele kategória, típus, devizanem, bankszámlaszám és alapértelmezett ellenszámla megadásával.
   - `GroupedJournalSelector`: hierarchikus, kategóriák szerint csoportosított naplóválasztó (Bankok, Pénztárak, Vevők, Szállítók, Vegyes, Rendszernaplók, Nyitó/Záró).
   - `JournalsPage.tsx`: kategória tabok, rendszerzárolt naplók védett megjelenítése, és az időrendi sorszámozás auditálása.

## Consequences

**Pozitív:**
- **Skálázhatóság több bankszámla és deviza esetén:** Egy tetszőlegesen komplex (5 HUF bank, 3 EUR bank, 2 Revolut) vállalkozás könyvelése tisztán, külön banknaplókban kezelhető.
- **Zéró keveredés:** A kézi vegyes könyvelés soha többé nem szennyeződik be bérfeladásokkal vagy ÉCS leírásokkal.
- **Automatikus árfolyamkülönbözet:** Nincs szükség manuális évközi árfolyam-számolgatásra; a devizás kifizetés lekönyvelésekor azonnal létrejön a törvényi forint-egyenleg.
- **Determinisztikus bankimport:** A feltöltött bankkivonat számlaszáma alapján az import automatikusan a megfelelő banknaplóba rendeli a tételeket.

**Negatív / Kockázatok:**
- A kategóriák és altípusok bevezetése szigorúbb adatkonzisztenciát követel meg a frontend komponensektől (nem elég csak a `type` stringet átadni).
- Meglévő adatbázisoknál gondoskodni kellett a korábbi `V`, `SZ`, `B1`, `P1`, `VE` naplók automatikus migrációjáról és a bankkapcsolatok visszakötéséről (`20261017120000`).

## Kapcsolódó
- [A-057: Könyvelési Napló Architektúra](./A-057-accounting-journals-architecture.md)
- [A-188: Dinamikus Könyvelési Naplók Létrehozása és Bankszámla-összerendelés](./A-188-dynamic-accounting-journals-management-and-bank-linking.md)
- [A-230: Könyvelési Naplók Kategorizálása és Tételsori Partner Relációk](./A-230-journal-categorization-and-line-partners.md)
- [P-197: Dinamikus Könyvelési Naplók (Napló Extended) és Bankkapcsolat UX](../product/decisions/P-197-naplo-extended-custom-journals-and-bank-routing-ux.md)
- [BDR 077: Korlátlan Egyedi Könyvelési Naplók és Rendszernapló Védelem](../../business/decisions/077-custom-accounting-journals-system-isolation-and-fx-settlement-policy.md)
