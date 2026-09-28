# P-131: Horvát Minimax Számla-közvetítő Integráció és Szinkronizáció UX

* **Dátum:** 2026-09-28
* **Státusz:** Elfogadva (Accepted)
* **Környezet:** Eaisybill / Horvát Felhasználói Élmény és Beállítások
* **Kapcsolódó döntések:** [P-049](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/product/decisions/P-049-nav-sync-dialog-ux.md), [P-081](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/product/decisions/P-081-eaisybill-croatia-localization-and-demo-ux.md), [P-130](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/product/decisions/P-130-croatian-eporezna-vat-xml-export-pdv-s-and-zp-ux.md)

---

## 1. Felhasználói Igény és Célkitűzés

A horvát könyvelők és cégvezetők számára az eaisybill felületén természetes és elvárt, hogy a magyar NAV helyett a Horvátországban elterjedt közvetítői számlázó/közvetítő rendszerekkel (Minimax API) szinkronizálhassanak.
A cél az volt, hogy:
1. Az **Integrációk** felületen horvát cégeknél a magyar NAV kártya helyett automatikusan a Minimax API kártya jelenjen meg.
2. A számlák listáján a szinkronizálás gomb szövege és dialógusa horvát kontextushoz igazodjon ("Minimax szinkronizálás").
3. Lehessen szűrni a számlák irányára (Kimenő / Bejövő / Mindkettő).
4. Átlátható legyen a kapcsolat állapota és a szinkronizálási napló.

---

## 2. Felületi Elemek és Viselkedés

### 2.1. Integrációk Oldal (`/integrations?tab=minimax`)
* **Bal oldali navigáció:** Horvát cégeknél (`country_code = 'HR'`) az "Integrációk" menüben megjelenik a **Minimax API Számlaszinkron** menüpont ("Közvetítői REST kapcsolat" felirattal és állapottal).
* **Minimax Beállítások Kártya:**
  * **Kapcsolati kártya:** Zöld jelvény élő kapcsolat esetén, szervezet neve, utolsó szinkronizáció és validálás időpontja.
  * **Hitelesítési űrlap:** Felhasználónév, külső alkalmazás jelszó, szervezet ID és név megadása.
  * **Kapcsolat tesztelése gomb:** Azonnal ellenőrzi a kapcsolatot és felderíti a kapcsolt Minimax szervezeteket.
  * **Szimulált tesztmód kapcsoló:** Lehetővé teszi a tesztelést életszerű adatokkal még az éles Minimax fejlesztői fiók megérkezése előtt.
  * **Szinkronizálási napló fül:** Részletes előzmények az egyes szinkronizációkról (időpont, irány, letöltött és mentett számlák száma, időtartam, hibák).

### 2.2. Számlák Fejléc és Szinkron Dialógus
* **Fejléc gomb:**
  * Magyar cégnél: *"NAV szinkronizálás"*.
  * Horvát cégnél: *"Minimax szinkronizálás"* (indigo akcentussal és tooltip magyarázattal).
* **Minimax Szinkronizációs Dialógus:**
  * **Irány választó:** Mindkettő / Kimenő (Izlazni) / Bejövő (Ulazni).
  * **Időszak választó:** 30 nap / 60 nap / 90 nap / Teljes év gyorsgombok + naptári választó.
  * **Élő állapotjelző:** Haladási sáv és státuszüzenet szinkronizálás közben.

---

## 3. Minőségbiztosítás és Eredmények

* **Teljes Kétnyelvűség (HR / HU i18n):**
  * Minden felirat, menüpont, súgó, dialógus mező és toast értesítés zökkenőmentesen elérhető horvát (`hr`) és magyar (`hu`) nyelven is.
* **Többoldalas Szinkronizáció:**
  * Nagy számlavolumen esetén a háttér automatikusan lapoz, a felhasználó valós idejű toast visszajelzést kap a letöltött és mentett számlák pontos darabszámáról.
* Típusbiztos TypeScript implementáció (`npx tsc --noEmit` hibamentes).
* Vercel React Best Practices szerinti tiszta állapotkezelés és lekérdezések.
* A magyar cégek NAV szinkronizációja érintetlen maradt és teljes biztonságban működik.
