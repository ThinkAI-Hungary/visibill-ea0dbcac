# P-170: EB-0258 Könyvelési Dátum-alapértelmezés, Összevont Főkönyvi Nézet, Devizaárfolyam Bankválasztó és NAV Adószám Auto-kitöltés

## Kontextus és Üzleti Igény
- **Azonosító:** EB-0258 / P-170
- **Ügyfél:** Lendvai Ádám (Ván Iroda / Kolos Transport Kft., brief: `tests/docs/lendvai_feature/258.pdf`)
- **Dátum:** 2026-10-08
- **Státusz:** Elfogadva és Implementálva

A magyar könyvelési gyakorlatban és a könyvelőirodák mindennapi munkájában a számla kiállításának kelte (kibocsátás) helyett döntő többségben a **gazdasági teljesítés dátuma** határozza meg a könyvelési időszakot, az adófizetési kötelezettséget és a főkönyvi időbeli elhatárolást. A korábbi rendszerben a kibocsátás dátuma volt a főkönyv alapértelmezett szűrési alapja, ami folyamatos kézi átállítást igényelt az ügyféltől.

Emellett a nagy forgalmú cégeknél (pl. logisztikai és fuvarozási vállalkozásoknál) a főkönyvi kivonat megnyitásakor több száz vagy ezer alábontás és tételes tétel automatikus kibontása áttekinthetetlenné tette a képernyőt. Az elvárás az volt, hogy a főkönyv cégprofilból állíthatóan **összevont (aggregált) nézetben** nyíljon meg, ahol kizárólag a főkönyvi számlaosztályok összefoglaló egyenlegei látszanak, és a mélyebb szintek csak explicit felhasználói kattintásra bontakozzanak ki.

Harmadrészt, a devizás számlák és banki tételek kezelésénél, valamint az év végi kötelező devizaátértékelésnél a cégek a számviteli politikájukban rögzített bank hivatalos árfolyamait alkalmazzák (közép-, vétel- vagy eladási árfolyam). Szükség volt egy teljes, ~45 pénzintézetet tartalmazó hivatalos bankkatalógusra, ahol mind a napi könyvelés, mind az év végi fordulónapi átértékelés bankja és árfolyamtípusa kiválasztható.

Negyedrészt, a cégadatok rögzítésének gyorsítására a cégbeállítások felületén adószám alapú egykattintásos NAV adószám-lekérdezés és automatikus cégadat-kitöltés (cégnév, székhely, adószám) került bevezetésre.

---

## Termékdöntések és Funkcionális Viselkedés

### 1. Teljesítés Dátumának Elsődlegessége (`gl_date_basis: 'teljesites'`)
- A rendszer alapértelmezett könyvelési dátuma mind az adatbázis sémában (`company_settings.gl_date_basis`), mind a frontend kliens állapotban a `'teljesites'` (gazdasági teljesítés dátuma).
- A Főkönyvi Kivonat oldalra belépve az alapértelmezett választás a "Teljesítés", felülbírálható a felső gombsoron vagy cégprofil szinten.

### 2. Összevont (Aggregált) Főkönyvi Nézet (`gl_default_view_mode: 'osszevont'`)
- A cégbeállításokban (`BusinessSection.tsx`) beállítható:
  - **Összevont nézet (Alapértelmezett / Ajánlott):** A főkönyv megnyitásakor csak a fő számlaosztályok (`1`, `2`, `3`, `4`, `5`, `8`, `9`, `UNCLASSIFIED`) nyílnak ki, minden alábontás (pl. vevők `311`, szállítók `454`, áfa `466`) és tételes sor csukva marad.
  - **Tételes nézet:** A hagyományos kibontott nézet, ahol a leggyakoribb analitikus gyűjtők azonnal kinyitva jelennek meg.
- A `GeneralLedgerTable` megőrzi a felhasználó helyi interaktív kibontásait a munkamenetben, de új cégválasztáskor és alapértelmezésben a cég profiljának megfelelően jeleníti meg az adatokat.

### 3. Devizaárfolyam Pénzintézet és Árfolyamtípus Választó
- Új beállítási blokk a céges profilban (`BusinessSection.tsx`):
  - **Könyveléshez használt bank:** Lenyíló választó a teljes hivatalos magyarországi és nemzetközi bankkatalógussal (MNB, MFB, OTP, CIB, Erste, Raiffeisen, MBH, K&H, Gránit, MagNet, Revolut, Wise stb.).
  - **Könyvelési árfolyam típusa:** `mid` (Középárfolyam - KKV standard), `buy` (Vételi), `sell` (Eladási).
  - **Év végi átértékelés bankja és típusa:** Külön konfigurálható a fordulónapi mérlegkészítéshez.

### 4. NAV Adószám Auto-kitöltés Cégbeállításoknál
- A `BusinessSection.tsx` felületen az adószám mező mellett közvetlen **"NAV lekérdezés"** gomb érhető el.
- Bármely érvényes 8 vagy 11 jegyű magyar adószám beírása után a gomb meghívja a `queryTaxpayerFromNav` Edge Function-t, és automatikusan beilleszti a cég hivatalos cégbírósági/NAV nevét, standard formátumú székhelycímét és formázott adószámát.
