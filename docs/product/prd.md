# Visibill — Product Requirements Document (PRD)

> **Verzió:** 2.0 | **Dátum:** 2026-09-07  
> **Kapcsolódó:** [Information Architecture](./information-architecture.md) · [Product Decisions](./decisions/index.md) · [Architecture Decisions](../architecture/decisions/index.md)

---

## 1. Termék Összefoglaló

A platform két szorosan együttműködő, de önálló alkalmazási rétegből áll:
1. **eaisyBill**: Intelligens pénzügyi és számlakezelő asszisztens magyar KKV vezetőknek és pénzügyeseknek.
2. **eaisyBooks (kódban: Accounty)**: Professzionális, több ügyfelet kezelő könyvelőirodai platform könyvelőknek, bérszámfejtőknek és irodavezetőknek.

### Felhasználói Szerepek:

#### eaisyBill Szerepkörök (Cég szintű RBAC):
| Szerep | Hozzáférés & Hatáskör |
|--------|-----------------------|
| `owner` | Teljes körű hozzáférés minden modulhoz, beállításhoz, cégtörléshez és tagkezeléshez |
| `admin` | Teljes hozzáférés a céges modulokhoz és felhasználók meghívásához |
| `member` | Hozzáférés a számlákhoz, tranzakciókhoz, GL kontírozáshoz és riportokhoz |
| `assistant` | Számlafeltöltés, bizonylatkezelés, olvasási jog |
| `viewer` | Kizárólag olvasási jogosultság a pénzügyi adatokhoz |
| `employee` | Kizárólag saját munkaidő/jelenlét és bizonylat rögzítése |
| `management` | Rendszerszintű üzemeltetési és audit hozzáférés (SuperAdmin) |

#### eaisyBooks Szerepkörök (Irodai szintű RBAC + Adatbázis Overrides):
| Szerep | Hozzáférés & Hatáskör |
|--------|-----------------------|
| `iroda_admin` | Teljes hozzáférés az irodai portfólióhoz, cégekhez, bérhez, adózáshoz, beállításokhoz, könyvelők hozzárendeléséhez és a jogosultsági mátrixhoz |
| `senior_könyvelő` | Portfólió, bérszámfejtési jóváhagyás, EV, TAO/KIVA, zárások, szakmai sablonok és jogszabályi paraméterek kezelése |
| `könyvelő` | Hozzárendelt ügyfelek operatív könyvelése (számlák, bér, pénztárkönyv, adónaptár, hiányzó tételek) |
| `asszisztens` | Bizonylatok feltöltése, hiányzó számlák ellenőrzése, operatív támogatás (zárások és jóváhagyások nélkül) |

> **Megjegyzés:** Az `accounty_module_permissions` tábla révén az `iroda_admin` felhasználónként és modulonként felülbírálhatja az írási/olvasási jogosultságokat (`can_read`, `can_write`).

---

## 2. Modulok & Funkciók

### 2.1 Onboarding

A felhasználó első élménye a regisztrációtól a produktív használatig.

| Funkció | Leírás | Ref |
|---------|--------|-----|
| Regisztráció | Email + jelszó, email verifikáció, social login nélkül | [P-001](./decisions/P-001-registration-flow.md) |
| Onboarding Wizard | 4-lépéses modal alapú kezdeti beállító (cég regisztráció/csatlakozás, projektek, kategóriák, NAV integráció + háttér sync) | [P-003](./decisions/P-003-empty-state.md) |
| Product Tour | 13 lépéses interaktív tour a fő funkciók és oldalak bemutatásához | [P-002](./decisions/P-002-product-tour.md) |
| Onboarding Checklist | Opcionális feladatlista: "Tölts fel 1 számlát", "Kösd össze a NAV-ot", "Importálj bank kivonatot" | [P-002](./decisions/P-002-product-tour.md) |
| Welcome Email | Regisztráció utáni üdvözlő email, drip campaign nélkül | [P-004](./decisions/P-004-welcome-flow.md) |
| Employee Regisztráció | Token-alapú meghívás (EmployeeRegister.tsx), korlátozott munkaidős hozzáféréssel | [P-001](./decisions/P-001-registration-flow.md) |

**Fejlesztendő:** Onboarding checklist implementálás.

---

### 2.2 Dashboard & Navigáció

