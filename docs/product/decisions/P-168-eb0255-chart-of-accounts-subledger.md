# P-168: Egységes Számlatükör, Cégek Közötti Másolás és Folyószámla Kényszer (EB-0255)

**Státusz:** ✅ Decided  
**Dátum:** 2026-10-08  
**Kategória:** UX / Főkönyv / Folyószámla / Számlatükör / eaisyBooks  
**Ügyféligény:** EB-0255 (Lendvai Ádám · Ván Iroda / Kolos Transport Kft., spec: `tests/docs/lendvai_feature/255.pdf`)  
**Kapcsolódó ADR:** [A-229: Egységes Számlatükör Cégenként, Cégek Közötti Klónozás és Folyószámla Szabályrendszer](../../architecture/decisions/A-229-eb0255-single-active-coa-and-subledger-enforcement.md)  
**Kapcsolódó korábbi döntések:** [P-105: Főkönyvi Kivonat és Fa Nézet](./P-105-general-ledger-toolbar-and-expand-collapse-ux.md), [P-108: Többdevizás Számlatükör](./P-108-multicurrency-chart-of-accounts-and-gl-card-ux.md), [P-136: Folyószámla és Nyitott Tételek Kezelése](./P-136-subledger-and-open-items-ux.md), [P-139: Egyedi Számlatükör Kezelés](./P-139-custom-chart-of-accounts-unused-account-deletion-ux.md)

---

## 1. Döntési Kontextus és Ügyféligény (EB-0255)

A Lendvai Ádám (Ván Iroda / Kolos Transport Kft.) által benyújtott **EB-0255** fejlesztési kérelem célja az volt, hogy a könyvelőirodák számára a számlatükör és az analitikus folyószámla-kezelés teljesen átláthatóvá váljon, és kizárja az analitika elcsúszását:
1. **Egyetlen aktív számlatükör cégenként:** A rendszer ne keverje a sablonokat (pl. standard vs. saját), a könyvelő pontosan lássa, melyik az aktív számlatükör, és legyen 1-kattintásos lehetőség egy másik már beállított cég számlatükrének és paramétereinek átvételére/másolására.
2. **Csoportszámla vs. Könyvelési számla megkülönböztetés:** A felületen egyértelmű vizuális jelöléssel kell elkülöníteni a gyűjtő/csoportszámlákat (pl. 31, 45, amelyekre könyvelni tilos) a közvetlenül könyvelhető tételszámláktól (pl. 311, 454).
3. **Partnerkényszeres folyószámla-beállítás:** Olyan főkönyvi számoknál (pl. 311 Belföldi vevők, 454 Belföldi szállítók), ahol ez be van jelölve, a rendszer mind a felületen (vegyes napló rögzítéskor), mind adatbázis szinten megkövetelje a partner kiválasztását.
4. **"Egyéb" folyószámla típus:** A személyenkénti / szerződésenkénti analitikát igénylő főkönyvi számlákhoz (pl. 451 Tagi kölcsönök, hitelek, letétek), ahol a tételhez nem feltétlenül külső partnerkapcsolat, hanem belső személyi analitika és nyitott tételes párosítás tartozik.
5. **Folyószámla modul tisztasága:** A Folyószámla modul (`/subledger`) számlaválasztójában kizárólag a valóban nyitott tételes / párosítható analitikus számlák jelenjenek meg; a gyűjtő csoportszámlák és a nem analitikus számlák szűrésre kerüljenek.

---

## 2. Felületi Megvalósítás (UX Architecture)

### 2.1 Cégek Közötti 1-Kattintásos Számlatükör Másolás (`CopyChartOfAccountsModal`)
* **Elhelyezés:** A Főkönyvi Kivonat és Számlatükör eszköztárán (`GlToolbar`) a Számlatükör beállítások lenyíló menüben új pont: **„Számlatükör másolása másik cégből...”** másolás ikonnal (`Copy`).
* **Modál működése:**
  * Megjeleníti a célvállalat nevét.
  * Legördülő választóban listázza azokat a forrás cégeket, amelyek rendelkeznek aktív számlatükörrel és legalább 1 rögzített számlaszámmal, zárójelben feltüntetve a forrás számlaszámok darabszámát (pl. *Kolos Transport Kft. (1645 számlaszám)*).
  * Figyelmeztető sáv: tájékoztatja a felhasználót, hogy a másolás új aktív számlatükörként jön létre a célvállalatnál a meglévő analitika és hierarchia sértetlenségével.
  * **„1-kattintásos átmásolás”** gomb: meghívja a háttérbeli `acc_copy_chart_of_accounts` Postgres RPC függvényt, ami leklónozza a teljes fa-struktúrát, a mérleg/eredménykimutatás hozzárendeléseket és azonnal aktívvá teszi.

