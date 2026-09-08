-- ==============================================================================
-- Migration: 20260908190000_update_kb_overhead_categories.sql
-- Description: Update Knowledge Base article 'chart-of-accounts-and-posting-rules'
--              to document the Főkönyvi Számlaosztály-Alapú Rezsi-Kategorizálás
--              and Hozzárendelési Mátrix functionality.
-- ==============================================================================

UPDATE public.knowledge_base_articles
SET 
  summary = 'Főkönyvi számlaosztály-alapú rezsikategóriák, automatikus kontírozási szabályok és a Hozzárendelési Mátrix.',
  content = '# Számlatükör, Rezsi Kategóriák és Hozzárendelési Mátrix

A **Kategóriák** menüpont a Főkönyv egy speciális, vezetői és rezsi-összesítő nézeteként működik. A rendszer a könyvelési tételek és bizonylatok alapján automatikusan csoportosítja a cég működési költségeit a hozzárendelt főkönyvi számlaosztályok szerint.

---

### 1. Alapértelmezett Rezsi Kategóriák
Minden cég számára automatikusan rendelkezésre áll a 10 standard rezsikategória a magyar számlatükör 5-ös (Költségnemek) számlaosztályaival:
- **Közüzemi díjak:** `521` (Villamosenergia), `522` (Gáz, víz, távhő)
- **Irodaszer:** `511`, `512`, `513` (Nyomtatvány, irodaszer, üzemanyag)
- **Bankköltség:** `532`, `538` (Banki díjak, tranzakciós illeték, jutalékok)
- **Szállítás:** `524`, `529` (Fuvardíj, szállítási díj, postaköltség)
- **IT és szoftver:** `523` (Szoftverlicenc, bérleti díj, tárhely, internet)
- **Bérek és juttatások:** `541`, `542`, `551` (Bruttó bér, személyi jellegű egyéb)
- **Adók és járulékok:** `561`, `562`, `563` (Szocho, KIVA, cégautóadó)
- **Marketing:** `525`, `526` (Reklám, hirdetés, PR, marketing)
- **Könyvelés:** `527` (Könyvelési, jogi és szakértői díjak)
- **Egyéb működési költség:** `531`, `539`, `559`, `579` (Egyéb igénybe vett szolgáltatások & egyéb költségek)

---

### 2. Automatikus Főkönyv-Alapú Szűrés
- A worker a számlákat automatikusan főkönyvi számlaszámra kontírozza (pl. a villanyszámlára rákerül a `5211 Villamosenergia` Tartozik számlaszám).
- A kategóriák nézet a könyvelési naplósorokból (`acc_journal_lines`) és a számlákból automatikusan összesíti a megadott számlaosztályokba tartozó tételeket.
- Nem szükséges manuálisan kategóriát választani a számlákhoz, mert a főkönyvi besorolás alapján a rendszer magától csatlakoztatja azokat.

---

### 3. Hozzárendelési Mátrix (Mapping Matrix) Testreszabás
Ha egy adott cégnél máshogy kell elszámolni vagy kategóriákba sorolni egy költséget:
1. Kattints a Kategóriák oldalon a szerkeszteni kívánt kategória **Szerkesztés (ceruza)** ikonjára.
2. A megjelenő ablak **Hozzárendelési Mátrix** felületén:
   - Gördülő menüből választhatsz a standard 5-ös számlaosztályok közül, vagy beírhatsz egyedi főkönyvi számlaszámot (pl. `5211`).
   - Új számlaosztályt adhatsz hozzá a `+ Új számlaosztály` gombbal.
   - Törölhetsz hozzárendelést a kuka ikonra kattintva.
3. Mentés után a főkönyvi tételek az új mátrix-beállítások szerint frissülnek.',
  tags = ARRAY['számlatükör', 'kategória', 'főkönyv', 'hozzárendelési mátrix', 'rezsi', 'kontírozás']
WHERE id = 'chart-of-accounts-and-posting-rules';
