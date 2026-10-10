# BDR-067: NAV 26TFEJLH Turizmusfejlesztési Hozzájárulás Bevallás és Nyomtatvány Replika

**Status:** Decided  
**Date:** 2026-10-09  
**Category:** Statutory Tax Compliance & Reporting  
**Jogszabályi Hivatkozás:** 2016. évi LXVI. törvény a turizmusfejlesztési hozzájárulásról, Áfa tv. 3. számú melléklet II/1. és II/3. pont

---

## 🎯 Üzleti Kérdés & Problémafelvetés
A vendéglátóipari és szálláshely-szolgáltató vállalkozások (pl. éttermek, büfék, szállodák, panziók) az 5%-os kedvezményes általános forgalmi adó kulcs alá tartozó szolgáltatásaik után a normál ÁFA bevalláson (NAV 2665) felül **turizmusfejlesztési hozzájárulás (TFEJLH)** bevallására és megfizetésére kötelezettek a NAV felé.

A hozzájárulás bevallására a NAV **26TFEJLH** jelű külön nyomtatványa szolgál. Az eaisyBooks könyvelőirodai és vállalkozói ügyfelei számára szükséges volt:
1. Az 5%-os vendéglátás és szálláshely-szolgáltatás kimenő számlaforgalmából a hozzájárulási alap és a 4%-os adó automatikus megállapítása.
2. Egy hivatalos formátumú, digitális nyomtatvány replika megjelenítése a webes felületen („Semmit a kéznek, mindent a szemnek” elv mentén).
3. Hivatalos, nyomtatható és archiválható PDF dokumentum generálása a NAV bevallási archívumhoz és ügyfél-tájékoztatókhoz.

---

## 💡 Üzleti Döntés

### 1. Hozzájárulási Alap és Kötelezettség Kalkuláció
A törvényi előírásoknak megfelelően:
- **Hozzájárulás mértéke:** A szolgáltatás általános forgalmi adó nélküli ellenértékének (nettó adóalap) **4%-a**.
- **Érintett szolgáltatási kör:**
  - Étkezőhelyi vendéglátásban étel- és helyben készített, nem alkoholtartalmú italforgalom (5%-os áfa).
  - Kereskedelmi szálláshely-szolgáltatás nyújtása (5%-os áfa).
- **Elszámolási időszak:** Párhuzamos az adózó ÁFA bevallási gyakoriságával (havi, negyedéves vagy éves).
- A rendszer a kimenő számlák (NAV Online Számla és manuálisan beküldött) 5%-os tételeiből automatikusan kiszámítja a hozzájárulás alapját és az előírt 4%-os kötelezettséget.

### 2. NAV 26TFEJLH Hivatalos Nyomtatvány Digitális Replika
A felhasználói élmény maximális támogatására és az adóhatósági űrlappal való 100%-os egyezőség érdekében a rendszer megvalósítja a digitális replikát:
- **Hivatalos fejléc:** Nyomtatványazonosító (`26TFEJLH`), vonalkód mező, iktatószám keret, hivatalos NAV színséma (sötétzöld fejléc, szürke keretek).
- **(A) Adózó adatai:** Adószám, cég / vállalkozó neve, székhely / lakcím, képviselet megnevezése.
- **(B) Bevallási időszak:** Bevallás jellege (havi / negyedéves / éves), időszaki dátumok (tól-ig), esedékesség dátuma.
- **(C) Hozzájárulás-számítási táblázat:**
  - Étkezőhelyi vendéglátás nettó adóalapja és 4%-os hozzájárulása.
  - Szálláshely-szolgáltatás nettó adóalapja és 4%-os hozzájárulása.
  - Összesített hozzájárulási alap és kötelezettség.
  - Korábban bevallott előlegek és elszámolandó különbözet.

### 3. Hivatalos Vektoros PDF Export Motor (`tfejlhPdf.ts`)
A rendszer önálló, kliensoldali vektoros PDF generátort kapott:
- A hivatalos adóhatósági formátumot pixelpontosan leképező vektoros vonalazás és tipográfia.
- Teljes adózói adatok, bevallási időszak, kalkulált adóalapok és adóösszegek kitöltve.
- Hivatalos lábléc hitelesítési záradékkal.

### 4. Hivatalos NAV AbevJava v3.0 XML Export (`tfejlhXml.ts`)
A rendszer közvetlen, ÁNYK-ba importálható XML állományt generál:
- Hivatalos adóhatósági séma szerinti mezőkialakítás (`26TFEJLH.xml` minta alapján).
- Megszünteti a kézi adatbevitelt az ÁNYK keretprogramban, közvetlen fájlbetöltéssel támogatja a hatósági benyújtást.

---

## 📈 Racionálé és Haszon
- **Könyvelői hibamentesség:** Megszűnik az adóalapok kézi összeadogatása és kalkulációja; az 5%-os tételek azonnal beemelésre kerülnek.
- **Azonnali ellenőrizhetőség:** A könyvelő a NAV ÁNYK vagy ONYA beküldés előtt a pontos replikán látja a kitöltendő adatokat.
- **Ügyfélbizalom:** Az adózó vállalkozás számára nyomtatható, professzionális PDF bizonylat adható át a fizetendő turizmusfejlesztési hozzájárulás összegéről.
- **Automatizált Hatósági Benyújtás:** Az ÁNYK XML közvetlenül beküldhető az ÁNYK keretprogrammal vagy feltölthető az ONYA felületére.

---

## 🔗 Kapcsolódó
- **ADR:** [A-236: NAV 26TFEJLH Nyomtatvány Replika és PDF Generáló Motor](../../architecture/decisions/A-236-nav-26tfejlh-tourism-contribution-replica-and-pdf-engine.md)
- **PRD:** [P-174: NAV 26TFEJLH Nyomtatvány Replika és PDF Export UX](../../product/decisions/P-174-nav-26tfejlh-tourism-contribution-replica-ux.md)
- **BDR:** [033: ÁFA bevallás modul](./033-vat-return-module.md)
