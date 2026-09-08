# 🗄️ Knowledge Base Schema & Metadata Reference

## 1. Táblák Definíciója

### `public.knowledge_base_categories`
| Mező | Típus | Nullable | Alapértelmezett | Leírás |
|---|---|---|---|---|
| `id` | TEXT | — | PRIMARY KEY | Egyedi kategória azonosító (pl. `invoices`, `accounting`) |
| `title` | TEXT | — | — | Megjelenő kategórianév magyarul |
| `description` | TEXT | ✓ | NULL | Rövid leírás a Tudástár kártyán |
| `icon` | TEXT | — | `'BookOpen'` | Lucide React ikonnév |
| `order_num` | INT | — | `0` | Rendezési sorrend |
| `created_at` | TIMESTAMPTZ | — | `now()` | Létrehozás ideje |
| `updated_at` | TIMESTAMPTZ | — | `now()` | Módosítás ideje |

### `public.knowledge_base_articles`
| Mező | Típus | Nullable | Alapértelmezett | Leírás |
|---|---|---|---|---|
| `id` | TEXT | — | PRIMARY KEY | Egyedi cikk slug (kebab-case) |
| `category_id` | TEXT | — | FK | Külső kulcs -> `knowledge_base_categories(id)` ON DELETE CASCADE |
| `title` | TEXT | — | — | Cikk címe |
| `summary` | TEXT | — | — | 2-3 mondatos tömör összefoglaló (AI RAG kontextushoz kiemelt) |
| `content` | TEXT | — | — | Részletes Markdown formátumú szakmai tartalom |
| `menu_path` | TEXT | ✓ | NULL | Kapcsolódó UI oldal útvonala (pl. `/eaisybooks/vat`) |
| `tags` | TEXT[] | — | `'{}'` | Kulcsszavak, szinonimák, rövidítések |
| `icon` | TEXT | — | `'FileText'` | Lucide ikonnév |
| `estimated_read_time` | TEXT | — | `'3 perc'` | Olvasási idő becslés |
| `order_num` | INT | — | `0` | Kategórián belüli sorrend |
| `is_published` | BOOLEAN | — | `true` | Publikált-e (csak a `true` jelenik meg és kereshető RAG-gal) |
| `fts` | TSVECTOR | — | GENERATED | `to_tsvector('simple', title || ' ' || summary || ' ' || content)` |
| `created_at` | TIMESTAMPTZ | — | `now()` | Létrehozás ideje |
| `updated_at` | TIMESTAMPTZ | — | `now()` | Módosítás ideje |

---

## 2. Kategória Katalógus

1. `basics`: Alapok & Vezérlőpult (`icon: 'Compass'`)
2. `invoices`: Bizonylatok & Számlák (`icon: 'Receipt'`)
3. `transactions`: Pénzügyek & Bank (`icon: 'Landmark'`)
4. `accounting`: Könyvelés & Adózás (`icon: 'BookOpen'`)
5. `hr`: Bérszámfejtés & HR (`icon: 'Users'`)
6. `shipments`: Szállítmányozás & Fuvarok (`icon: 'Truck'`)
7. `system`: Integrációk & Rendszer (`icon: 'Wrench'`)
8. `books_portfolio`: eaisyBooks Portfólió (`icon: 'Briefcase'`)
9. `books_modules`: eaisyBooks Szakmai Modulok (`icon: 'Calculator'`)
10. `books_admin`: eaisyBooks Adminisztráció & AI (`icon: 'Bot'`)

---

## 3. Alkalmazásbeli Útvonalak (`menu_path`) Katalógusa

A RAG motor 1.0 illetve 0.8 pontszámot ad a felhasználó aktuális tartózkodási helye szerinti cikkeknek. Használd a pontos útvonalat:

- `/`: Kezdőlap / Vezérlőpult
- `/invoices`: Számlák és bizonylatok listája
- `/upload`: Dokumentum feltöltés és OCR feldolgozás
- `/transactions`: Banki tranzakciók
- `/matching`: Tranzakció- és számlapárosítás
- `/general-ledger`: Főkönyvi kivonat és számlatükör
- `/vat-return`: ÁFA bevallás (2665) kalkulátor és analitika
- `/reports`: Pénzügyi kimutatások (Eredménykimutatás, Mérleg, Cash-Flow)
- `/partners`: Partnertörzs és partner analitika
- `/projects`: Projektek és költséghelyek
- `/categories`: Számlakategóriák és kontírozási szabályok
- `/petty-cash`: Házipénztár és pénztárbizonylatok
- `/bank-transfers`: Banki átutalási csomagok
- `/accounting-journals`: Könyvelési naplók
- `/annual-reports`: Éves beszámolók
- `/fixed-assets`: Tárgyi eszközök és értékcsökkenés
- `/payroll`: Bérszámfejtés és dolgozói nyilvántartás
- `/working-time`: Munkaidő és jelenlét
- `/shipments`: Szállítmányozás és CMR fuvarok
- `/settings`: Cég- és rendszerbeállítások
- `/notes`: Ügyviteli jegyzetek
- `/tickets`: Ügyfélszolgálati hibajegyek
- `/knowledge-base`: Tudástár böngésző
- `/eaisybooks`: eaisyBooks Portfólió áttekintő
- `/eaisybooks/clients`: Ügyfél cégek kezelése
- `/eaisybooks/deadlines`: Határidők és adónaptár
- `/eaisybooks/missing-documents`: Hiányzó bizonylatok és bankkivonatok
- `/eaisybooks/reports`: Könyvelőirodai riportok
- `/eaisybooks/ev`: Egyéni vállalkozók (EV) és pénztárkönyv
- `/eaisybooks/tao-kiva`: TAO és KIVA kalkulátor / adótervező
- `/eaisybooks/payroll`: Irodai csoportos bérszámfejtés
- `/eaisybooks/cegkapu`: Cégkapu / KÜNY tárhely és EGYKE képviselet
- `/eaisybooks/ai-assistant`: AI Asszisztens teljes képernyős nézet
- `/eaisybooks/prompts`: Könyvelési szabályok és prompt könyvtár
- `/eaisybooks/approvals`: Könyvelői jóváhagyási sor
- `/eaisybooks/audit`: Biztonsági és műveleti audit napló
