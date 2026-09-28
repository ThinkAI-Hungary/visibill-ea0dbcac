# Decision 063: Folyószámla és Analitika Számviteli Szabályzat és Integritás

**Status:** Decided  
**Category:** Accounting Policy / Double-Entry Integrity  
**Date:** 2026-09-28  

---

## 1. Kontextus és Számviteli Követelmények

A számvitelről szóló 2000. évi C. törvény (Sztv.) 165–168. §-ai szerint a kettős könyvvitelt vezető gazdálkodóknak olyan analitikus nyilvántartást kell vezetniük, amely biztosítja a főkönyvi számlák és az analitika mindenkori, hibátlan egyezőségét.
A korábbi működésben fennállt a kockázat, hogy a felhasználók vagy gépi könyvelési folyamatok partner hozzárendelése nélkül rögzítsenek tételeket a 311 (Vevők) vagy 454 (Szállítók) főkönyvi számlákra. Ez főkönyvi forgalmat generált volna anélkül, hogy a tétel megjelenne a partner folyószámláján, megbontva a számviteli egyensúlyt.

Továbbá a napi pénzügyi gyakorlatban a banki átutalások során gyakran keletkeznek 1–10 Ft közötti apró eltérések (banki kerekítések, filléres különbözetek), valamint devizás ügyleteknél teljesítéskori és fizetéskori árfolyam-eltérések, amelyek indokolatlanul nyitva tartanák a folyószámla tételeket.

---

## 2. Üzleti és Számviteli Döntések

### 2.1 Zéró Eltérés Elv (Zero Silent Discrepancy Policy)
1. **Kötelező Partner Kötöttség:** A rendszerben partner megadása nélkül szigorúan tilos lekönyvelni olyan tételt, amely `subledger_type = 'partner'` jelölésű főkönyvi számlát érint (pl. 311*, 454*). Az adatbázis könyvelési eljárása (`acc_post_journal_entry`) hibát dob és megszakítja a tranzakciót, ha a partner hiányzik.
2. **Kizárólagos Könyvviteli Kapcsolat:** A folyószámla nem egy független másodlagos adatbázis, hanem a kettős könyvvitel szerves része. Egy folyószámla tétel pontosan egy könyvelési tételsor (`acc_journal_lines`).

### 2.2 Nyitott Tételek Rendezésének Szabályai
1. **Rendezési Relációk (M:N):**
   - **1:1** – Egyetlen számla és egyetlen banki/pénztári tétel összevezetése.
   - **1:N** – Részletfizetés: egy számla több részletben történő kiegyenlítése.
   - **N:1** – Összevont kifizetés: egyetlen banki átutalási sor több számlát egyenlít ki.
   - **M:N** – Kompenzáció és láncolt összevezetések.
2. **Visszavonhatóság:** A rendezés bármikor felbontható az auditált `unsettle_open_items` eljárással, amely azonnal visszaállítja az eredeti nyitott egyenleget.

### 2.3 Kerekítési Különbözetek Számviteli Kezelése ($\le 10$ Ft)
- Az Sztv. 81. § és 86. § előírásaival összhangban a 10 Ft vagy annál kisebb fennmaradó kerekítési különbözetek nem maradhatnak évekig nyitott követelésként/kötelezettségként.
- A rendszer feljogosítja a könyvelőt az automatikus, 1-kattintásos vegyes bizonylatos leírásra:
  - **Veszteségjellegű kerekítés (ráfordítás):** `8755 Kerekítési különbözet ráfordítás`
  - **Nyereségjellegű kerekítés (bevétel):** `9779 Kerekítési különbözet bevétel`

### 2.4 Realizált Árfolyamkülönbözet Kezelése
- Devizás folyószámla tételek forintos kiegyenlítésekor keletkező árfolyamkülönbözet leírása:
  - **Árfolyamveszteség:** `8762 Pénzügyi műveletek egyéb ráfordításai (árfolyamveszteség)`
  - **Árfolyamnyereség:** `9762 Pénzügyi műveletek egyéb bevételei (árfolyamnyereség)`

### 2.5 Javaslatok és Végleges Könyvelés Kezelése
- Az importált számlák és banki kivonatok a feldolgozás idejére `GEPI_JAVASLAT` státuszt kapnak.
- A folyószámla modul mindkét állapotot megjeleníti, de egyértelmű vizuális jelzéssel („Javaslat” badge), hogy a könyvelő a párosítás során azonnal lássa, mely tételek várnak még jóváhagyásra.

---

## 3. Üzleti Indoklás (Rationale)

- **Auditbiztonság:** A könyvvizsgáló vagy a NAV ellenőrzése során a főkönyvi kivonat és a vevő/szállító analitika fillérre egyezik.
- **Hatékonyság:** Nincs szükség manuális vegyes naplós kontírozásra az apró kerekítések lezárásához.
- **Megbízhatóság:** Az automatikus egyeztető motor kiküszöböli a téves számlapárosításokat.

---

## 4. Kapcsolódó Dokumentumok
- [A-175: Folyószámla és Analitika Architektúra](../../architecture/decisions/A-175-subledger-and-open-items-architecture.md)
- [P-136: Folyószámla és Analitika Kezelőfelület UX](../../product/decisions/P-136-subledger-and-open-items-ux.md)
- [BRD 043: Könyvelési Naplók és Kettős Könyvviteli Folyószámlák](./043-accounting-journals.md)
- [BRD 021: Főkönyvi Rendszer (GL)](./021-general-ledger.md)
