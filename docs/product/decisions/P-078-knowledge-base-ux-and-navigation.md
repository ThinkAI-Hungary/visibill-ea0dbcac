# P-078: [eaisyBill] Tudástár (Knowledge Base) és Funkciókalauz UX

**Dátum:** 2026-09-07  
**Státusz:** ✅ Decided  
**Kapcsolódó döntések:** [P-077](./P-077-eaisybooks-ai-assistant-chat-and-speed-dial-ux.md), [A-104](../architecture/decisions/A-104-eaisybooks-ai-chat-streaming-and-edge-architecture.md), [A-105](../architecture/decisions/A-105-knowledge-base-schema-and-fts.md), [BRD 055](../../business/decisions/055-eaisybooks-ai-assistant-chat.md)

---

## 1. Kontextus & Üzleti Cél

Az eaisyBill platform komplex funkciókészlettel (számlák, OCR feltöltés, banki matching, házipénztár, kettős könyvvitel, ÁFA bevallás, bérszámfejtés, NAV integrációk) rendelkezik. A felhasználók gyors betanulásának, önkiszolgáló támogatásának elősegítésére, valamint az AI Asszisztens (Chatbot) megalapozására szükségessé vált egy központi, közvetlenül elérhető **Tudástár** menüpont létrehozása.

A Tudástár a bal oldali fő navigációban közvetlenül a **Hibajegyek** menüpont felett helyezkedik el, vizuális könyv (`BookOpen`) ikonnal.

---

## 2. Felhasználói Élmény és Felépítés

### 2.1 Navigáció és Elhelyezés
- **Elhelyezkedés:** `AppSidebar` bal oldali menüben, a `Feltöltés` után és közvetlenül a `Hibajegyek` felett.
- **Megjelenés összecsukott állapotban:** `BookOpen` ikon, tooltip: "Tudástár", zéró layout shift.
- **Megjelenés kinyitott állapotban:** "Tudástár" szöveg, aktív állapotjelző sávval és hover kiemeléssel.
- **Útvonalak:**
  - Céges kontextusban (scoped): `/:companyId/:dateRange/knowledge-base/:articleId?`
  - Globális fallback: `/knowledge-base/:articleId?`

### 2.2 Főoldali Kereső és Kategóriaszűrők (Master Nézet)
- **Fejléc & Keresősáv:**
  - Modern glassmorphism gradiens banner.
  - Valós idejű, azonnali (0ms) keresés a címekben, összefoglalókban, címkékben és a cikkek teljes szövegében.
  - Keresési kifejezés törlése egyetlen kattintással.
- **Kategória fülek (Category Pills):**
  - "Összes téma" dinamikus darabszám-jelzővel (50 cikk).
  - 10 hierarchikus kategória fül (Alapok & Vezérlőpult, Bizonylatok & Számlák, Pénzügyek & Bank, Könyvelés & Adózás, Bérszámfejtés & HR, Szállítmányozás & Fuvarok, Integrációk & Rendszer, eaisyBooks Portfólió, eaisyBooks Szakmai Modulok, eaisyBooks Adminisztráció & AI) kontextuális ikonokkal és darabszám-számlálókkal.
- **Kártyarács (Article Grid):**
  - Kategória jelvény, olvasási idő (pl. `3 perc`).
  - Cím és 3 soros szakmai összefoglaló (zéró nyers technikai URL).
  - Címkék (`#számla`, `#ocr`, `#áfa`, `#portfólió`, `#átalányadó`, `#projektek`, `#partnerek`, `#analitika`, `#anomália`, `#onboarding`, `#bérlap`, `#promptok`, `#audit`).
  - Közvetlen "Ugrás az oldalra" mélylink, amely a megfelelő funkcionális menüpontba navigál.

### 2.3 Cikk Olvasó Nézet (Detail Nézet)
- **Vissza gomb:** "← Vissza az összes útmutatóhoz".
- **Fejléc & Metaadatok:** Cím, olvasási idő, összefoglaló doboz, kulcsszavak.
- **Műveleti gombok:**
  - "Ugrás a funkcióhoz" (kiemelt CTA gomb, pl. `/invoices`, `/vat-return`, `/upload`).
  - "Megosztás" (másolja az URL-t vágólapra shadcn toast visszajelzéssel).
- **Strukturált szöveg:** Teljes Markdown renderelés címsorokkal, felsorolásokkal, számozott listákkal és inline kódkiemelésekkel.
- **Kapcsolódó témák és Hibajegy híd:**
  - Az azonos kategóriába tartozó további cikkek ajánlása a cikk alján.
  - "Nem találtad meg a választ a kérdésedre?" doboz, közvetlen átkötéssel a `/tickets` (Hibajegyek) menüpontba.

---

## 3. Jogosultsági Szabályok

- A Tudástár egy általános segítségnyújtó modul, ezért elérhető:
  - `owner`, `admin`, `member`, `assistant`, `viewer` szerepkörök számára.
  - Az `employee` szerepkör (jogszabályi és biztonsági okokból) szigorúan kizárólag a `working_time` munkaidő rögzítő felülethez fér hozzá.