A központi áttekintő és az alkalmazás navigációs struktúrája.

| Funkció | Leírás | Ref |
|---------|--------|-----|
| Dashboard | Fix elrendezésű widgetek: metrikák, ÁFA, árfolyam-különbözetek, párosítatlan tételek, számla státuszok, bevétel/kiadás chart, legutóbbi számlák, előfizetés | [P-005](./decisions/P-005-dashboard-layout.md) |
| Dashboard Preferences | Valuta váltó (HUF/EUR/USD), bruttó/nettó toggle, collapsible szekciók | [P-005](./decisions/P-005-dashboard-layout.md) |
| Árfolyam-különbözetek | Devizás számlák teljesítés vs. befolyás közötti MNB árfolyamkülönbözet: KPI kártyák, havi bar chart, tételszintű lebontás, TAO hatás becslés. Csak párosított (tranzakcióhoz rendelt) devizás tételekre. | — |
| Testreszabhatóság | Nincs widget drag & drop vagy hide/show — a preferences elegendőek | [P-009](./decisions/P-009-dashboard-customization.md) |
| Sidebar Navigáció | 19 menüpont → collapsible kategóriákba csoportosítva (7 csoport) | [P-006](./decisions/P-006-sidebar-structure.md) |
| Globális Dátumszűrő | Minden oldal azonos dátum kontextusban működik (GlobalDatePicker) | [IA](./information-architecture.md) |
| Keresés | Nincs globális keresés — oldalankénti szűrők | [P-039](./decisions/P-039-global-search.md) |

**Fejlesztendő:** Sidebar csoportosítás (flat → 7 collapsible kategória).

A részletes navigáció struktúrát lásd: [Information Architecture](./information-architecture.md)

---

### 2.3 Számla Kezelés

Számlák bevitele, feldolgozása, ellenőrzése és javítása.

| Funkció | Leírás | Ref |
|---------|--------|-----|
| Számla Lista | Táblázatos nézet szűrőkkel: státusz, típus, dátum, partner, összeg. Szűrők megőrződnek. | [P-010](./decisions/P-010-invoice-list.md) |
| Számla Szerkesztés | 2 dialógus: egyedi mező javítás (InvoiceEditDialog) + teljes szerkesztés tételekkel (InvoiceFullEditDialog). | [P-012](./decisions/P-012-invoice-editing.md) |
| Feltöltés | Multi-file batch upload (drag & drop), per-file progress bar. PDF/JPG/PNG támogatás. | [P-013](./decisions/P-013-upload-ux.md) |
| Email Bevitel | Automatikus email alias (cegnev@inbox.visibill.hu) → csatolt számlák feldolgozása | — |
| NAV Szinkron | NAV Online Számla API v3 → bejövő/kimenő számlák automatikus letöltése | — |
| Bulk Actions | Checkbox select → törlés, GL kategorizálás, export. "Select all" confirm dialógussal. | [P-015](./decisions/P-015-bulk-actions.md) |

**Fejlesztendő:** Multi-file batch upload, bulk actions.

---

### 2.4 Tranzakció & Párosítás

Banki tranzakciók importálása, AI-alapú párosítás számlákkal, manuális felülírás.

| Funkció | Leírás | Ref |
|---------|--------|-----|
| Tranzakció Lista | Táblázat + futár riport tab ugyanazon az oldalon. Szűrők: dátum, összeg, típus, párosítási státusz. | [P-016](./decisions/P-016-transaction-list.md) |
| AI Párosítás Megjelenítés | Confidence score + match type + gl_reasoning DB-ben tárolva. Részletek dialógusban (TransactionDetailsDialog). Lista nézetben vizuális confidence megjelenítés: TODO. | [P-017](./decisions/P-017-matching-display.md) |
| Manuális Felülírás | Dialógusban keresés + hozzárendelés, is_verified flag, minden felülírás audit logban (`match_transaction_overrides_log` tábla). Deviza-tudatos összeg-összehasonlítás: azonos pénznemű tranzakció↔számla direkt összehasonlítás, eltérő devizánál HUF konverzió. Minimum 10 számla megjelenítés összeg-proximítás szerint. | [P-018](./decisions/P-018-manual-matching.md) |
| ML tanulás | Felhasználói felülírásokból tanul: `match_transaction_overrides_log` tábla → partner név, összeg, típus pattern-ek rögzítése. A worker pipeline a jövőben ezeket a mintákat használja az AI párosítás pontosságának javítására. | — |
| Manuális Kifizetés | Virtuális tranzakció rögzítése nem-banki kifizetésekhez (Készpénz, Privát kártya, Tagi hitel). Automatikus párosítás a számlához. | [P-041](../business/decisions/041-manual-payment-recording.md) |
| Futár Riportok | GLS, MPL, Mixpack CSV import + parsing (3 futár tab) | — |

