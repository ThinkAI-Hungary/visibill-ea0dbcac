# P-124: Kapcsolt Vállalkozások Kezelése és Forgalmi Kimutatása a Partnertörzsben (UX/UI)

**Állapot:** Elfogadva (Accepted)  
**Dátum:** 2026-09-27  
**Döntéshozó:** Product & Design Team  
**Kapcsolódó döntések:** P-044, P-058, A-165, A-024  

---

## 1. Döntési Kontextus

A magyar számviteli (Sztv.) és adójogszabályok (Tao. tv., Art.) szerint a kapcsolt vállalkozásokkal (anyacég, leányvállalat, testvérvállalat, közös tulajdonosi érdekeltség) folytatott ügyletek kiemelt figyelmet igényelnek:
1. **Elkülönített könyvelési nyilvántartás:** A kapcsolt vállalkozásokkal szembeni követeléseket (312 Vevők) és kötelezettségeket (455 Szállítók), valamint árbevételeket (912) a független piaci partnerektől elkülönítve kell nyilvántartani.
2. **Készpénzfizetési korlát (Art. 114. §):** Kapcsolt vállalkozások között a havi készpénzes kifizetések összege nem haladhatja meg az 1,5 millió Ft-ot (ellenkező esetben 20%-os bírság terheli a feleket).
3. **Transzferár nyilvántartás (Tao. tv. 18. §):** Az éves ügyleti érték (100M Ft / 50M Ft) figyelése kötelező a transzferár dokumentációs kötelezettség miatt.

A cél egy átlátható, zökkenőmentes felületi élmény megvalósítása a Partnertörzsben ([`PartnersPage.tsx`](../../src/pages/PartnersPage.tsx)).

---

## 2. Felületi Élmény és UX Tervezés

### 2.1 Partner Szerkesztő / Létrehozó Dialógus Bővítése
A partner űrlapon a meglévő egyszerű "Kapcsolt vállalkozás" kapcsoló egy teljes értékű, kinyíló konfigurációs panellé válik:
* **Kapcsolt vállalkozás státusz (Switch):** Be/kikapcsolható.
* **Kapcsoltság jellege (Select):**
  * `parent` — Anyavállalat
  * `subsidiary` — Leányvállalat
  * `sister` — Közös vezetésű / Testvérvállalat
  * `owner_interest` — Többségi tulajdonos egyéb érdekeltsége
  * `other` — Egyéb kapcsolt viszony
* **Tulajdoni részesedés (%) (Input, opcionális):** Pl. `75.00%`.
* **Érvényesség kezdete és vége (`valid_from`, `valid_to`):** Dátumválasztó (év közbeni kapcsoltsági változások pontos követéséhez).
* **Cégcsoport / Anyacég összerendelés (`parent_partner_id`):** Opcionálisan kiválasztható egy másik partner a törzsből (pl. holdingközpont vagy anyavállalat), így a partnerek hierarchiába szervezhetők.
* **Egyedi kapcsolt főkönyvi számla (`custom_gl_account_id`):** Opcionálisan felülírható az automatikus számlatükör feloldás (pl. egyedi 3121 vagy 4551 alszámla rögzítése).

---

### 2.2 Felső Pill Navigáció a Partnertörzsben
A `PartnersPage.tsx` fejlécében megjelenik a tabos pill navigáció:
* **Partnerek listája (`partners`):** A megszokott partnertörzs táblázat, ahol a kapcsolt partnereket az eddiginél informatívabb borostyán színű badge jelöli (kapcsoltsági típussal kiegészítve).
* **Kapcsolt Vállalkozások Forgalma (`related_turnover`):** Dedikált forgalmi és egyenlegkimutatási nézet.

---

### 2.3 Kapcsolt Vállalkozások Forgalmi Kimutatása (`RelatedPartyTurnoverTab.tsx`)
A kimutatás nézet a következő funkciókat tartalmazza:
1. **Időszak választó:** Naptári év (pl. 2026, 2025) és egyedi dátumtartomány szűrő.
2. **KPI Összesítő Kártyák:**
   * **Összes kapcsolt forgalom:** Nettó és bruttó forgalom (Vevői árbevétel + Szállítói beszerzés).
   * **Kimenő értékesítés:** Összes kiszámlázott forgalom kapcsolt partnerek felé (312/912).
   * **Bejövő beszerzés:** Összes befogadott számla kapcsolt partnerektől (455).
   * **Nettó szaldó:** Vevőkövetelés − Szállítói tartozás egyenleg.
   * **Havi készpénzforgalom figyelő (Art. 114. §):** Aktuális havi készpénzmozgás, kiemelt riasztással ha megközelíti vagy eléri a havi 1,5M Ft-os limitet.
   * **Transzferár küszöb indikátor (Tao 18. §):** Mutatja az éves 100M Ft-os határ elérését.
3. **Részletes Összesítő Táblázat:**
   * Partner neve, adószáma, kapcsoltság típusa, tulajdoni %.
   * Kimenő számlák száma és összege (nettó, áfa, bruttó).
   * Bejövő számlák száma és összege (nettó, áfa, bruttó).
   * Nyitott szaldó (kiegyenlítetlen egyenleg).
   * Havi készpénzes kifizetés összege.
   * Sorra kattintva: a partner kapcsolt számláinak lenyíló vagy részletes listája.
4. **Excel / CSV Export:** Egy kattintásos letöltés a transzferár dokumentáció és könyvvizsgálat alátámasztására.

---

### 2.4 Partner Részletező Jobb Oldali Panel
Amikor egy kapcsolt partner van kiválasztva a listában:
* Kiemelt **Kapcsolt vállalkozás** információs kártya a cégadatok felett (típus, tulajdoni %, érvényesség, kapcsolt anyacég).
* **Kapcsolt forgalmi összefoglaló widget:** Az adott partnerrel lebonyolított forgalom, nyitott egyenleg és készpénzes kifizetések.

---

## 3. Kapcsolódó Dokumentáció és Döntések
- [A-165: Kapcsolt Vállalkozások Adatmodell, Forgalmi Lekérdezések és Kontírozási Integráció](../../architecture/decisions/A-165-related-parties-schema-and-accounting-integration.md)
- [21-master-data: Törzsadatok Adatbázis Séma](../../architecture/database/21-master-data.md)
- [P-044: Külföldi Partnerek és Szintetikus Adószámok Megjelenítése](./P-044-foreign-partner-display.md)
