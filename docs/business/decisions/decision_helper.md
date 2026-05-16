# Visibill — Decision Helper

> Opciók elemzése az Open / Partially Decided döntésekhez.
> Formátum: Opciók → Strengths / Weaknesses / Tradeoffs / Assumptions

---

## 001 — Elsődleges Célcsoport (Partially Decided)

**Opció A: KKV cégvezetők (direkt)**
- ✅ Strengths: Egyszerűbb marketing, self-service modell, alacsonyabb support költség
- ❌ Weaknesses: Kisebb ARPU, magasabb churn, tech-képzettségi elvárás
- ⚖️ Tradeoffs: Skálázhatóbb de alacsonyabb revenue/user
- 💡 Assumptions: A cégvezető maga akarja kezelni a pénzügyeit

**Opció B: Könyvelő irodák (B2B)**
- ✅ Strengths: Magasabb ARPU, alacsonyabb churn, sok cég/user, expert felhasználók
- ❌ Weaknesses: Hosszabb sales ciklus, igényesebb funkciókészlet, komplex onboarding
- ⚖️ Tradeoffs: Kevesebb ügyfél de magasabb érték, dedikált support szükséges
- 💡 Assumptions: A könyvelők nyitottak AI-alapú eszközökre

**Opció C: Mindkettő párhuzamosan**
- ✅ Strengths: Szélesebb piac, cross-sell lehetőségek
- ❌ Weaknesses: Fókusz hiánya, két különböző UX igény, bonyolultabb termékstratégia
- ⚖️ Tradeoffs: Nagyobb potenciál de lassabb iteráció
- 💡 Assumptions: Egy termék kiszolgálhat két nagyon eltérő felhasználói bázist

**Ajánlás:** Opció A indulásra (KKV cégvezetők), majd Opció C felé mozdulás ha a termék érett.

---

## 002 — Támogatott Vállalkozási Formák (Open)

**Opció A: Csak kettős könyvvitel (Kft, Bt, Zrt)**
- ✅ Strengths: Szűk fókusz, GL/Mérleg/EK funkciók relevánsak, magasabb ARPU
- ❌ Weaknesses: Kizárja az EV-ket (nagy szegmens)
- 💡 Assumptions: A jelenlegi GL/Beszámoló funkciók csak kettős könyvvitelhez relevánsak

**Opció B: EV-k is (KATA, átalányadó)**
- ✅ Strengths: Nagyobb piac, egyszerűbb funkciókészlet elég nekik
- ❌ Weaknesses: Alacsony ARPU, más adózási logika, GL irreleváns nekik
- 💡 Assumptions: EV-k hajlandóak fizetni szoftverért

**Opció C: Kettős könyvvitel elsődleges, EV "lite" csomag később**
- ✅ Strengths: Nem zár ki senkit, de a fókusz megmarad
- ❌ Weaknesses: Két termékvonalat kell karbantartani
- 💡 Assumptions: Az EV lite-hoz elég a számla+NAV+tranzakció funkció

**Ajánlás:** Opció A (csak kettős könyvvitel) indulásra — a jelenlegi GL, Mérleg, EK funkciók egyértelműen erre épülnek.

---

## 003 — Lokalizáció & Nyelv (Partially Decided)

**Opció A: Csak magyar, nincs i18n**
- ✅ Strengths: Nincs extra fejlesztési költség, egyszerűbb karbantartás
- ❌ Weaknesses: Kizárja a nemzetközi piacot, vegyes DB nevek maradnak
- 💡 Assumptions: A magyar piac elég nagy a növekedéshez

**Opció B: i18n keretrendszer bevezetése (magyar + angol)**
- ✅ Strengths: Nemzetközi terjeszkedés lehetősége, professzionálisabb
- ❌ Weaknesses: Jelentős refaktor, minden szöveg kiemelése, tesztelési költség
- ⚖️ Tradeoffs: 2-3 hét fejlesztés most vs. hónapok később
- 💡 Assumptions: Lesz igény az angol felületre

