---
name: visibill-knowledge-base-update
description: Query, insert, update, or archive articles in the Visibill/eaisybooks knowledge base (knowledge_base_categories, knowledge_base_articles). Use whenever the user asks to update the knowledge base, add new knowledge for the AI chat assistant, modify existing articles, or improve RAG retrieval accuracy. Triggers on "/visibill-knowledge-base-update", "tudástár frissítés", "knowledge base update", "tudásbázis frissítés", "új cikk a tudástárba", "bővítsd a tudástárat", "adj hozzá tudást az asszisztensnek", "módosítsd a tudásbázist", "cikk hozzáadás", "tudástár manipulálás", "rag tudásbázis".
---

# 📚 Visibill Knowledge Base Update Skill

Ez a skill vezérli a Visibill és eaisyBooks Tudástár (`knowledge_base_categories`, `knowledge_base_articles`) karbantartását, új szakmai/rendszer témák felvitelét, valamint meglévő cikkek frissítését és finomhangolását.
A cél, hogy az AI Chat Asszisztens (`accounty-ai-chat` Edge Function) a valós idejű RAG (Retrieval-Augmented Generation) lekérdezések során (`search_knowledge_base` RPC) mindig tűpontos, naprakész és strukturált szakmai válaszokat tudjon adni a felhasználóknak.

---

## 🏛️ Architektúra Áttekintés

A Tudástár három rétegben él a rendszerben:

1. **PostgreSQL Adatbázis (`knowledge_base_articles` & `categories`)**:
   - `fts TSVECTOR GENERATED ALWAYS AS (to_tsvector('simple', title || ' ' || summary || ' ' || content)) STORED`
   - GIN index: `idx_kb_articles_fts`
   - Kereső RPC: `public.search_knowledge_base(search_query, page_path, target_category, match_limit)`
   - RLS: `authenticated` (csak SELECT és `is_published = true`), írás kizárólag `service_role` vagy migráció útján.
2. **AI RAG Retrieval Pipeline (`supabase/functions/accounty-ai-chat/index.ts`)**:
   - Minden felhasználói üzenetnél a rendszer levágja a kérdés szövegét (max. 300 kar.), és az aktuális oldal útvonalával (`context.page`) meghívja a `search_knowledge_base` RPC-t.
   - Az illeszkedő cikkek címét, összefoglalóját és Markdown leírását a rendszer közvetlenül a nyelvi modell rendszerpromptjába injektálja.
3. **Frontend Fallback Dataset (`src/data/knowledgeBaseFallback.ts`)**:
   - Statikus TypeScript dataset, amely garantálja, hogy a Tudástár felület offline, lassú hálózat vagy adatbázis-elérési hiba esetén is 100%-ban működőképes maradjon.

---

## 🔄 Kötelező Végrehajtási Folyamat (Workflow)

```
[ Kérés / Új Tudás ] ──► 1. Téma felmérés & Duplikáció-ellenőrzés
                              │
                              ▼
                         2. RAG-optimalizált cikk felépítése
                              │
                              ▼
                         3. Adatbázis frissítés (Idempotens SQL)
                              │
                              ▼
                         4. Frontend Fallback szinkronizáció
                              │
                              ▼
                         5. RAG Retrieval tesztelés (Rank validáció)
                              │
                              ▼
                         6. Docs frissítés & Graphify update
```

---

### 1. Lépés: Téma felmérése & Duplikáció-ellenőrzés

Mielőtt új cikket hozol létre, vizsgáld meg, létezik-e már a téma a meglévő cikkek között!

1. **Keresés az adatbázisban / meglévő fájlokban:**
   - Ellenőrizd a `src/data/knowledgeBaseFallback.ts` fájlt vagy futtass keresést SQL-ben:
     ```sql
     SELECT id, category_id, title, summary, menu_path, is_published 
     FROM public.knowledge_base_articles 
     WHERE title ILIKE '%keresett_téma%' OR id ILIKE '%keresett_téma%';
     ```
2. **Döntési pont:**
   - **Ha a cikk már létezik:** Végezz célzott `UPDATE`-et (bővítés, pontosítás, elavult rész felülírása).
   - **Ha a téma új:** Határozd meg az új cikk egyedi slug-ját (`id`), és a hozzá passzoló kategóriát.
   - **Ha a funkció megszűnt:** Állítsd `is_published = false`-ra (soha ne törölj fizikai sort referenciák sérülése nélkül!).