---

### 2.5 Főkönyv & Riportok

Főkönyvi kategorizálás, pénzügyi kimutatások és éves beszámoló.

| Funkció | Leírás | Ref |
|---------|--------|-----|
| GL Javaslat | AI-alapú GL szám javaslat confidence-szel és indoklással. Manuális elfogadás szükséges — nincs auto-accept. | [P-019](./decisions/P-019-gl-suggestion.md) |
| GL Twin Sync | Párosított számlák (NAV ↔ Beküldött) GL besorolása automatikusan szinkronban marad: ha az egyik tétel GL-jét módosítják, a "testvér" tétel is frissül egyetlen batch RPC hívásban. Matching: `invoice_number` ↔ `bizonylatsorszam` normalizálva + `line_number`. | [P-043](./decisions/P-043-gl-twin-sync.md) |
| GL Rezsi Mátrix | Főkönyvi számlaosztály-alapú rezsi-kategorizálás (5-ös költségnemek) és testreszabható Hozzárendelési Mátrix a 10 standard rezsikategóriára. | [P-079](./decisions/P-079-overhead-categories-gl-mapping.md) |
| XML Főkönyv Import | Könyvelőprogram által exportált XML főkönyvi kivonat feltöltése és feldolgozása. Támogatott formátumok: RLB/Novitax/Kulcs-Soft/KÖKÉNY. Automatikus számlatükör + tétel importálás `gl_uploads` táblába, audit trail-lel. | — |
| Eredménykimutatás | P&L oldal — bevételek és kiadások kimutatása. Főkönyvi adat (XML importból) és NAV számlaalapú összesítés. Szekció-szintű részletezés, korrekciók kezelése. | — |
| Mérleg | Balance Sheet oldal — eszközök és források. Főkönyvi adat (XML importból) és NAV számlaalapú összeállítás. Társasági adó és osztalék kalkuláció. | — |
| Beszámoló | Workflow: draft → validated → finalized → submitted. 19 kiegészítő melléklet sablon. Frozen data snapshot véglegesítéskor. | [P-020](./decisions/P-020-report-workflow.md) |
| Export | CSV (gépi feldolgozás) + PDF (nyomtatás, megosztás). Excel nem prioritás. | [P-021](./decisions/P-021-export-formats.md) |

**Fejlesztendő:** CSV + PDF export implementálás.

---

### 2.6 Értesítések

Email és in-app értesítési rendszer.

| Funkció | Leírás | Ref |
|---------|--------|-----|
| Email Értesítések | Típusonkénti toggle: számla feldolgozás, hibák, NAV sync, tranzakció párosítás, heti/havi összefoglaló | [P-022](./decisions/P-022-email-notifications.md) |
| In-app Értesítés | Real-time toast értesítések. Nincs értesítési center (harang ikon). | [P-023](./decisions/P-023-notification-center.md) |
| Összefoglaló Email | Heti és havi: minimál számok + trendek. Backend-only (Edge Function + cron), nincs UI felület. | [P-024](./decisions/P-024-summary-emails.md) |

---

### 2.7 Beállítások

Cég és felhasználói beállítások, csapatkezelés.

| Funkció | Leírás | Ref |
|---------|--------|-----|
| Settings Struktúra | 5 szekció egy oldalon: Business, Profile, Notifications, Security, System | [P-025](./decisions/P-025-settings-structure.md) |
| Cégprofil | Cégnév, adószám, cím, email alias kezelés, share token, telephely (HQ/branch) | [P-026](./decisions/P-026-company-profile.md) |
| Árfolyam-forrás | Cégenkénti beállítás: melyik árfolyamforrás (MNB/EKB/Bank) legyen a devizás különbözet számításnál. `company_fx_settings` tábla. | — |
| Csapattagok | Share token alapú csatlakozás + tag meghívás email-lel. Tag eltávolítás admin jogosultsággal. | [P-027](./decisions/P-027-team-management.md) |

