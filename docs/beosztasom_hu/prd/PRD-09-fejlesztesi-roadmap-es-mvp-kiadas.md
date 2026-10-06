# PRD-09: Fejlesztési Roadmap, Képernyő-készültség és MVP Kiadás

[Előző: PRD-08 Dolgozói Önkiszolgáló](./PRD-08-dolgozoi-onkiszolgalo-es-mobil-nezet.md) · [Vissza a PRD Indexhez](./INDEX.md)

---

## 1. Termék- és Kiadási Célkitűzés

A **Fejlesztési Roadmap és MVP Kiadás** dokumentum strukturálja a Beosztásom integráció képernyőinek, felületeinek és funkcióinak megvalósítási sorrendjét. A cél egy fokozatosan bevezethető, azonnali önálló üzleti értéket teremtő termék fejlesztése, amely a könyvelőirodák legsürgősebb adminisztrációs fájdalompontját (a hóvégi NAV-kompatibilis jelenléti ív előállítását) már az első mérföldkőnél (MVP) maradéktalanul megoldja.

### 1.1 Kiemelt Kiadási Alapelvek
- **Azonnali Értékteremtés (MVP Mérföldkő):** A 0–4. fázis lezárásával a szoftver önállóan használhatóvá válik a havi beosztások kézi/sablonos tervezésére és a hivatalos Excel jelenléti ív exportálására.
- **Megkülönböztető Erő (Automata Motor):** Az 5–7. fázis hozza el a saját fejlesztés legnagyobb versenyelőnyét: a létszámigény-alapú automatikus kitöltést és a munkaügyi bírságokat kizáró szabálymotort.
- **Ökoszisztéma Bővítés:** A 8–9. fázis csatlakoztatja a munkavállalói okostelefonokat és a fizikai beléptető terminálokat.

---

## 2. Képernyő-készültségi és Fázis Mátrix

Az alábbi táblázat definiálja az egyes modulok és képernyők kiadási ütemezését a forrás-specifikáció szerinti 10 fázisban:

| Fázis Sorszám | Fázis Megnevezése | Érintett Képernyők és Funkciók | Prioritás | PRD Referencia |
|:---|:---|:---|:---:|:---:|
| **0. Fázis** | Előkészítés & Keret | Globális fejléc, cégválasztó, navigáció, jogosultságok | P0 (Alap) | [PRD-01](./PRD-01-navigacio-es-menustruktura.md) |
| **1. Fázis** | Törzsadatok | Telephelyek, Munkakörök (színekkel), Dolgozói mesterkarton | P0 (Alap) | [PRD-07](./PRD-07-torzsadat-es-munkavallalo-karton.md) |
| **2. Fázis** | Beosztáskezelő (Alap) | Havi naptárrács, cellaműveletek, műszakszerkesztő modal | P0 (MVP) | [PRD-02](./PRD-02-havi-beosztastervezo-naptarracs.md), [PRD-03](./PRD-03-muszakszerkeszto-es-sablonkezelo.md) |
| **3. Fázis** | Távollétek | 30+ Mt. jogcím felvitele, naptári színezés, szabadságkeret | P0 (MVP) | [PRD-04](./PRD-04-tavollet-es-helyettesites-kezelo.md) |
| **4. Fázis** | Jelenlét & NAV Export | Tömeges igazolás, hóvégi zárás, NAV Excel exportőr | **P0 (ÉLES MVP)** | [PRD-06](./PRD-06-jelenlet-zaras-es-berszamfejtesi-export.md) |
| **5. Fázis** | Szabálymotor & Keret | 4 súlyossági szintű szabálymotor, 15 napos táppénz split | P1 (Haladó) | [PRD-05](./PRD-05-szabalymotor-es-eloe-megfeleloseg.md) |
| **6. Fázis** | Automatizálás | Létszámigény-alapú kitöltő, előző hónap másolása, vágólap | P1 (Haladó) | [PRD-02](./PRD-02-havi-beosztastervezo-naptarracs.md), [PRD-03](./PRD-03-muszakszerkeszto-es-sablonkezelo.md) |
| **7. Fázis** | Bérszámfejtési Adathíd | Nexon, Kulcs-Bér, RLB bérprogram feladás, értesítések | P1 (Integráció) | [PRD-06](./PRD-06-jelenlet-zaras-es-berszamfejtesi-export.md) |
| **8. Fázis** | Dolgozói Önkiszolgáló | Mobil PWA felület, műszakcsere kérelem, szabi igénylés | P2 (Bővítmény) | [PRD-08](./PRD-08-dolgozoi-onkiszolgalo-es-mobil-nezet.md) |
| **9. Fázis** | Beléptetőterminálok | Beléptetőrendszer integráció, QR/NFC ellenőrzőpontok | P2 (Bővítmény) | [PRD-01](./PRD-01-navigacio-es-menustruktura.md) |