#### Elérhető Kategóriák (`category_id`):
| ID | Magyar Név | Célterület |
|---|---|---|
| `basics` | Alapok & Vezérlőpult | Navigáció, cégváltás, profil, jogosultságok, projektek |
| `invoices` | Bizonylatok & Számlák | Számlakezelés, OCR feltöltés, jóváhagyás, kintlévőség |
| `transactions` | Pénzügyek & Bank | Banki tranzakciók, automatikus párosítás, utalási csomagok, házipénztár |
| `accounting` | Könyvelés & Adózás | Főkönyv, számlatükör, naplók, mérleg, ÁFA bevallás (2665), zárás |
| `hr` | Bérszámfejtés & HR | Dolgozók, bérszámfejtés, jelenléti ív, tárgyi eszközök |
| `shipments` | Szállítmányozás & Fuvarok | Fuvarlevelek, CMR, számlapárosítás, eszkaláció |
| `system` | Integrációk & Rendszer | NAV szinkron, Számlázz.hu, MNB árfolyam, beállítások, hibajegyek |
| `books_portfolio` | eaisyBooks Portfólió | Könyvelőirodai portfólió, hiányzó számlák, adónaptár, onboarding |
| `books_modules` | eaisyBooks Szakmai Modulok | Egyéni vállalkozók (EV), pénztárkönyv, TAO/KIVA tervező, bérlapok |
| `books_admin` | eaisyBooks Adminisztráció & AI | Cégkapu / KÜNY tárhely, EGYKE, AI Asszisztens, könyvelési szabályok, audit |

---

### 2. Lépés: RAG-Optimalizált Cikk Felépítése

Egy cikk minősége közvetlenül meghatározza, hogy az AI asszisztens tud-e válaszolni a kérdésekre! Tartsd be az alábbi aranyszabályokat:

1. **`id` (Slug):** Kebab-case, egyértelmű és leíró (pl. `invoices-vat-deduction-rules`, `eaisybooks-payroll-cycle`).
2. **`title`:** Tömör, szakmai, egyértelmű magyar cím (pl. *"ÁFA levonhatósági szabályok és 70/30 telefon arányosítás"*).
3. **`summary`:** **2-3 mondat, max. 250 karakter.**
   - *Miért:* Az `accounty-ai-chat` ezt a mezőt az összefoglaló blokkban külön megjeleníti. Legyen benne a lényeg: miről szól a funkció és mi az alapvető szabály.
4. **`content`:** **Strukturált Markdown (400 - 1500 szó).**
   - Használj egyértelmű alcímeket (`### 1. ...`), listákat (`-`), és kiemeléseket (`**`).
   - Kerüld a csevegő / marketing fordulatokat (*"Örömmel mutatjuk be..."*). Kizárólag tényeket, szabályokat, könyvelési logikát és konkrét működési lépéseket tartalmazzon!
   - Ha jogszabályi háttere van (pl. Áfa tv., Számviteli tv., NAV specifikáció), tüntesd fel a pontos jogszabályi hivatkozást és határidőket.
5. **`menu_path`:** Az alkalmazásbeli pontos útvonal (pl. `/eaisybooks/vat`, `/invoices`, `/accounting-journals`).
   - *Miért:* A `search_knowledge_base` RPC **1.0 pontot** ad, ha a felhasználó éppen ezen az oldalon áll, és a kérdése kontextuális! Ha nem kötődik konkrét oldalhoz, hagyd `NULL`-on vagy `/`.
6. **`tags` (String tömb):**
   - Tartalmazza a leggyakoribb keresőszavakat, szinonimákat, rövidítéseket, hibás/köznyelvi alakokat (pl. `['áfa', 'áfa-bevallás', '2665', 'bevallás', 'm-lap', 'levonható']`).
   - Kisbetűvel írd őket. A `search_knowledge_base` FTS stemmere és ILIKE illesztője ezekből képzi a találati vektorokat.
7. **`icon`:** Érvényes Lucide ikon név (pl. `Receipt`, `Calculator`, `BookOpen`, `ShieldCheck`, `Bot`, `FileText`, `Landmark`).
8. **`estimated_read_time`:** Pl. `'3 perc'`, `'5 perc'`.
9. **`order_num`:** Sorrend az adott kategórián belül (pl. `1`, `2`, `3`).

---

### 3. Lépés: Adatbázis Módosítás Végrehajtása (Idempotens SQL)

A tudástár módosításokat **MINDIG idempotens módon**, `ON CONFLICT (id) DO UPDATE` formában kell megírni:

