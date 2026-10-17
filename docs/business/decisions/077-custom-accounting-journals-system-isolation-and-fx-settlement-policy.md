# Decision 077: Korlátlan Egyedi Könyvelési Naplók, Rendszernapló Védelem és Devizás Folyószámla Különbözet-rendezés Számviteli Szabályzata

**Dátum:** 2026-10-17  
**Státusz:** ✅ Decided  
**Kategória:** Számla Kezelés / Kettős Könyvvitel & Számviteli Szabályzat  
**Szerző:** Áron & Antigravity  
**Érintett modulok:** Könyvelési Naplók (`JournalsPage.tsx`), Naplókezelő Modál (`CreateJournalModal`), Folyószámla Párosítás (`acc_settle_open_items_with_fx`), Banki Szinkronizáció (`acc_journals` / `company_bank_accounts`)  
**Kapcsolódó döntések:** [043](./043-accounting-journals.md), [063](./063-subledger-and-open-items-accounting-policy.md), [A-057](../architecture/decisions/A-057-accounting-journals-architecture.md), [A-264](../architecture/decisions/A-264-naplo-extended-custom-journals-bank-routing-and-fx-settlement.md), [P-197](../product/decisions/P-197-naplo-extended-custom-journals-and-bank-routing-ux.md)

---

## 1. Számviteli Háttér és Jogszabályi Hivatkozás

A számvitelről szóló 2000. évi C. törvény (Sztv.) 165–168. §-ai rendelkeznek a bizonylati elvről és a bizonylati fegyelemről:
- A kettős könyvvitelt vezető gazdálkodó a gazdasági műveletekről alap- és összesítő bizonylatot köteles kiállítani, és azokat időrendi sorrendben (időrendi számla / napló) és rendszerezett nyilvántartásban (számlatükör szerinti főkönyv) kell rögzítenie.
- Az Sztv. 84. § (7) bek. h) pontja és a 85. § (3) bek. c) pontja alapján a devizás követelések és kötelezettségek pénzügyi rendezésekor keletkező árfolyamnyereséget a pénzügyi műveletek egyéb bevételei (976), az árfolyamveszteséget pedig a pénzügyi műveletek egyéb ráfordításai (876) között kötelező elszámolni.

A gyakorlati könyvelésben felmerülő kihívások:
1. Egy gazdálkodó több hazai és nemzetközi bankszámlával (HUF, EUR, USD, Wise, Revolut), valamint több házipénztárral rendelkezhet, melyek forgalmát elkülönített naplókban kell vezetni a belső ellenőrzés és banki egyeztetés végett.
2. A szoftver által automatikusan generált könyvelések (tárgyi eszköz leírás, időbeli elhatárolás, bérfeladás) nem keveredhetnek a könyvelő által kézzel rögzített vegyes bizonylatokkal, mert zárlatkor vagy hiba esetén lehetetlen a tételek izolált vizsgálata és tömeges javítása.

---

## 2. Üzleti és Számviteli Szabályok

### 1. Korlátlan Egyedi Naplótörzs Kezelés
- A cég könyvelője jogosult tetszőleges számú, egyedi kódolású és megnevezésű naplót létrehozni:
  - **Banknaplók:** `B1`–`B10`, illetve egyedi kódok (pl. `WISE`, `REV`).
  - **Pénztárnaplók:** `P1`–`P5` (pl. Főpénztár, Valutapénztár, Telephelyi kasszák).
  - **Vevő és Szállító Naplók:** `VF` (Belföldi vevő), `VD` (Devizás vevő), `SZF` (Belföldi szállító), `SZD` (Devizás szállító), valamint további projektnaplók.
  - **Vegyes Naplók:** `VE`, `V1`–`V10` általános kézi és korrekciós könyvelésekhez.
- Minden naplóhoz rögzíthető az alapértelmezett devizanem (`currency`) és a preferált ellenszámla (`default_contra_gl_number`).

### 2. Banknapló és Céges Bankszámla Integráció
- Ha a könyvelő Banknaplót rögzít vagy módosít bankszámlaszámmal, a rendszer automatikusan szinkronizálja vagy létrehozza a cég bankszámláját a `company_bank_accounts` törzsben.
- A banki kivonatok importálásakor és az Aggreg8 PSD2 folyamatban a rendszer a számlaszám és deviza alapján determinisztikusan a hozzárendelt banknaplóba könyvel, megszüntetve a manuális átkönyvelési igényt.

### 3. Gépi Rendszernaplók Védettsége (Hard System Isolation)
- A gépi folyamatok számára dedikált, rendszerzárolt naplók működnek:
  - `TE` — Tárgyi eszköz aktiválás és értékcsökkenési leírás
  - `ELH` — Aktív és passzív időbeli elhatárolások (AIE/PIE)
  - `BER` — Havi bérszámfejtési feladások (471)
  - `ARF` — Folyószámla és fordulónapi árfolyamkülönbözetek (876/976)
- Szabály: Ezek a naplók `is_system_locked = true` védelmet élveznek. A felhasználó felületről nem törölheti őket, kódjuk nem módosítható, és manuális bizonylatrögzítés alapesetben nem engedélyezett bennük.

### 4. Devizás Folyószámla-rendezés Árfolyamkülönbözettel
- Devizás nyitott tétel (vevő vagy szállító) és banki kifizetés összerendelésekor a rendszer kötelezően alkalmazza az Sztv. 84/85. § szerinti árfolyamkülönbözet kalkulációt:
  - $\text{Különbözet (HUF)} = \text{Fizetett devizaösszeg} \times (\text{Fizetéskori árfolyam} - \text{Számla-árfolyam})$
  - A rendszer automatikusan kiállítja a külön bizonylatot az `ARF` naplóba a megfelelő 976 (nyereség) vagy 876 (veszteség) főkönyvi számlára.
  - A számla nyitott forintértéke ezzel maradéktalanul nullázódik, elkerülve a „fantom filléres” kintlévőségeket.

---

## 3. Hatás és Ellenőrizhetőség

* **MKVK Könyvvizsgálói Megfelelőség:** A naplók pontos elhatárolása megfelel az ISA 500-as könyvvizsgálói audit követelményeknek.
* **Audit Naplózás:** Minden naplólétrehozás, módosítás és árfolyamkülönbözet tétel az `acc_journal_audit_logs` táblában rögzítésre kerül az operátor felhasználói azonosítójával és időbélyegével.