**Opció C: DB mezőnevek egységesítése angolra, UI marad magyar**
- ✅ Strengths: Technikai adósság csökkentés, jobb fejlesztői élmény
- ❌ Weaknesses: Breaking change, migráció szükséges, worker kód is érintett
- 💡 Assumptions: A vegyes elnevezés problémát okoz a fejlesztésben

**Ajánlás:** Opció A most, Opció B ha nemzetközi terjeszkedés terv lesz. A DB nevek egységesítése (C) alacsony prioritás.

---

## 004 — Árazási Modell & Tier Nevek (Open)

**Opció A: Jelenlegi nevek véglegesítése (salmon/tuna/shark/orca)**
- ✅ Strengths: Egyedi, megkülönböztető, már implementálva
- ❌ Weaknesses: Nem informatív, a felhasználó nem tudja mit kap melyikkel
- 💡 Assumptions: A kreatív nevek vonzóbbak

**Opció B: Funkcionalitás-alapú nevek (Starter/Pro/Business/Enterprise)**
- ✅ Strengths: Iparági standard, azonnal érthető, könnyebb értékesíteni
- ❌ Weaknesses: Generikus, nem egyedi
- 💡 Assumptions: A felhasználók az iparági normákat preferálják

**Opció C: Hibrid — kreatív nevek funkció alcímmel**
- ✅ Strengths: Egyedi brand + érthető funkciólista
- ❌ Weaknesses: Bonyolultabb kommunikáció

**Ajánlás:** Opció B — az ügyfelek gyorsan akarják érteni mit kapnak, a kreatív nevek akadályozhatják az értékesítést.

**Árazási kérdések amiket el kell dönteni:**
- Számla limit tier-enként?
- Cégszám limit tier-enként?
- User szám limit tier-enként?
- Havi/éves fizetés kedvezmény?

---

## 005 — Előfizetés Scope (Open)

**Opció A: User-szintű (jelenlegi)**
- ✅ Strengths: Egyszerű, már implementálva (user_subscriptions.user_id)
- ❌ Weaknesses: Egy user 10 céggel ugyanannyit fizet mint 1 céggel — unfair pricing
- 💡 Assumptions: A legtöbb felhasználó 1-2 céget kezel

**Opció B: Cég-szintű**
- ✅ Strengths: Fair árazás, skálázható, könyvelő irodák számára vonzó
- ❌ Weaknesses: Bonyolultabb billing, migration szükséges
- 💡 Assumptions: A felhasználók hajlandóak cégenként fizetni

**Opció C: User-szintű alap + extra cég felár**
- ✅ Strengths: Kiindulás egyszerű, extra cégek extra bevétel
- ❌ Weaknesses: Bonyolultabb kommunikáció
- ⚖️ Tradeoffs: Legjobb kompromisszum de implementáció bonyolultabb
- 💡 Assumptions: A "base + addon" modell elfogadható

**Ajánlás:** Opció C — rugalmas, fair, és az aktuális user-alapú rendszerre épül.

---

## 007 — Multi-instance Stratégia (Open)

**Opció A: Két instance fenntartása (jelenlegi)**
- ✅ Strengths: Izoláció, különböző ügyfeleknek külön környezet
- ❌ Weaknesses: Dupla karbantartás, Edge Function szinkronizálás, feature drift (már látható!)
- 💡 Assumptions: Két külön ügyfélkör van

**Opció B: Egyetlen instance, feature flag-ek**
- ✅ Strengths: Nincs feature drift, egyszerűbb deploy, egy kódbázis
- ❌ Weaknesses: Migráció szükséges, RLS bonyolultabb
- 💡 Assumptions: Az összes felhasználó egy platformon működhet

**Opció C: Prod + Staging (nem két prod)**
- ✅ Strengths: Standard fejlesztési workflow, tesztelési lehetőség
- ❌ Weaknesses: Staging-en nincs production adat
- 💡 Assumptions: A második instance staging célú