> **Megjegyzés:** A korábbi Stripe-alapú előfizetés rendszer (Pricing oldal, SubscriptionContext, limit kezelés) eltávolítva 2026-06-07-én. Az értékesítés egyszeri díjas modellre vált — lásd [004-pricing-model.md](../business/decisions/004-pricing-model.md).

---

### 2.8 eaisyBooks (Könyvelőirodai Platform & ERP)

Az eaisyBooks a könyvelőirodák és bérszámfejtők számára dedikált, több ügyfelet (multi-client) aggregáló munkafelület. Teljes körűen kezeli a könyvelési és bérügyi folyamatokat, az ügyfél-kommunikációt és a hatósági adatszolgáltatásokat.

#### 2.8.1 Portfólió Menedzsment & Ügyfélkezelés (`/eaisybooks` / `/eaisybooks/portfolio`)
- **Háromféle Nézet:**
  - **Grid nézet:** Vizuális kártyák cégenként státuszjelzőkkel, hiányzó számlák számával, zárási készültséggel.
  - **Lista nézet:** Kompakt táblázat gyorskeresővel, rendezéssel és szűréssel.
  - **Kanban tábla:** Drag-and-drop státuszmozgatás a havi zárási szakaszok között (*Adatbekérés folyamatban* → *Feldolgozás alatt* → *Ellenőrzésre vár* → *Havi zárás kész*).
- **Szűrők:** Felelős könyvelő, adózási forma (EV, KIVA, TAO, KATA), zárási státusz, sürgősség.
- **KPI Kártyák:** Aktív ügyfelek száma, feldolgozatlan számlák, lezáratlan bérszámfejtések, közeledő határidők.
- **Ügyfél Regisztráció & Onboarding (`/eaisybooks/onboarding/new-client`):** Manuális és NAV-alapú ügyfélfelvétel, adószám validáció, könyvelői felelős és szerepkör kiosztása.

#### 2.8.2 Jóváhagyási Sor & Hiányzó Számlák
- **Jóváhagyási Sor (`/eaisybooks/approval-queue`):** Konszolidált lista az összes ügyfél jóváhagyásra váró számláiról és tételeiről. Tömeges (batch) elfogadás vagy elutasítás indoklással.
- **Hiányzó Számlák Portfólió Nézet (`/eaisybooks/missing-invoices`):** Az AI és NAV adategyeztetés által detektált hiányzó bizonylatok (pl. banki terhelés számla nélkül, vagy bejövő teljesítés igazolás nélkül).
- **Email Preview Modal:** Címzett, tárgy és testreszabható magyar nyelvű levélsablon előnézete küldés előtt.
- **Ügyfélportál & Magic Link (`/eaisybooks/client-portal`):** Jelszómentes, biztonsági tokennel ellátott egyedi link generálása, ahol az ügyfél közvetlenül töltheti fel a hiányzó bizonylatokat mobilról vagy asztali gépről.

#### 2.8.3 Adónaptár & Riasztási Központ
- **Adó Naptár (`/eaisybooks/tax-calendar`):** Aggregált naptár nézet (havi, heti) az összes ügyfél ÁFA, bér (08-as), HIPA, TAO és KIVA fizetési és bevallási határidejéről.
- **Riasztási Központ (`/eaisybooks/alerts`):** Valós idejű push és in-app figyelmeztetések kritikus eseményekről: NAV technikai felhasználó token lejárat, elakadt szinkronizáció, negatív pénztáregyenleg, határidő-túllépés.

#### 2.8.4 Bérszámfejtési Ciklus & HR Modul (`/eaisybooks/:companyId/:dateRange/payroll`)
- **4 Fázisú Havi Bérszámfejtési Workflow:**
  1. *Előkészítés / Jelenlét (Draft):* Jelenléti ív rögzítése (munkanapok, szabadság, betegszabadság, táppénz, túlóra), cafeteria és jutalmak beállítása.
  2. *Számfejtés (Calculation):* Bruttó-nettó bérkalkuláció, kedvezmények érvényesítése (25 év alattiak, személyi, első házasok, családi kedvezmény), munkáltatói terhek (Szocho 13%).
  3. *Könyvelői Ellenőrzés (Approval):* Tételek auditálása, eltérések jelzése.
  4. *Lezárás & Publikálás (Closed):* Bérjegyzékek generálása, banki átutalási fájl exportálása, 08-as bevallás véglegesítése.
