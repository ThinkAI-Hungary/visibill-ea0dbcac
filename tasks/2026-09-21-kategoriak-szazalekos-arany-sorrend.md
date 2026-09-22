# 🎫 [Task] Kategóriák listájának rendezése százalékos arány szerint csökkenő sorrendbe

### 🎯 Cél és Funkció
A Kategóriák felületen a kategóriák felsorolása jelenleg nem a pénzügyi vagy számlaarányuk szerint jelenik meg, ami nehezíti a legnagyobb tételt képviselő költségtípusok azonnali áttekintését. A cél, hogy a kategóriák listája alapértelmezetten a százalékos részarányuk (% / Arány) szerint csökkenő sorrendben jelenjen meg, így a legmeghatározóbb kategóriák azonnal a lista elején láthatóak.

### 📍 Felületi elhelyezkedés
* **Hol:** Kategóriák oldal (Beállítások / Kategóriák menüpont alatt).
* **Megjelenés:** A kördiagram és az összefoglaló kártyák alatti lenyitható kategórialistában (ahol a Kategória neve, az Arány %, a Számlák száma és az Összeg szerepel).

### ⚙️ Működési logika
1. **Alapértelmezett sorrend:** A kategórialistában a kategóriák a százalékos részarányuk (`Arány` oszlop) szerint csökkenő sorrendben rendeződnek (a legnagyobb %-os arányú kategória kerül legfelülre).
2. **Azonos arány kezelése:** Amennyiben több kategória aránya megegyezik (vagy 0%), másodlagos rendezési elvként a kategória neve (ABC sorrend) érvényesül.
3. **Műveletek épsége:** A lenyitható sorok (számlák kibontása), a szerkesztés és a törlés gombok működése változatlan marad.
4. **Adatfrissülés:** Új számla kategorizálásakor vagy meglévő számla átsorolásakor a kategóriák sorrendje dinamikusan követi az új százalékos arányokat.

### ✅ Elfogadási kritériumok (Teszteléshez)
- [ ] A Kategóriák oldalon a lenyitható kategórialista a legnagyobb százalékos arányú (`Arány` oszlop) tétellel kezdődik, és csökkenő sorrendben folytatódik.
- [ ] A 0%-os (még számlával nem rendelkező) kategóriák a lista végére kerülnek.
- [ ] Egy kategória kibontásakor a hozzárendelt számlák listája megfelelően megjelenik.
- [ ] A sorvégi ceruza (Szerkesztés) és kuka (Törlés) gombok az átrendezett sorrendben is pontosan a megfelelő kategóriára nyitják meg a dialógust.
- [ ] Számlák hozzárendelése vagy kategóriaváltása után az arányok és a sorrend frissülnek.