**Ajánlás:** Tisztázni kell a két instance célját, majd valószínűleg Opció B (egyesítés) vagy C (prod+staging) felé haladni. A jelenlegi feature drift (ticket rendszer, member RBAC, P&L oldalak) már problémás.

---

## 010 — Felhasználói Szerepek (Partially Decided)

**Admin vs Owner kérdés:**

**Opció A: Admin = Owner (nincs különbség)**
- ✅ Strengths: Egyszerű, kevesebb edge case, jelenlegi működés
- ❌ Weaknesses: Nincs delegálás — owner mindent maga csinál vagy teljes hozzáférést ad
- 💡 Assumptions: KKV-knél ritkán szükséges a jogosultsági szétválasztás

**Opció B: Admin < Owner (korlátozott admin)**
- ✅ Strengths: Owner delegálhat anélkül hogy teljes kontrollt adna (pl. admin nem törölheti a céget, nem változtathat előfizetést)
- ❌ Weaknesses: Bonyolultabb RBAC logika, több tesztelés
- 💡 Assumptions: A cégvezetők igénylik a differenciált jogosultságokat

**Ajánlás:** Opció A most — a KKV szegmensben ritkán szükséges, és a jelenlegi 2 admin a prod-ban nem indokolja a fejlesztést.

---

## 011 — Member Jogosultsági Határok (Open)

**Opció A: Member = teljes hozzáférés (jelenlegi prod)**
- ✅ Strengths: Egyszerű, nincs RBAC overhead
- ❌ Weaknesses: Érzékeny adatok (bérek, pénztár) mindenki számára láthatók
- 💡 Assumptions: Nincs szükség adatszeparációra a cégen belül

**Opció B: VSWEB modell portolása (Bérek + Házipénztár rejtett)**
- ✅ Strengths: Érzékeny adatok védve, már implementálva VSWEB-ben
- ❌ Weaknesses: Portolási munka szükséges
- 💡 Assumptions: A béradatok érzékenyek

**Opció C: Granularis modul-szintű jogosultság**
- ✅ Strengths: Maximális rugalmasság, enterprise-ready
- ❌ Weaknesses: Komplex implementáció, UX bonyolultabb
- 💡 Assumptions: A felhasználók igénylik a finom jogosultság-kezelést

**Ajánlás:** Opció B — a VSWEB-ben már kész, portolás minimális munka, a béradatok védelme fontos.

---

## 014 — Számla Kiállítás (Open)

**Opció A: Nem — csak nyilvántartás**
- ✅ Strengths: Fókuszált termék, nem versenyez Számlázz.hu / Billingo-val
- ❌ Weaknesses: Hiányzó funkció, felhasználók más eszközt is használnak
- 💡 Assumptions: A felhasználók már van számlázó szoftverük

**Opció B: Igen — saját számla kiállítás**
- ✅ Strengths: All-in-one megoldás, magasabb értékajánlat, magasabb ARPU
- ❌ Weaknesses: NAV adatszolgáltatás implementálása szükséges, compliance kockázat, erős versenytársak
- ⚖️ Tradeoffs: Hatalmas fejlesztési scope vs. magasabb termékérték
- 💡 Assumptions: A felhasználók hajlandóak váltani a meglévő számlázóról

**Opció C: Integráció meglévő számlázókkal (Szamlazz.hu / Billingo API)**
- ✅ Strengths: Nincs compliance kockázat, meglévő felhasználói bázis kiszolgálása
- ❌ Weaknesses: Függőség harmadik féltől, korlátozott kontroll
- 💡 Assumptions: API partnerség lehetséges és stabil

**Ajánlás:** Opció A most, Opció C középtávon. Saját számlázó (B) túl nagy scope az MVP-hez.

---

## 020 — Adó Modul Scope (Open)

