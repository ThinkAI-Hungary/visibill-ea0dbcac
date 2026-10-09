# A-236: NAV 26TFEJLH Nyomtatvány Replika és PDF Generáló Motor

**Status:** Decided  
**Date:** 2026-10-09  
**Utoljára frissítve:** 2026-10-09  

---

## 🏛️ Context
A turizmusfejlesztési hozzájárulásról szóló 2016. évi LXVI. törvény alapján a kedvezményes, 5%-os áfakulcs alá eső étkezőhelyi vendéglátási szolgáltatást és kereskedelmi szálláshely-szolgáltatást nyújtó vállalkozások 4%-os mértékű hozzájárulás bevallására kötelezettek a NAV felé a **26TFEJLH** nyomtatványon.

Az eaisyBooks rendszer ÁFA moduljában a forgalmi adatok (kimenő számlák 5%-os tételei) alapján a számítások rendelkezésre álltak, azonban hiányzott a hivatalos hatósági nyomtatvány digitális ikertestvére (replika) és a közvetlen, hiteles PDF export képesség. A könyvelők kénytelenek voltak kézzel átírni a számokat az ÁNYK felületre, ami manuális hibákhoz és elütésekhez vezethetett.

---

## 💡 Decision

### 1. Komponens Architektúra és Hivatalos Megjelenítés
A rendszer megvalósította a moduláris replika architektúrát a `src/features/vat/components/replica/` alatt:
- **`Nav26TfejlhReplicaContainer.tsx`**:
  - Fogadja a cégadatokat, az adómegállapítási időszakot, és a kalkulált turizmusfejlesztési hozzájárulás adatokat.
  - Kezeli a nyomtatási és PDF generálási állapotokat.
  - Fejléc akciók: `[ 📄 Hivatalos PDF Letöltése ]` és nézetváltó.
- **`Nav26TfejlhSheetFolap.tsx`**:
  - Hivatalos NAV zöld (`#1b5e20` / `bg-emerald-800`), fehér és szürke kontrasztos keretezés.
  - Vonalkód replika és hivatalos iktatási fejléc mezők.
  - (A) Adózó azonosító blokk: Cég adószáma, neve, székhelye, képviselő adatai.
  - (B) Bevallási időszak blokk: Bevallás jellege, tól-ig dátumok.
  - (C) Hozzájárulás-számítási táblázat:
    - Étkezőhelyi vendéglátás (5%) adóalap és 4% hozzájárulás.
    - Szálláshely-szolgáltatás (5%) adóalap és 4% hozzájárulás.
    - Összesített hozzájárulás és korábban bevallott előlegek különbözete.
  - (D) Keltezési és felelősségvállalási blokk.

### 2. Kliensoldali Vektoros PDF Motor (`src/lib/tfejlhPdf.ts`)
A PDF generálás kizárólag a kliens böngészőjében fut `jsPDF` segítségével, elkerülve a szerveroldali Chromium vagy külső renderelő szolgáltatások terhelését és költségét:
- A4 álló formátum (210 x 297 mm), standard adóhatósági margók (10 mm).
- Vektoros vonalak és cellakeretek a hivatalos űrlap koordinátái szerint.
- Tipográfia: Helvetica, pontos betűméretek és jobbra igazított pénzügyi számformátumok (HUF).
- Automatikus fájlnévképzés: `26TFEJLH_[Cégnév]_[Időszak].pdf`.

### 3. Reaktív Számítás és Integráció
- `VatTourismTaxSection.tsx`: A kimenő számlák 5%-os áfa tartalmú tételeit reaktívan szűri és aggregálja.
- A replika azonnal, valós időben tükrözi a bejövő és kimenő számlák változásait, így a könyvelő azonnal látja az adóhatóságnak küldendő számokat.

---

## ⚡ Consequences

### Pozitív
- **Azonnali vizuális kontroll:** A könyvelő a NAV nyomtatvány megszokott formátumában látja az adatokat, kizárva az ÁNYK kitöltési félreértéseket.
- **Nulla szerverterhelés:** A 100%-ban kliensoldali vektoros PDF generálás azonnali letöltést biztosít hálózati késleltetés és szerverköltség nélkül.
- **Ügyfélbarát elszámolás:** A vállalkozó számára azonnal átadható, professzionális bizonylat készül a fizetendő hozzájárulásról.

### Negatív & Kockázatok
- NAV űrlapváltozás esetén (éves nyomtatványváltás, pl. 27TFEJLH) a komponens layoutját és a PDF koordinátákat frissíteni kell.

---

## 🔗 Kapcsolódó
- **BDR:** [067: NAV 26TFEJLH Turizmusfejlesztési Hozzájárulás Bevallás és Nyomtatvány Replika](../../business/decisions/067-nav-26tfejlh-tourism-development-contribution.md)
- **PRD:** [P-174: NAV 26TFEJLH Nyomtatvány Replika és PDF Export UX](../../product/decisions/P-174-nav-26tfejlh-tourism-contribution-replica-ux.md)
- **ADR:** [A-167: NAV 2665 Hivatalos Nyomtatvány Digitális Replika Architektúra](./A-167-nav-2665-official-tax-form-digital-replica.md)