### 2.2 Új és Meglévő Számlaszám Szerkesztése (`GlAccountFormFields`, `EditGlAccountModal`)
* **Egységes űrlap-komponens:** A számlaszám hozzáadása (`AddGlAccountModal`) és módosítása (`EditGlAccountModal`) mostantól ugyanazt a robusztus, jól típusos komponenst használja.
* **Számla jellege (Radio Group):**
  * *Könyvelési számla (analitikus)*: Közvetlenül könyvelhető tételsorok rögzítésére szolgál.
  * *Csoportszámla (gyűjtő)*: Alszámlák összesítésére szolgál, közvetlen könyvelés blokkolva.
* **Folyószámla és analitika típus (Select):**
  * *Nincs folyószámla*: Nem analitikus, általános tétel.
  * *Partnerhez kötött (Partnerkényszer)*: Kötelező partner megadása (pl. 311 Vevők, 454 Szállítók). Figyelmeztető kék információs kártya jelenik meg alatta.
  * *Egyéb analitika*: Személyenkénti / tételenkénti nyilvántartás (pl. 451 Tagi kölcsönök).
* **Nyitott tételes párosítás kezelése (Checkbox):**
  * Bekapcsolásával a számla megjelenik a Folyószámla modulban párosítható számlaként. Partnerkényszer vagy Egyéb analitika kiválasztásakor az űrlap automatikusan bekapcsolja, de kézzel is felülbírálható.
* **Gyors szerkesztés a Főkönyvi Kivonat táblázatból:**
  * Mind a fa nézetben, mind a lista és összesítő nézetekben a sorok végén megjelenik a `[ Settings2 ]` beállító gomb, amely közvetlenül megnyitja az adott számlaszám `EditGlAccountModal` ablakát.
  * Az analitikus tételek oldalsó betekintő paneljén (`Sheet`) szintén elérhető a `[ Szerkesztés ]` akciógomb.

### 2.3 Csoportszámla és Analitika Jelvények a Táblázatban (`GeneralLedgerTable`)
* **Vizuális badge-ek:**
  * `Csoport`: Szürke, kiemelt feliratú badge az összesítő gyűjtőszámláknál.
  * `Partner`: Kék színű badge a partnerkényszeres számláknál (pl. 311, 454).
  * `Egyéb analitika`: Lila színű badge az egyéb analitikus számláknál (pl. 451).
  * `Párosítható`: Zöld színű badge a nyitott tételes párosításra kijelölt számláknál.

### 2.4 Kényszerek Érvényesítése a Vegyes Naplóban (`AddManualJournalEntryModal`)
* **Csoportszámla blokkolás:** Ha a könyvelő véletlenül egy csoportszámlát választ ki rögzítéskor (akár a kereső popoverben, akár mentéskor), a rendszer piros hibaüzenettel azonnal megállítja: *„A(z) [szám] egy csoportszámla (gyűjtő), közvetlen könyvelés nem megengedett. Kérjük, válasszon könyvelési számlát!”*.
* **Partnerkényszer ellenőrzés:** Ha a kiválasztott főkönyvi szám `subledger_type === 'partner'`, a rendszer megköveteli a partner kitöltését: *„A(z) [szám] főkönyvi számlánál partnerkényszeres folyószámla van beállítva. Kérjük, válasszon partnert a bizonylathoz!”*.

### 2.5 Folyószámla Modul Szűrése (`SubledgerPage`, `useSubledgerAccounts`)
* A Folyószámla modulban (`/subledger`) a számlaválasztó szigorúan kiszűri a csoportszámlákat (`account_type !== 'group'`), így kizárólag a valós folyószámla-tételek jelennek meg.
* A lenyílóban minden számla mellett megjelenik a jellege: `[Partner]` vagy `[Egyéb]`.