---

## 3. Az Éles MVP Kiadás Terjedelme (Fázis 0–4)

Az éles MVP (Minimum Viable Product) szállítása biztosítja, hogy a könyvelőirodák azonnal kiválthassák a külső szoftvereket és a kézi papírmunkát:

### 3.1 Mit TUD az MVP?
- ✅ Cégek, telephelyek, munkakörök és munkavállalók teljes körű kezelése.
- ✅ Havi beosztás létrehozása, szerkesztése a naptárrácsban (egérrel és gyorsbillentyűkkel).
- ✅ Sablonok használata (előre rögzített munkaidők azonnali hozzárendelése).
- ✅ Távollétek rögzítése Mt. jogcímekkel, fizetett szabadság automatikus óraszámításával.
- ✅ Tervezett műszakok tömeges jelenlétté minősítése a hónap végén.
- ✅ **Hivatalos NAV-kompatibilis Excel munkaidő-jegyzék generálása dolgozónkénti munkalapokkal és aláírási blokkal.**

### 3.2 Mi MARAD a Második Hullámra (Fázis 5–7)?
- ⏳ Automatikus ütemezett beosztás-generálás a háttérben.
- ⏳ Intelligens helyettes-párok gépi felajánlása.
- ⏳ Közvetlen API/XML integráció a Nexon és Kulcs-Bér programokkal.

---

## 4. UI/UX Teljesítmény- és Minőségi Küszöbök

A bemutató videóban a felhasználók legnagyobb panasza a meglévő rendszer lassúsága volt. A saját felületünkön az alábbi szigorú küszöbértékek kötelezőek (`R-07`):

1. **Rácsműveletek Sebessége:** Cellaszerkesztés, másolás-beillesztés és tartománykijelölés reakcióideje: **&lt; 50 ms** (optimistic UI).
2. **Képernyőbetöltési Idő:** Teljes havi naptárrács megjelenítése 50 aktív dolgozóval: **&lt; 800 ms**.
3. **Mesterkarton Fiók (Drawer):** Megnyitási és fülváltási sebesség: **&lt; 150 ms**.
4. **Excel Export Sebesség:** 100 munkavállalót tartalmazó cég teljes havi munkaidő-jegyzékének generálása és letöltése: **&lt; 2.5 másodperc**.
5. **Double-submit Védelem:** Minden mentés, jóváhagyás és zárás gomb kattintáskor azonnal letiltja magát, megakadályozva a duplikált tranzakciókat.

---

## 5. Elfogadási Kritériumok (Definition of Done)

Egy PRD képernyő és funkció akkor tekinthető késznek az implementáció szempontjából, ha:
1. **Dizájn Megfelelőség:** Maradéktalanul illeszkedik a [docs/design/](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/design/) tokenrendszeréhez (`shadcn/ui`, `Lucide`, szemantikus színek).
2. **4 UI Állapot Megléte:** A betöltési szkeleton, üres állapot, sikeres toast és az inline hibaüzenet fizikailag implementálva van.
3. **Reszponzív Megjelenés:** Hiba nélkül használható asztali (1920px, 1440px), laptop (1280px), tablet (1024px) és mobil (&lt;768px) nézetekben.
4. **Validáció és Integritás:** Nem enged érvénytelen időpontot vagy átfedő műszakot menteni.
5. **Tesztek és Zöld Build:** A komponenshez tartozó egységtesztek és böngészőtesztek hiba nélkül lefutnak.