```sql
-- Új cikk hozzáadása vagy meglévő frissítése
INSERT INTO public.knowledge_base_articles (
  id,
  category_id,
  title,
  summary,
  content,
  menu_path,
  tags,
  icon,
  estimated_read_time,
  order_num,
  is_published
) VALUES (
  'eaisybooks-payroll-cycle',
  'books_modules',
  'Havi bérszámfejtési ciklus és NAV 08 integráció',
  'A havi bérszámfejtés lépései, jelenléti ívek kezelése és az ÁNYK 08-as havi adó- és járulékbevallás generálása.',
  E'# Havi bérszámfejtési ciklus az eaisyBooks rendszerben\n\nAz eaisyBooks bérszámfejtési modulja támogatja a teljes havi zárási folyamatot...\n\n### 1. Előkészítés és jelenlét\n- Dolgozói adatok ellenőrzése...\n\n### 2. Számfejtés és levonások\n- Szja, tb-járulék és szociális hozzájárulási adó kalkuláció...\n\n### 3. NAV 08 XML állományok exportálása\n- A rendszer automatikusan elkészíti az ÁNYK-kompatibilis XML csomagot.',
  '/eaisybooks/payroll',
  ARRAY['bér', 'bérszámfejtés', 'fizetés', '08', 'nav 08', 'járulék', 'jelenlét', 'szja'],
  'Users',
  '4 perc',
  3,
  true
)
ON CONFLICT (id) DO UPDATE SET
  category_id = EXCLUDED.category_id,
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  content = EXCLUDED.content,
  menu_path = EXCLUDED.menu_path,
  tags = EXCLUDED.tags,
  icon = EXCLUDED.icon,
  estimated_read_time = EXCLUDED.estimated_read_time,
  order_num = EXCLUDED.order_num,
  is_published = EXCLUDED.is_published,
  updated_at = now();
```

#### Futtatási módok:
- **Közvetlen SQL futtatás:** `call_mcp_tool` -> `supabase-agent-main:execute_sql` (vagy a cél Supabase környezet).
- **Kódolt migrációként:** Ha verziókövetett sémaváltoztatás történik, hozz létre egy új SQL fájlt:
  `supabase/migrations/YYYYMMDDHHMMSS_update_knowledge_base_<slug>.sql`.

---

### 4. Lépés: Frontend Fallback Szinkronizáció

A `src/data/knowledgeBaseFallback.ts` fájlban:
1. Keresd meg a `FALLBACK_KNOWLEDGE_ARTICLES` tömböt.
2. Ha a cikk már szerepel: frissítsd a mezőit.
3. Ha új cikk: add hozzá a tömbhöz a megfelelő kategória alá.
4. Szükség esetén frissítsd a `FALLBACK_KNOWLEDGE_CATEGORIES` adott elemének `article_count` értékét!

---

### 5. Lépés: RAG Retrieval Tesztelés (Rank & Keresési Validáció)

Minden tudástár-módosítás után **KÖTELEZŐ ellenőrizni**, hogy a rendszer RAG motorja valóban releváns találatként adja-e vissza a cikket:

Futtass le egy SQL tesztet:
```sql
SELECT 
  id, 
  title, 
  rank, 
  menu_path
FROM public.search_knowledge_base(
  'keresőszó vagy kérdés részlete', -- search_query
  '/eaisybooks/payroll',            -- page_path (vagy NULL)
  NULL,                              -- target_category
  5                                  -- match_limit
);
```

#### Elfogadási kritériumok:
- ✅ A létrehozott/frissített cikk megjelenik a találati listában.
- ✅ A `rank` értéke **>= 0.15** (az `accounty-ai-chat` Edge Function szűrőküszöbe).
- ✅ Releváns oldalról indított lekérdezés esetén a rank eléri a **0.8 - 1.0** pontot.

---

### 6. Lépés: Dokumentáció & Graphify Szinkronizáció

1. Ha a tudástár struktúrája, sémája vagy új funkciócsoportja bővült, frissítsd az alábbi dokumentumokat:
   - [A-105: Tudástár Adatmodell és Full-Text Search](../../docs/architecture/decisions/A-105-knowledge-base-schema-and-fts.md)
   - [P-078: Tudástár UX és Navigáció](../../docs/product/decisions/P-078-knowledge-base-ux-and-navigation.md)
2. Futtasd le a tudásgráf frissítést:
   ```bash
   graphify update .
   ```

---

## 🎯 Gyorsellenőrző Checklist (Definition of Done)

- [ ] Az `id` egyedi és kebab-case formátumú.
- [ ] A `category_id` létező, érvényes kategóriára mutat.
- [ ] A `summary` 2-3 mondat, tömör és lényegretörő.
- [ ] A `content` strukturált Markdown, felesleges sallangok nélkül.
- [ ] A `menu_path` a valós UI útvonalra mutat a helyes RAG kontextus-kiemeléshez.
- [ ] A `tags` tömb tartalmazza a releváns magyar szinonimákat és ragozatlan szótöveket.
- [ ] Az adatbázisban lefutott az idempotens `INSERT ... ON CONFLICT DO UPDATE`.
- [ ] A `src/data/knowledgeBaseFallback.ts` szinkronizálva van.
- [ ] A `search_knowledge_base` RPC teszt igazolta a magas (`>= 0.15`) rank értéket.
- [ ] A `graphify update .` lefutott.