- **Foglalkoztatotti Törzs:** Többes jogviszony kezelése egyazon dolgozónál, szerződésmódosítások idővonala, kiléptető varázsló (leszámoló lapok, igazolások automatikus kitöltése).
- **Tömeges Import & NAV 08 ÁNYK XML Rekonstrukció (`/payroll/filings`):** Korábbi könyvelőprogramból vagy ÁNYK-ból származó havi 08-as XML fájlok beolvasása, amelyből a rendszer automatikusan felépíti a dolgozói adatokat, jogviszonyokat és a múltbeli bérösszegeket.
- **E-Bérjegyzék Ügyfélportál:** Titkosított, jelszóval vagy kétlépcsős azonosítással védett portál a dolgozók felé a havi bérjegyzékek letöltésére.

#### 2.8.5 Egyéni Vállalkozás (EV) & Egyszeres Könyvvitel (`/eaisybooks/:companyId/:dateRange/ev`)
- **8 Céges Lapfül (Radix UI Tabs):**
  1. *Áttekintés:* Vállalkozói bevételek, költségek, aktuális adóforma mutatói, keretfigyelők.
  2. *Kalkulátor:* Interaktív kalkulátor Átalányadó, Vállalkozói SZJA (VSZJA) és KATA formákhoz, költséghányad (40%, 80%, 90%) és szakképzettség paraméterekkel.
  3. *Pénztárkönyv:* Törvényes egyszeres könyvvitel: bevételek és költségek analitikus könyvelése, időszaki pénztárkönyv zárási varázsló, stornózási funkció, PDF és Excel nyomtatvány generálás.
  4. *Járulékok:* Főfoglalkozású, másodállású és kiegészítő tevékenységet folytató EV TB-járulék (18,5%) és szocho (13%) megállapítása minimum járulékalapok figyelembevételével.
  5. *Bevallások:* Havi és negyedéves járulékbevallások (58-as), ÁFA bevallások, HIPA és éves SZJA bevallások XML generálása ÁNYK-ba.
  6. *Nyilvántartások:* 14 kötelező törvényi nyilvántartás (Vevők, Szállítók, Tárgyi eszközök, Beruházási és felújítási költségek, Készletek, Gépjármű-használati nyilvántartás / útnyilvántartás, Szigorú számadású nyomtatványok, stb.).
  7. *Adóoptimalizáció:* AI-alapú összehasonlító elemzés a legkedvezőbb adózási mód kiválasztására az aktuális évre és a következő adóévre.
  8. *Életút:* EV státuszváltozások naplózása (szüneteltetés kezdet-vég, telephely módosítás, adónem váltások).
- **Szervezeti Könyvviteli Módok:** Nemcsak EV-k, hanem egyéb egyszeres könyvvitelt vezető szervezetek támogatása: Civil szervezetek (alapítványok, egyesületek), Társasházak, Egyszerűsített beszámolót készítő jogi személyek.

#### 2.8.6 Társasági Adó (TAO / KIVA) Modul (`/eaisybooks/:companyId/:dateRange/tao`)
- **7 Lapfül:**
  1. *Áttekintés:* Társasági adóalap és várható adókötelezettség folyamatos követése év közben.
  2. *Adózási Mód:* TAO vs KIVA státusz, belépési/kilépési feltételek vizsgálata.
  3. *Adónaptár:* Előlegfizetési határidők és összegek nyilvántartása.
  4. *Év Végi Zárás:* Zárási ellenőrző lista, adóalap-korrekciós tételek (növelő és csökkentő tételek rögzítése: értékcsökkenés, céltartalék, reprezentáció, bírságok).
  5. *Társasági Adó Kalkulátor:* 9%-os TAO alap számítás, beruházási adókedvezmények, veszteségelhatárolás.
  6. *KIVA Kalkulátor:* 10%-os Kisvállalati adó kalkuláció személyi jellegű kifizetések és jóváhagyott osztalék alapján.
  7. *TAO vs KIVA Összehasonlító:* Szimulációs modell a vállalkozás számai alapján a legoptimálisabb társasági adózási nem kiválasztására.