**Opció A: Csak nyilvántartás (összegek rögzítése)**
- ✅ Strengths: Alacsony fejlesztési költség, nincs compliance kockázat
- ❌ Weaknesses: Korlátozott értékajánlat
- 💡 Assumptions: A könyvelő/cégvezető maga számolja az adókat

**Opció B: ÁFA bevallás támogatás (kalkuláció + összesítő)**
- ✅ Strengths: Magas hozzáadott érték, a NAV adatokból kiszámolható
- ❌ Weaknesses: Pontosságnak 100%-nak kell lennie, compliance felelősség
- ⚖️ Tradeoffs: Nagy érték de nagy felelősség
- 💡 Assumptions: A NAV + feltöltött számlák lefedik az összes ÁFA tételt

**Opció C: ÁFA + TAO + SZJA kalkuláció**
- ✅ Strengths: Teljes adókezelés, könyvelő irodák számára vonzó
- ❌ Weaknesses: Nagyon komplex, évente változó jogszabályok, nagyon magas karbantartási költség
- 💡 Assumptions: Az adójogi szabályok programozhatóak

**Ajánlás:** Opció A indulásra, Opció B (ÁFA összesítő) következő lépés — a NAV adatokból automatikus ÁFA kalkuláció nagy érték.

---

## 025 — Munkaidő & Szabadság Modul Scope (Partially Decided)

**Opció A: Csak nyilvántartás (jelenlegi)**
- ✅ Strengths: Egyszerű, már implementálva
- ❌ Weaknesses: Nem integrálódik a bér modullal
- 💡 Assumptions: A munkaidő adatokat nem akarják a bérszámfejtéshez használni

**Opció B: Integráció bérszámfejtéssel (óradíj × órák = bérköltség)**
- ✅ Strengths: Automatikus bérköltség kalkuláció, employee_rates tábla már létezik
- ❌ Weaknesses: Precíz adatbevitel szükséges, edge case-ek (túlóra, ünnepnap)
- 💡 Assumptions: Az óradíj × ledolgozott órák elégséges közelítés

**Ajánlás:** Opció A most — a modul 0 rekordos a prod-ban, először használókat kell szerezni.

---

## 026 — Banki Integráció Jövője (Open)

**Opció A: Manuális CSV (jelenlegi)**
- ✅ Strengths: Egyszerű, bankfüggetlen, nincs compliance/PSD2 költség
- ❌ Weaknesses: Manuális munka, nem real-time, felhasználói fegyelem szükséges
- 💡 Assumptions: A felhasználók hajlandóak CSV-t letölteni havonta

**Opció B: Open Banking / PSD2 (pl. Salt Edge, Plaid)**
- ✅ Strengths: Automatikus, real-time, professzionális
- ❌ Weaknesses: Drága (provider díjak), bankonkénti integráció, PSD2 compliance, magyar bankok korlátozott támogatása
- ⚖️ Tradeoffs: Magas értékajánlat de magas fix költség
- 💡 Assumptions: A magyar bankok API-ja megbízhatóan működik

**Opció C: Bank-specifikus CSV parser-ek (formátum felismerés)**
- ✅ Strengths: Olcsóbb mint PSD2, intelligensebb mint sima CSV, nincs API függőség
- ❌ Weaknesses: Bankonként külön logika, formátumváltozás kockázat
- 💡 Assumptions: A banki CSV formátumok relatíve stabilak

**Ajánlás:** Opció A most, Opció C középtávon (intelligens CSV felismerés), Opció B hosszú távon ha a magyar Open Banking érettebbé válik.

---

## 027 — LLM Költség Kezelés (Partially Decided)

**Opció A: Nincs limit (jelenlegi)**
- ✅ Strengths: Egyszerű, nincs user friction, korlátlan AI funkciók
- ❌ Weaknesses: Abuse kockázat, kontrollálhatatlan költségek
- 💡 Assumptions: Az LLM költségek alacsonyak maradnak

