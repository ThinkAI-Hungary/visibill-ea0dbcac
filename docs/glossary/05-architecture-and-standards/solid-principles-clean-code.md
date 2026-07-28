# 🧼 SOLID Principles & Clean Code (Tiszta Szoftvertervezés)

> **Utoljára frissítve:** 2026-07-25  
> **Kapcsolódó doksi:** [GLOSSARY Index](../index.md)

---

## 📖 Fogalom Meghatározása

A **SOLID** a objektumorientált és moduláris szoftvertervezés 5 alapvető elvének betűszava (Robert C. Martin / Uncle Bob írásai alapján). A SOLID elvek és a **Clean Code (Tiszta Kód)** gyakorlatok célja olyan szoftverarchitektúra építése, amely **könnyen érthető, tesztelhető, karbantartható és bővíthető** anélkül, hogy meglévő kódokat törne el.

---

## 🧩 A SOLID 5 Alapelve

| Betű | Elv Neve | Jelentése & Működése | Alkalmazása a Visibillben |
|---|---|---|---|
| **S** | **SRP** (Single Responsibility Principle) | **Egyetlen felelősség elve:** Egy osztálynak vagy modulnak csak egyetlen oka lehet a változásra. | Különálló cél-modulok: `pdf_splitter.py` (csak vág), `llm_tracker.py` (csak költséget számol), `db.py` (csak DB művelet). |
| **O** | **OCP** (Open/Closed Principle) | **Nyitott/Zárt elv:** A kód legyen nyitott a bővítésre, de zárt a módosításra. | Új feldolgozási pipeline hozzáadásakor nem írjuk át a meglévőket, hanem új handler-t regisztrálunk. |
| **L** | **LSP** (Liskov Substitution Principle) | **Liskov helyettesíthetőség:** A gyermek osztályoknak helyettesíthetőnek kell lenniük a szülő osztállyal anélkül, hogy a program hibázna. | Egységes pipeline felület: minden worker handler ugyanazt az `async process(job)` felületet valósítja meg. |
| **I** | **ISP** (Interface Segregation Principle) | **Interfész elválasztás:** Sok specifikus interfész jobb, mint egyetlen univerzális monolith interfész. | Különálló React hook-ok: `useInvoices`, `usePartners`, `useTickets` (nem 1 óriási megahook). |
| **D** | **DIP** (Dependency Inversion Principle) | **Függőség megfordítása:** A magas szintű modulok ne függjenek közvetlenül alacsony szintű moduloktól, hanem absztrakcióktól. | LiteLLM absztrakció: a worker nem függ közvetlenül az OpenAI SDK-tól, hanem a LiteLLM interfészen át hívja. |

---

## 📏 Kiegészítő Clean Code Alapelvek

1. **KISS (Keep It Simple, Stupid):** Törekedj az egyszerűségre, ne over-engineereld a feladatot!
2. **DRY (Don't Repeat Yourself):** Ne duplikáld a kódot! Használj közös utility-ket (pl. `A-044 Shared FilePreviewModal`).
3. **YAGNI (You Ain't Gonna Need It):** Ne írj meg olyan funkciót vagy generikus kódcsodát "a jövőre gondolva", amire most nincs tényleges üzleti szükség!
