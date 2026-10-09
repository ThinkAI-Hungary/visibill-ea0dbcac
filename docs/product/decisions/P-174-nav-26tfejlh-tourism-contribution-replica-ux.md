# P-174: NAV 26TFEJLH Nyomtatvány Replika és PDF Export UX

**Status:** Decided  
**Date:** 2026-10-09  
**Category:** UI / Workflow / Statutory Reporting & Form Replicas  
**Kapcsolódó döntések:** [BDR-067](../../business/decisions/067-nav-26tfejlh-tourism-development-contribution.md) · [A-236](../../architecture/decisions/A-236-nav-26tfejlh-tourism-contribution-replica-and-pdf-engine.md) · [P-126](./P-126-nav-2665-official-tax-form-digital-replica-ux.md)

---

## 🎯 Question
Hogyan jelenítsük meg a vendéglátó- és szálláshely-szolgáltató vállalkozások Turizmusfejlesztési Hozzájárulásának (NAV 26TFEJLH) hivatalos nyomtatványát a webes felületen a Visibill *„Semmit a kéznek, mindent a szemnek”* filozófiája szerint, és hogyan biztosítsunk hivatalos, nyomtatható PDF exportot?

---

## 💡 Decision

### 1. NAV 26TFEJLH Nyomtatvány Digitális Replika (`Nav26TfejlhReplicaContainer.tsx`, `Nav26TfejlhSheetFolap.tsx`)
Az ÁFA bevallás felületén (`/vat-return`) a Turizmusfejlesztési Hozzájárulás szekció alatt vagy dedikált nézetként elérhető a hivatalos nyomtatvány digitális ikertestvére:
- **Hivatalos fejléc design:**
  - Sötétzöld NAV arculati csík, hivatalos megnevezés: *„26TFEJLH — Bevallás a turizmusfejlesztési hozzájárulásról”*.
  - Vonalkód replika szekció, iktatószám és vonalkód-azonosító keret.
- **(A) Blokk — Adózó adatai:**
  - Adószám (8 jegyű törzsszám + áfakód + megyekód bontásban), adóazonosító jel.
  - Cég / egyéni vállalkozó hivatalos elnevezése, székhelye, levelezési címe.
  - Törvényes képviselő / adótanácsadó meghatalmazott neve és adószáma.
- **(B) Blokk — Bevallási időszak és jelleg:**
  - Bevallási gyakoriság (Havi / Negyedéves / Éves) rádiógombos replika mezők.
  - Elszámolási időszak kezdő és záró dátuma (ÉÉÉÉ.HH.NN).
  - Esedékesség napja.
- **(C) Blokk — Hozzájárulás számítása:**
  - **1. sor:** Étkezőhelyi vendéglátás (5%-os áfa) adóalapja és a 4%-os számított hozzájárulás.
  - **2. sor:** Kereskedelmi szálláshely-szolgáltatás (5%-os áfa) adóalapja és a 4%-os számított hozzájárulás.
  - **3. sor:** Összesített hozzájárulási alap és kötelezettség.
  - **4. sor:** Korábban bevallott / befizetett előlegek összege.
  - **5. sor:** Elszámolandó különbözet (Fizetendő hozzájárulás / Visszaigényelhető összeg).
- **(D) Blokk — Felelősségvállalási nyilatkozat:**
  - Dátum, keltezés, cégszerű aláírás helye.

### 2. Kliensoldali Pixelpontos PDF Generálás (`tfejlhPdf.ts`)
A replika felső műveleti sávjában elhelyezett `[ 📄 Hivatalos PDF Letöltése ]` gombra kattintva:
- A rendszer kliensoldalon, azonnal (külső backend hívás nélkül) legenerálja a hivatalos A4-es nyomtatványképet.
- Vektoros keretezés, hivatalos betűtípusok, margók és cellák.
- Fájlnév konvenció: `26TFEJLH_[Cégnév]_[Időszak].pdf`.

---

## 🔍 Current Implementation
- `src/features/vat/components/replica/Nav26TfejlhReplicaContainer.tsx`
- `src/features/vat/components/replica/Nav26TfejlhSheetFolap.tsx`
- `src/features/vat/components/VatTourismTaxSection.tsx`
- `src/lib/tfejlhPdf.ts`

---

## 📈 Rationale
A könyvelők és adószakértők a hivatalos nyomtatvány struktúráját ismerik leginkább. A nyomtatvány replika kizárja az ÁNYK-ba történő kézi átmásolás során felmerülő sor-elcsúszásokat, az azonnali PDF export pedig lehetővé teszi, hogy az ügyfél egy hitelesnek látszó adóelszámolást kapjon a könyvelőjétől a befizetéshez.

---

## 🔗 Kapcsolódó
- **BDR:** [067: NAV 26TFEJLH Turizmusfejlesztési Hozzájárulás Bevallás és Nyomtatvány Replika](../../business/decisions/067-nav-26tfejlh-tourism-development-contribution.md)
- **ADR:** [A-236: NAV 26TFEJLH Nyomtatvány Replika és PDF Generáló Motor](../../architecture/decisions/A-236-nav-26tfejlh-tourism-contribution-replica-and-pdf-engine.md)
- **PRD:** [P-126: NAV 2665 Hivatalos Nyomtatvány Digitális Replika UX](./P-126-nav-2665-official-tax-form-digital-replica-ux.md)
