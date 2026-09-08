# P-079 — Kategóriák: Főkönyvi Számlaosztály-Alapú Rezsi-Kategorizálás és Hozzárendelési Mátrix

> **Státusz:** ✅ Decided & Implemented  
> **Dátum:** 2026-09-08  
> **Implementálva:** `Onboarding.tsx`, `CategoryAccordionItem.tsx`, `20260908180000_overhead_categories_gl_mapping.sql`, `20260908190000_update_kb_overhead_categories.sql`

---

## Kontextus

Korábban a Kategóriák felületen a felhasználók egyéni kategória címkéket hozhattak létre, és a számlákat manuálisan társították a kategóriákhoz. A könyvelői visszajelzések alapján a cégek működési költségeit (rezsi) cégenként eltérően kell és érdemes besorolni, valamint a worker pipeline automatikusan főkönyvi számlaszámra (5-ös költségnemekre) tesz minden beszerzési tételt.

A kategóriák működését átalakítottuk úgy, hogy a Kategóriák felület a **Főkönyv speciális, vezetői rezsi-összesítő nézetévé** váljon, amely a főkönyvi számlaosztályok és alosztályok alapján automatikusan csoportosítja a költségeket.

---

## Döntések

### 1. Alapértelmezett Rezsi Kategóriák Auto-Provisioning
Minden meglévő és új cégnél a rendszer (és a worker) automatikusan létrehozza a 10 standard rezsikategóriát és hozzárendeli a magyar számlatükör 5-ös számlaosztályait:

- **Közüzemi díjak:** `521` (Villamosenergia), `522` (Gáz, víz, távhő)
- **Irodaszer:** `511`, `512`, `513` (Nyomtatvány, irodaszer, üzemanyag)
- **Bankköltség:** `532`, `538` (Banki díjak, tranzakciós illeték, jutalékok)
- **Szállítás:** `524`, `529` (Fuvardíj, szállítási díj, postaköltség)
- **IT és szoftver:** `523` (Szoftverlicenc, bérleti díj, tárhely, internet)
- **Bérek és juttatások:** `541`, `542`, `551` (Bruttó bér, személyi jellegű egyéb kifizetések)
- **Adók és járulékok:** `561`, `562`, `563` (Szocho, KIVA, cégautóadó)
- **Marketing:** `525`, `526` (Reklám, hirdetés, PR, marketing)
- **Könyvelés:** `527` (Könyvelési, jogi és szakértői díjak)
- **Egyéb működési költség:** `531`, `539`, `559`, `579` (Egyéb igénybe vett szolgáltatások & egyéb költségek)

### 2. Hozzárendelési Mátrix (Mapping Matrix) Testreszabás
A kategória szerkesztése és új kategória létrehozása dialógusban felépítésre került a **Hozzárendelési Mátrix**:
- Gördülő választó a leggyakoribb 5-ös számlaosztályos költségszámlákkal.
- Egyedi főkönyvi számlaszám / alosztály megadási lehetőség (pl. `5211`).
- Új számlaosztály hozzáadása (`+ Új számlaosztály`) és törlése.

### 3. Főkönyv-Alapú Szűrés és Vizuális Megjelenítés
- A kategóriák összegeit és darabszámait a könyvelési naplósorokból (`acc_journal_lines`) és a besorolt számlákból gyűjti össze a rendszer.
- A kategóriasorokban jól látható G/L számlajelvények (pl. `521`, `522`) mutatják a társított főkönyvi számokat.

---

## Kapcsolódó Fájlok
- `src/pages/Onboarding.tsx` — `/categories` felület és Hozzárendelési Mátrix UI
- `src/components/CategoryAccordionItem.tsx` — G/L számlajelvények megjelenítése
- `supabase/migrations/20260908180000_overhead_categories_gl_mapping.sql` — `gl_accounts` adatbázis oszlop és `ensure_default_categories` tárolt eljárás
- `supabase/migrations/20260908190000_update_kb_overhead_categories.sql` — Tudástár cikk frissítés
- `src/test/accounty/categoriesGlMapping.test.ts` — Egységtesztek
