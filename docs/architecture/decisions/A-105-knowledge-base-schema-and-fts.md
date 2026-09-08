# A-105: [eaisyBill] Tudástár Adatmodell, Full-Text Search és AI Retrieval Előkészítés

**Dátum:** 2026-09-07  
**Státusz:** ✅ Decided  
**Kapcsolódó döntések:** [A-104](./A-104-eaisybooks-ai-chat-streaming-and-edge-architecture.md), [P-078](../../product/decisions/P-078-knowledge-base-ux-and-navigation.md), [BRD 055](../../business/decisions/055-eaisybooks-ai-assistant-chat.md)

---

## 1. Kontextus & Követelmények

A felhasználói Tudástár felületének kiszolgálása mellett alapvető építészeti célkitűzés volt, hogy a tárolt cikkek és leírások a jövőben közvetlen tudásbázisként (RAG / Knowledge retrieval) szolgálhassanak az AI Chat Asszisztens számára.

Főbb követelmények:
1. Központi relációs táblák a kategóriák és cikkek tárolására.
2. Hatékony keresési képesség (Full-Text Search).
3. 100% offline és hibatűrő fallback dataset frontend oldalon.
4. Biztonságos RLS házirendek (olvasási jog az autentikált felhasználóknak, módosítás csak a `service_role` számára, anonim hozzáférés letiltva).

---

## 2. Adatbázis Séma (`supabase/migrations/20260907165915_create_knowledge_base.sql`, `supabase/migrations/20260907170045_expand_hierarchical_knowledge_base.sql`, `supabase/migrations/20260907170112_audit_and_complete_knowledge_base.sql`, `supabase/migrations/20260907170143_audit_eaisybooks_knowledge_base.sql` és `supabase/migrations/20260907170155_search_knowledge_base_rpc.sql`)

### 2.1 `knowledge_base_categories`
| Oszlop | Típus | Leírás |
|---|---|---|
| `id` | TEXT PRIMARY KEY | Kategória slug (pl. `basics`, `invoices`, `accounting`) |
| `title` | TEXT NOT NULL | Kategória magyar megnevezése |
| `description` | TEXT | Rövid leírás |
| `icon` | TEXT DEFAULT 'BookOpen' | Lucide ikon név |
| `order_num` | INTEGER DEFAULT 0 | Megjelenési sorrend |
| `created_at` / `updated_at` | TIMESTAMPTZ | Időbélyegek |

### 2.2 `knowledge_base_articles`
| Oszlop | Típus | Leírás |
|---|---|---|
| `id` | TEXT PRIMARY KEY | Cikk egyedi slug azonosítója |
| `category_id` | TEXT NOT NULL REFERENCES `knowledge_base_categories(id)` | Külső kulcs |
| `title` | TEXT NOT NULL | Cikk címe |
| `summary` | TEXT NOT NULL | 2-3 mondatos összefoglaló |
| `content` | TEXT NOT NULL | Részletes Markdown tartalom |
| `menu_path` | TEXT | Csatolt alkalmazásbeli útvonal (pl. `/invoices`) |
| `tags` | TEXT[] DEFAULT '{}' | Címkék kereséshez és csoportosításhoz |
| `icon` | TEXT DEFAULT 'FileText' | Ikon név |
| `estimated_read_time` | TEXT DEFAULT '3 perc' | Becsült olvasási idő |
| `order_num` | INTEGER DEFAULT 0 | Sorrend a kategórián belül |
| `is_published` | BOOLEAN DEFAULT true | Publikálási kapcsoló |
| `fts` | TSVECTOR GENERATED ALWAYS AS (...) STORED | Tárolt keresési vektor |
| `created_at` / `updated_at` | TIMESTAMPTZ | Időbélyegek |

---

## 3. Full-Text Search (FTS) és GIN Indexelés

A PostgreSQL FTS indexeléshez egy tárolt generált oszlop (`fts`) került létrehozásra:
```sql
fts TSVECTOR GENERATED ALWAYS AS (
  to_tsvector('simple', title || ' ' || summary || ' ' || content)
) STORED;

CREATE INDEX idx_kb_articles_fts ON public.knowledge_base_articles USING gin(fts);
```
Ez lehetővé teszi mind az egyszerű szöveges keresést, mind az intelligens természetes nyelvű kinyerést az AI lekérdezésekhez.

