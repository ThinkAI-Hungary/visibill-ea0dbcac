# BDR 076 — RLB-60 FOKTORZS (.RFT / .DBF) Számlatükör Formátum Feldolgozása és Importálása

**Dátum:** 2026-10-15  
**Státusz:** ✅ Decided  
**Szerző:** Áron & Antigravity  
**Érintett modulok:** Számlatükör Menedzsment (`UploadChartOfAccountsModal`), Könyvvizsgálói Feladás (`UploadAuditXmlModal`), RLB Parser & Import Service (`src/lib/rlb/`)  
**Kapcsolódó döntések:** [073](./073-gl-opening-continuity-virtual-banks-and-single-currency-cash-policy.md), [P-102](../product/decisions/P-102-chart-of-accounts-import-ux.md), [P-187](../product/decisions/P-187-rlb-general-ledger-basic-and-extended-templates-ux.md), [P-192](../product/decisions/P-192-rlb-foktorzs-rft-chart-of-accounts-import-ux.md)

---

## 1. Üzleti Háttér és Problémafelvetés

Az RLB-60 kettős könyvviteli programot használó könyvelőirodák és partnereik (pl. WR Home Kft.) az új cégek átvételekor vagy évnyitáskor a meglévő főkönyvi számlatükröt nem feltétlenül Excel vagy CSV formátumban exportálják, hanem közvetlenül az RLB adatbázis állományából nyerik ki. Ez a fájl tipikusan `FOKTORZS.RFT` vagy `FOKTORZS_[CÉGNÉV] [ÉV].RFT` néven érkezik.

Bár a kiterjesztése `.RFT` (ami a felhasználók számára könnyen megtévesztő lehet és Rich Text Formatnak tűnhet), a valóságban egy **bináris dBASE III / Visual FoxPro (DBF) formátumú adatbázistábla**, amely DOS CP852 kódolással rögzíti a számlaszámokat és megnevezéseket.

Korábban a Visibill számlatükör feltöltő felülete kizárólag `.csv`, `.xlsx`, `.xls`, `.pdf`, `.txt` és könyvvizsgálói `.xml` fájlokat támogatott, így a könyvelők kénytelenek voltak külső segédprogramokkal Excelbe konvertálni a törzset, ami karakterkódolási hibákhoz (mojibake) és adminisztrációs teherhez vezetett.

---

## 2. Üzleti és Számviteli Döntés

1. **Bináris RLB FOKTORZS (.RFT / .DBF) Natív Támogatása:**
   - A Visibill közvetlenül, kliensoldali bináris parserrel értelmezi a dBASE III / Visual FoxPro fejlécet és a rekordstruktúrát.
   - A feldolgozás sebessége < 10 ms egy tipikus 600–1000 tételes számlatükör esetén, zéró szerverterheléssel és azonnali felületi visszajelzéssel.

2. **Determinisztikus Magyar Ékezetes Dekódolás (CP852 / Win1250):**
   - A DOS CP852 kódolás speciális bájtjait (`0xFB` = `ű`, `0xDB` = `Ű`, `0xF5` = `ő`, `0xD5` = `Ő`, valamint `á`, `é`, `í`, `ó`, `ö`, `ü`) a rendszer hibátlanul átfordítja modern UTF-8 karakterekké, megszüntetve a hibás megnevezéseket.

3. **Teljes Számlatükör Fastruktúra (1–4 szintű számlák):**
   - Az RLB FOKTORZS tartalmazza mind az 1 számjegyű számlaosztályokat (`1`, `2`, `3`...), a 2 számjegyű számlacsoportokat (`11`, `31`...), a 3 számjegyű szintetikus számlákat (`111`, `311`...), mind a 4 vagy több számjegyű analitikus számlákat (`3811`, `4541`...).
   - A rendszer valamennyi aktív (nem törölt) rekordot beemeli a `gl_accounts` táblába, amelyből a Visibill `GeneralLedgerTable` automatikusan felépíti a hierarchikus fastruktúrát.

4. **Kötelező Kettős Könyvviteli Technikai Számlák (491, 492) Biztosítása:**
   - A kettős könyvviteli mérlegnyitási és zárlati folyamatokhoz elengedhetetlen a `491 Nyitó mérleg számla` és a `492 Záró mérleg számla`.
   - Amennyiben a betöltött RLB törzs ezeket nem tartalmazná, a parser automatikusan kiegészíti a számlatükröt ezekkel a kötelező elemekkel.

5. **Kettős Elérési Útvonal a Felületen:**
   - **Elsődleges:** `UploadChartOfAccountsModal` (Főkönyvi kivonat, Naplók menüpont, Nyitó napló varázsló).
   - **Másodlagos:** `UploadAuditXmlModal` (Könyvvizsgálói feladási felület) — automatikus formátumfelismeréssel és dedikált számlatükör előnézeti kártyával.

---

## 3. Hatás és Eredmények

* **Azonnali könyvelői onboarding:** Egy RLB-ből érkező új ügyfél teljes számlatükre (pl. Mandala Fogadó, WR Home Kft.) másodpercek alatt átvehető bármiféle előzetes fájlkonverzió nélkül.
* **100%-os ékezethelyesség:** A Vagyoni értékű jogok, Vevőkövetelések, Házipénztár megnevezések hibátlanul jelennek meg a felületen és az exportokban.
* **Zéró szerverköltség:** A bináris feldolgozás teljes egészében a böngésző memóriájában történik.
