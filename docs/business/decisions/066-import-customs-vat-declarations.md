# BDR-066: Termékimport és Vámhatározatok ÁFA Elszámolása

**Status:** Decided  
**Date:** 2026-10-09  
**Category:** Business Rule & Statutory Tax Compliance  
**Jogszabályi Hivatkozás:** Áfa tv. 2. § c), 24. §, 74–75. §, 120. § c), 127. § (1) c), 153/A. §

---

## 🎯 Üzleti Kérdés & Problémafelvetés
Harmadik országból (EU-n kívülről) történő termékbehozatal (termékimport) esetén az áru nem közösségi termékbeszerzésként, és nem is belföldi számlaként adózik. A külföldi exportőr nem számít fel magyar forgalmi adót, a belföldi forgalomba hozatal jogszabályi feltételeként a Nemzeti Adó- és Vámhivatal (vámhatóság) vámeljárást folytat le és vámhatározatot (határozat szabad forgalomba bocsátásról, egységes vámokmány / EV / Kiviteli-Behozatali okmány) bocsát ki.

A vállalkozások és könyvelők felé fennállt a követelmény, hogy:
1. Milyen bizonylat alapján rögzíthető a vámhatározat és az import forgalmi adó?
2. Hogyan különül el a kivetéses import áfa (határozattal előírt és vámhatóságnak megfizetendő adó) és az önadózói import áfa (amikor a vámhatóság engedélye alapján az importőr a havi bevallásában számolja el a fizetendő és levonható adót)?
3. Milyen hivatalos ÁFA bevallási sorokba (NAV 2665) és analitikai gyűjtőkódokba kell a tételeknek beépülniük?

---

## 💡 Üzleti Döntés

### 1. Vámhatározatok Elkülönített Analitikája (`import_customs_declarations`)
A termékimport nem klasszikus szállítói számla, hanem hatósági bizonylat. Ezért a rendszer önálló vámhatározat nyilvántartást vezet, ahol az importáló cég vagy a könyvelő rögzíti:
- Vámhatározat hivatalos iktatószáma (pl. `12345/2026/NAV/VAM`)
- Illetékes vámhivatal neve / kódja
- Határozat kelte, jogerőre emelkedés és fizetési esedékesség dátuma
- Külföldi eladó / exportőr neve és székhelye
- Vámérték és járulékos költségek szerinti hivatalos adóalap (Áfa tv. 74–75. §)
- Felszámított vám és egyéb behozatali terhek
- Fizetési státusz és megfizetés dátuma (kivetéses import esetén a levonási jog feltétele a pénzügyi rendezés)

### 2. Kettős Adózási Mód Támogatása
1. **Kivetéses eljárás (Alapeset):**
   - A vámhatóság határozattal veti ki az import áfát és a vámot.
   - Az adózó ezt közvetlenül a vámhatóság számlájára fizeti meg.
   - **ÁFA bevallásban:** Kizárólag **levonható adóként** szerepel (NAV 2665 bevallás **70–72. sorok**: Termékimport után levonható előzetesen felszámított adó), fizetendő adót a bevallásban nem képez.
2. **Önadózói vámkezelés (Engedéllyel rendelkező importőrök, Áfa tv. 153/A. §):**
   - Nem kell a vámkezeléskor azonnal megfizetni az áfát a vámhatóságnak.
   - Az importőr a rendszeres havi ÁFA bevallásában egyszerre szerepelteti:
     - **Fizetendő adóként:** NAV 2665 bevallás **18–20. sorok** (Önadózással megállapított termékimport fizetendő adója).
     - **Levonható adóként:** NAV 2665 bevallás **70–72. sorok** (amennyiben a levonási jog tárgyi feltételei fennállnak).

### 3. Rendszerszintű Import ÁFA Kódok
A rendszer 4 beépített hivatalos ÁFA gyűjtőkódot vezet be:
- `IMPORT_27`: 27%-os normál kulcsú termékimport
- `IMPORT_18`: 18%-os kedvezményes kulcsú termékimport
- `IMPORT_5`: 5%-os kedvezményes kulcsú termékimport
- `IMPORT_MENTES`: Törvényileg adómentes termékimport

### 4. ÁFA Motor és Replika Integráció
A `calculate_hungarian_vat_return` számítási motor a vizsgált bevallási időszakra (év/hó) automatikusan lekéri az adott időszakra eső jogerős, rendezett vámhatározatokat, és beemeli azokat a 2665-ös digitális nyomtatvány replikába:
- 18–20. sorok: Fizetendő önadózói import áfaalap és adóösszeg
- 70–72. sorok: Levonható import áfaalap és adóösszeg
- Nettó elszámolandó adó egyenleg (`line61` / `line73`) helyes képzése

---

## 📈 Racionálé és Előnyök
- **Jogszabályi megfelelőség:** Az Áfa tv. szigorúan szankcionálja a harmadik országból érkező áruk belföldi beszerzésként történő téves bevallását. A dedikált vámhatározat-kezelés garancia az Art. és Áfa tv. szerinti helytállóságra.
- **Transzparencia a könyvelőnek:** A NAV OSA-ban a külföldi harmadik országból jövő számlák nem szerepelnek. A vámhatározatok rögzítése megszünteti a "láthatatlan" import költségeket.
- **Önadózói védelem:** Egyértelmű jelölővel megakadályozza, hogy az önadózói import áfát duplán (vámhatóságnak és bevallásban is) befizessék.

---

## 🔗 Kapcsolódó
- **ADR:** [A-235: Termékimport és Vámhatározatok ÁFA Integrációja](../../architecture/decisions/A-235-import-customs-vat-declarations-and-return-integration.md)
- **PRD:** [P-173: Termékimport és Vámhatározatok Rögzítése és Megjelenítése UX](../../product/decisions/P-173-import-customs-vat-declarations-ux.md)
- **Adatbázis Séma:** [15-eaisybooks-tax-legal.md](../../architecture/database/15-eaisybooks-tax-legal.md)