**Opció B: Tier-be beépített limit (pl. Starter: 100 AI hívás/hó)**
- ✅ Strengths: Kontrollált költségek, upsell lehetőség
- ❌ Weaknesses: Bonyolultabb UX (limit elérés kommunikáció), felhasználói elégedetlenség
- 💡 Assumptions: A felhasználók elfogadják az AI limitet

**Opció C: Soft limit + figyelmeztető email**
- ✅ Strengths: Nincs hard block, de awareness van, visszaélés detektálható
- ❌ Weaknesses: Nem véd a szándékos abuse ellen
- 💡 Assumptions: A legtöbb felhasználó normálisan használja

**Ajánlás:** Opció C most — monitorozás + figyelmeztető emailek. Ha abuse megjelenik, Opció B-re váltás.

---

## 028 — GDPR & Adatvédelem (Open)

**Opció A: Minimum viable compliance (jelenlegi + policy)**
- ✅ Strengths: Alacsony költség, az alap elemek (RLS, export, audit log) már megvannak
- ❌ Weaknesses: Nincs formális törlési workflow, retention policy hiányzik
- 💡 Assumptions: Rövid távon nem lesz GDPR audit

**Opció B: Teljes GDPR toolkit (törlés, retention, 2FA, DPO)**
- ✅ Strengths: Teljes compliance, enterprise-ready, bizalomépítés
- ❌ Weaknesses: Jelentős fejlesztési költség, jogi tanácsadás szükséges
- 💡 Assumptions: A nagyvállalati ügyfelek GDPR compliance-t igényelnek

**Ajánlás:** Opció A most + Privacy Policy és Adatkezelési Tájékoztató dokumentumok. 2FA és törlési workflow prioritása közepesen magas.

---

## 029 — Mobil Stratégia (Open)

**Opció A: Nincs mobil app (jelenlegi)**
- ✅ Strengths: Nincs extra fejlesztés, fókusz a weben
- ❌ Weaknesses: Konkurensek mobil-first megközelítése
- 💡 Assumptions: A felhasználók desktop-ról dolgoznak

**Opció B: PWA (Progressive Web App)**
- ✅ Strengths: Alacsony költség, egy kódbázis, offline képesség, push notifications
- ❌ Weaknesses: Korlátozott natív funkciók, iOS-en gyengébb
- 💡 Assumptions: A mobilos igények alap szintűek (dashboard, notifications)

**Opció C: Natív app (React Native)**
- ✅ Strengths: Legjobb UX, app store jelenlét, natív funkciók
- ❌ Weaknesses: Külön kódbázis, magas fejlesztési és karbantartási költség
- 💡 Assumptions: A mobil app kritikus az ügyfélszerzésben

**Ajánlás:** Opció B (PWA) — alacsony befektetés, a dashboardok és értesítések mobilon is használhatóak.

---

## 030 — API & Third-party Hozzáférés (Open)

**Opció A: Nincs nyilvános API (jelenlegi)**
- ✅ Strengths: Nincs extra fejlesztés, nincs API biztonsági kockázat
- ❌ Weaknesses: Nincs integráció harmadik fél eszközökkel
- 💡 Assumptions: A felhasználók nem igényelnek API-t

**Opció B: RESTful API (Supabase PostgREST-re építve)**
- ✅ Strengths: Supabase-ből "ingyen" jön, RLS-t használ, alacsony implementációs költség
- ❌ Weaknesses: PostgREST korlátai, rate limiting szükséges, dokumentáció
- 💡 Assumptions: A Supabase RLS elégséges API-szintű biztonsági modellnek

**Opció C: Dedikált API layer (Edge Functions)**
- ✅ Strengths: Teljes kontroll, verzionálás, webhook-ok
- ❌ Weaknesses: Magas fejlesztési költség
- 💡 Assumptions: Van elég fejlesztői kapacitás

**Ajánlás:** Opció A most — nincs azonnali igény. Ha megjelenik a partner integráció szükségessége, Opció B (PostgREST + API kulcsok) a leggyorsabb út.
