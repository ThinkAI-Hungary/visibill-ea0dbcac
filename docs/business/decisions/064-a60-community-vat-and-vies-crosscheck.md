# Decision 064: A60 Közösségi ÁFA Összesítő és 65-ös Bevallás Összefüggés-vizsgálat (VIES Integrációval)

**Status:** Decided  
**Date:** 2026-09-30  
**Category:** Adózás & ÁFA Modul (`/vat`)  
**Scope:** `eaisybill-prod`, `calculate_hungarian_vat_return`, `useVatReturnData`, `VatA60Table`, `vat_form_rows`

---

## 1. Context & Business Need
A magyar áfa-alanyoknak a Közösségen belüli ügyleteikről havi/negyedéves A60 összesítő nyilatkozatot kell benyújtaniuk. Ezzel párhuzamosan a havi 65-ös ÁFA bevallás és az A60 nyilatkozat adóalapjainak kötelezően egyezniük kell.
A korábbi implementációban felmerült hiányosságok:
1. **Hiányzó külföldi számlák:** A külföldi partnerek (pl. Google Ireland, Meta, Hetzner, Adobe, AWS) nem jelentenek a magyar NAV Online Számla rendszerbe, ezért a számláik a kézi feltöltésű `invoices` táblában szerepeltek, míg az A60 felület korábban csak a `nav_invoices` táblát kérdezte le, és figyelmen kívül hagyta a bejövő (`INBOUND`) tételeket.
2. **Sorbesorolási tévesztések:**
   - A közösségi szolgáltatásnyújtást (pl. szoftverfejlesztési tanácsadás ATHK kulccsal) tévesen a 02. sorra (termékértékesítés) tette ahelyett, hogy a 91–92. sorokra került volna.
   - A közösségi szolgáltatás igénybevételénél (pl. Google, Hetzner) hiányzott a 18. sor (fizetendő adó 27%) és a 67. sor (levonható adó 27%) önadózásos / fordított adózásos elszámolása.
3. **Inaktív VIES gomb:** Üres lista vagy kezdeti állapot esetén a VIES ellenőrző gomb kattinthatatlan maradt.

---

## 2. Döntési Mátrix és Törvényi Sorbesorolás

A 65-ös ÁFA bevallás és az A60 összesítő nyilatkozat közötti kötelező összefüggések:

| Ügylet Típusa | Irány | 65-ös Bevallás Fizetendő Sor | 65-ös Bevallás Levonható Sor | A60 Lap / Kategória |
|---|---|---|---|---|
| **1. Közösségi termékértékesítés** | `OUTBOUND` | **02. sor** (Adómentes értékesítés) | — | A60 01-es lap (`goods_out`) |
| **2. Közösségi termékbeszerzés** | `INBOUND` | **11–16. sor** (0%, 5%, 18%, 27% fizetendő) | **69. sor** (Levonható adó) | A60 02-es lap (`goods_in`) |
| **3. Közösségi szolgáltatásnyújtás** | `OUTBOUND` | **91. sor** & **92. sor** (Áfa tv. 37. § (1)) | — | A60 03-as lap (`services_out`) |
| **4. Közösségi szolgáltatás igénybevétele** | `INBOUND` | **18. sor** (27% fizetendő önadózás) | **67. sor** (27% levonható adó) | A60 04-es lap (`services_in`) |

---

## 3. Részletes Rendszerdöntések

### 3.1 Dual-Source Adatgyűjtés
- Az A60 és a 65-ös számítási motor (`calculate_hungarian_vat_return` és `useVatReturnData`) párhuzamosan olvassa a `nav_invoices` és az `invoices` táblát.
- A duplikáció kiszűrése bizonylatszám és adószám alapján garantált (`NOT EXISTS (SELECT 1 FROM nav_invoices ...)`).
- A közismert EU tech szolgáltatók (Google `IE6388047V`, Meta `IE9692928F`, Hetzner `DE202897834`, Adobe `IE4994993E`) automatikusan EU-s adószámmal és szolgáltatás besorolással azonosításra kerülnek.

### 3.2 4-Kártyás Statisztikai és Összefüggés Ellenőrző Fejléc
- A felületen 4 különálló kártya jelzi a törvényi egyezőséget és az esetleges eltéréseket a 65-ös bevallás és az A60 számlák között:
  1. *02. sor – Közösségi termékértékesítés*
  2. *11–16. sor – Közösségi termékbeszerzés*
  3. *91–92. sor – Közösségi szolgáltatásnyújtás*
  4. *18. sor – Közösségi szolgáltatás igénybevétele*
- Eltérés esetén borostyán figyelmeztető badge és tooltip jelzi a könyvelőnek a különbözet okát.

### 3.3 Élő Európai Bizottsági VIES REST API Integráció
- A VIES ellenőrzés közvetlenül az Európai Bizottság hivatalos REST API-ját (`https://ec.europa.eu/taxation_customs/vies/rest-api/ms/{countryCode}/vat/{vatNumber}`) hívja meg böngészőből.
- Timeout kezelés és formátum-ellenőrzés fallback biztosítja, hogy hálózati hiba esetén se álljon le a folyamat.
- A "VIES ellenőrzés" gomb mindig aktív és kattintható; a validált állapotokról zöld (Érvényes VIES) vagy piros (Érvénytelen) státuszbadge tájékoztat.
