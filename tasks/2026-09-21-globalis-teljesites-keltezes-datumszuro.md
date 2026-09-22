# 🎫 [Task] Globális Teljesítés / Keltezés dátumszűrő elhelyezése a fejlécben

### 🎯 Cél és Funkció
Jelenleg a felső sávban lévő időszakszűrő kizárólag a számlák kiállítási (keltezési) dátuma alapján szűri az adatokat. A könyveléshez és az áfa-időszakok ellenőrzéséhez elengedhetetlen, hogy a felhasználó a teljesítés napja szerint is át tudja tekinteni az időszakot, hiszen keresztéves vagy hónap végi számláknál a teljesítés és a keltezés gyakran eltér egymástól.

### 📍 Felületi elhelyezkedés
* **Hol:** A felső sávban (fejléc), közvetlenül az „Időszak:” felirat és a naptár-választó mezők mellett.
* **Megjelenés:** Kétállású kompakt kapcsoló: `[ Keltezés | Teljesítés ]`.

### ⚙️ Működési logika
1. **Alapértelmezés:** A felület megnyitásakor mindig a `Keltezés` mód az aktív.
2. **Kattintáskor:** A `Teljesítés`-re kattintva a nézet (pl. Számlák lista, Irányítópult) azonnal újraszűri a bizonylatokat a tételek teljesítési dátuma alapján.
3. **Időszak megtartása:** Az éppen beállított időszak (pl. „Ez a hónap” vagy egyedi dátumtartomány) nem változik, csak a teljesítés napjára vonatkozik a keltezés helyett.
4. **Megjegyzés:** A kiválasztott szűrési mód maradjon meg az oldal URL-jében is, hogy böngészőfrissítéskor vagy a link kollégáknak történő átküldésekor se álljon vissza alaphelyzetbe.

### ✅ Elfogadási kritériumok (Teszteléshez)
- [ ] A fejlécben az időszakszűrő mellett megjelenik a `[ Keltezés | Teljesítés ]` kapcsoló.
- [ ] Alapértelmezetten a `Keltezés` az aktív állapot.
- [ ] A `Teljesítés` gombra kattintva a számlák listája és az összesítők azonnal a teljesítés dátuma szerint frissülnek.
- [ ] Oldalfrissítés után vagy visszanavigáláskor a kiválasztott szűrési mód megmarad.
- [ ] Kisebb képernyőméret és mobilnézet esetén is rendezetten, tördelve jelenik meg a fejlécben.
