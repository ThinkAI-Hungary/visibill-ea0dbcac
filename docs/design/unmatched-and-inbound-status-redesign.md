# Design Spec — Nem Párosított Tételek & Bejövő Számlák Állapota Újratervezés

## 1. Előzmények és Elemzés

A jelenlegi Dashboardon a **Nem párosított tételek** (`UnmatchedSection`) és a **Bejövő számlák állapota** (`InvoiceStatusTables`) két különálló, egymás alá helyezett teljes szélességű kártyában jelenik meg.

### Meglévő Problémák:
1. **Adatduplikáció:**
   * A `Bejövő számlák állapota -> Fizetendő` szekció és a `Nem párosított tételek -> NAV számlák -> Bejövő` szekció gyakorlatilag ugyanazt a lekérdezést futtatja (`nav_invoices WHERE invoice_direction = 'INBOUND' AND transaction_id IS NULL`).
   * A felhasználó kétszer látja ugyanazt a kifizetetlen szállítói számlát két különböző blokkban.
2. **Elavult Táblázat-layout:**
   * A régi generic shadcn/ui táblázat nem illeszkedik a Fintech Dense Split (520px-es kártyamagasság, elegáns sor-hover, finom HSL gradiens) modern design nyelvéhez.
3. **Hiányzó Közvetlen Akciók:**
   * A tételeknél nincs soronkénti akció (pl. azonnali feltöltés modal megnyitása a hiányzó bizonylatú számlánál, vagy közvetlen párosítási ugrás).

---

## 2. A 3 Kidolgozott Design Koncepció

Az interaktív HTML mockup megtekinthető:
👉 [`docs/design/mockups/unmatched-and-inbound-status-redesign.html`](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/design/mockups/unmatched-and-inbound-status-redesign.html)

### 🌟 1. Opció: Fintech Side-by-Side Split (Két szinkronizált 520px kártya)
* **Koncepció:** Két egymás melletti, szimmetrikus 520px magas kártya, pontosan olyan stílusban, mint a `Legutóbbi számlák` és a `Projekt összefoglaló`.
* **Bal oldal (Nem párosított tételek):**
  * Fejléc statisztikai sáv: Nyitott egyenleg (HUF), legrégebbi tétel dátuma.
  * Fülek: NAV számlák (be/ki irányjelzővel) | Banki mozgások.
  * Sor széli „Párosít” gomb.
* **Jobb oldal (Bejövő számlák állapota):**
  * Fejléc statisztikai sáv: Fizetendő összeg | Beküldésre váró számlák darabszáma.
  * Fülek: Fizetendő szállítók | Hiányzó bizonylatok.
  * Sárga figyelmeztető kiemelés a hiányzó PDF/kép tételeknél, közvetlen „Feltöltés” gombbal.
* **Kinek ajánlott:** Aki a szimmetrikus, oszlopos kártyarácsot kedveli.

---

### ⭐ 2. Opció: Unified Financial Cockpit (Egyesített Teendőközpont — Kiemelten Ajánlott!)
* **Koncepció:** Megszünteti a duplikációt egyetlen intelligens, teendő-orientált vezérlőpultba rendezve.
* **Felső 4 interaktív KPI csempe:**
  1. 🔴 **Hiányzó Bizonylatok:** `6 db` (Sürgős: NAV-ban létezik, de a felhasználó még nem töltötte fel a képet/PDF-et)
  2. 🟡 **Kifizetetlen Szállítók:** `5,48 M Ft` (14 db bejövő számla, aminek nincs banki kifizetés párja)
  3. 🔵 **Párosítatlan Banki Mozgások:** `9 db` (Kivonaton levont/jóváírt összeg, számlapár nélkül)
  4. 🟢 **Kintlévőségek (Vevők):** `8,25 M Ft` (Kiállított számlák kifizetésre várva)
* **Fő lista:** A rákattintott KPI csempe alapján dinamikusan vált a tartalom, beépített keresővel és csoportos akció gombbal (pl. „Csoportos feltöltés” vagy „Auto-Match”).
* **Kinek ajánlott:** Maximális átláthatóság, modern SaaS/Fintech élmény (Stripe / Revolut stílus), nulla görgetési káosz.

---

### ⚡ 3. Opció: Action-First Dense Grid (Maximális Sebesség Könyvelőknek)
* **Koncepció:** Ultra-kompakt sorok, ahol minden sor végén 2 közvetlen akció gomb található (pl. azonnali 98%-os AI párosítás elfogadása, kihagyás, feltöltés).
* **Kinek ajánlott:** Nagy volumenű, napi könyvelési munkát végző power-usereknek.