### 3.1 `search_knowledge_base` RPC és RAG Keresőmotor
A gyors (<10ms) és költségmentes RAG retrieval kiszolgálására elkészült a `public.search_knowledge_base` PostgreSQL RPC (`SECURITY DEFINER`, `SET search_path TO 'public'`):
- **Bemeneti paraméterek:**
  - `search_query TEXT DEFAULT NULL`: a felhasználó kérdése vagy keresőkifejezése (az Edge Function max. 300 karakterre levágva adja át a védelem érdekében).
  - `page_path TEXT DEFAULT NULL`: az aktuálisan megtekintett oldal útvonala (pl. `/vat-return`).
  - `target_category TEXT DEFAULT NULL`: opcionális kategória szűrés (ha a query és az oldal üres, a kategória cikkeit adja vissza rendezve).
  - `match_limit INT DEFAULT 3`: maximális találatszám.
- **Intelligens magyar ragtalanítás (Stemming) és prefix-kiegészítés:**
  - A kifejezést szavakra bontja, eltávolítja az írásjeleket és a gyakori magyar kötőszavakat/töltelékszavakat (`és`, `hogy`, `nem`, `van`, `kell`, stb.).
  - A szavakra prefix-csonkolást alkalmaz (`term:*`).
  - Regex alapú magyar névszói és igeragozási végződések csonkolása: `(nak|nek|ban|ben|ból|ből|ról|ről|hoz|hez|höz|val|vel|tól|től|kor|ig|ért|on|en|ön|ok|ek|ök|ak|ja|je|om|od|unk|ünk|otok|etek|ötök|uk|ük|juk|jük|[aáeéiíoóöőuúüűktn])+$`.
  - A csonkolt szótövekre szintén prefix illesztést alkalmaz (pl. *"számláknak"* -> szótő: *"száml"* -> `'száml':*`), így ragozott szavak esetén is tökéletesen illeszkednek a szótári alakok ("számlák", "számlakezelés").
  - Az így generált kifejezéseket OR (`|`) logikával fűzi össze `to_tsquery('simple', ...)` kifejezéssé.
- **Többszintű Rank pontozás:**
  - Aktív oldal pontos egyezése (`menu_path = page_path`): `1.0` pont.
  - Aktív oldal prefix egyezése: `0.8` pont.
  - FTS találat: `ts_rank(fts, query) + 0.2` pont.
  - Cím és címke ILIKE fallback: `0.3` pont.
  - Kategória szerinti listázás: `0.1` pont (`order_num` szerint rendezve).
- **Jogosultságok:** Anonim elérés visszavonva (`REVOKE EXECUTE FROM anon, public`), kizárólag `authenticated` és `service_role` számára engedélyezett.

---

## 4. Hozzáférés-vezérlés (RLS) & Biztonság

- **RLS Engedélyezve:** Mindkét táblán kötelező RLS.
- **Olvasás:**
  - `authenticated` felhasználók számára engedélyezett (`is_published = true`).
  - `anon` szerepkör elérése explicit módon visszavonva (`REVOKE ALL FROM anon`).
- **Írás / Módosítás:**
  - Kizárólag a `service_role` számára engedélyezett (Edge function-ök vagy seed szkriptek).

---

## 5. Frontend Fallback & Teljesítmény

A `src/data/knowledgeBaseFallback.ts` és `src/hooks/useKnowledgeBase.ts` modulok hibrid működést valósítanak meg:
- React Query gyorsítótár: `staleTime: 5 perc`, `gcTime: 20 perc`.
- Adatbázis hiba, hálózati kimaradás vagy tábla hiány esetén automatikusan a statikus fallback adatkészletből szolgálja ki a 10 kategóriát és mind az 50 részletes szakmai útmutatót, amelyek hierarchikusan fedik le az eaisyBill és eaisyBooks teljes menürendszerét.