#### 2.8.7 Könyvelési Szabálytár & Céges Prompt Tár (`/eaisybooks/:companyId/:dateRange/prompts`)
- **AI Kontírozási Szabályok (`company_prompt_rules`):** Cégre szabott gépi tanulási és LLM szabályok rögzítése (pl. *"Minden Google Ireland számlát a 529-es szoftverlicenc főkönyvi számra kontírozz fordított ÁFA-val"*).
- **Hibahatár és Megbízhatósági Küszöb:** Minimális konfidencia-érték, amely alatt a rendszer emberi könyvelői jóváhagyást kér.

#### 2.8.8 Kormányzás & Irodai Adminisztráció (`/eaisybooks/admin/*`)
- **Audit Napló (`/eaisybooks/admin/audit-log`):** Minden könyvelői művelet, bizonylatmódosítás, zárási lépés és adatletöltés naplózása felhasználóval és időbélyeggel.
- **GDPR & Adatmegőrzés (`/eaisybooks/admin/gdpr`, `/data-retention`):** Számviteli törvény szerinti 8 éves bizonylatmegőrzési zárolás, anonimizálási folyamatok.
- **Szakmai Paraméterek:** Sablonok (`/admin/templates`), FEOR és jogviszonykódok (`/admin/job-codes`), hatósági adómértékek (`/admin/tax-parameters`), jogszabály-változások tára (`/admin/legal-updates`).
- **Jogosultságkezelő Mátrix (`/admin/permission-matrix`):** Felhasználónkénti és modulonkénti finomhangolt írási/olvasási jogosultságok felülbírálata (`accounty_module_permissions`).
- **Könyvelők Menedzsmentje (`/admin/accountants`):** Irodai munkatársak meghívása, ügyfelekhez rendelése és kapacitás-követése.

#### 2.8.9 Hivatalos Integrációk & Képviselet
- **Cégkapu / KÜNY Tárhely (`/cegkapu`):** Hivatalos tárhely szinkronizáció, NAV és önkormányzati küldemények automatikus letöltése és bizonylattárhoz csatolása.
- **Képviselet & EGYKE Meghatalmazások (`/representation`):** Meghatalmazások érvényességének, típusának és képviselői jogosultságainak elektronikus nyilvántartása.
- **Cégstruktúra (`/structure`):** Telephelyek, költséghelyek és projektek hierarchikus leképezése a könyvelési analitikához.

**Kulcs számítási paraméterek (2026):**

| Paraméter | Érték |
|-----------|-------|
| SZJA kulcs | 15% |
| Vállalkozói SZJA (VSZJA) | 9% |
| Társasági adó (TAO) | 9% |
| Kisvállalati adó (KIVA) | 10% |
| TB-járulék | 18,5% |
| Szociális hozzájárulási adó (Szocho) | 13% |
| Minimálbér (2026) | 322.800 Ft/hó |
| Garantált bérminimum (2026) | 373.200 Ft/hó |
| Átalány költséghányadok | 40% (általános) / 80% (kiemelt) / 90% (kiskereskedelem) |
| KATA havi tétel | 50.000 Ft |
| KATA éves keret | 18.000.000 Ft |
| Alanyi ÁFA-mentesség keret | 20.000.000 Ft |

---

## 3. Fejlesztendő Funkciók Összesítése

| Funkció | Modul | Döntés |
|---------|-------|--------|
| Onboarding checklist | 2.1 Onboarding | P-002 |
| Multi-file batch upload | 2.3 Számla | P-013 |
| Bulk actions (checkbox) | 2.3 Számla | P-015 |
| CSV + PDF export | 2.5 Riportok | P-021 |
| ML model tanítás felülírásokból | 2.4 Tranzakció | — |
| EKB/bank árfolyam integráció | 2.2 Dashboard | — |
| Éves árfolyam-átértékelés | 2.5 Riportok | — |

---

## 4. Nyitott Döntés

| Döntés | Leírás | Opciók |
|--------|--------|--------|
| 004 | Egyszeri díj struktúra és összeg | Lásd [004-pricing-model.md](../business/decisions/004-pricing-model.md) |
