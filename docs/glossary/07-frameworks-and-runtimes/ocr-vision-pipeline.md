# 👁️ OCR & Vision Pipeline (Optikai Karakterfelismerés)

> **Utoljára frissítve:** 2026-07-25  
> **Kapcsolódó doksi:** [A-008: OCR Pipeline Architecture](../../architecture/decisions/A-008-ocr-pipeline.md) | [GLOSSARY Index](../index.md)

---

## 📖 Fogalom Meghatározása

Az **OCR (Optical Character Recognition / Optikai Karakterfelismerés)** és a **Vision AI Pipeline** az a technológiai láncolat, amely a feltöltött PDF dokumentumokból és képekből (JPG, PNG) kinyeri az olvasható szöveget, majd strukturált adattá (számla kibocsátó, adószám, nettó/bruttó összeg, tételek) alakítja az LLM segítségével.

---

## 🏗️ A Visibill Kétlépcsős OCR Architektúrája ([A-008])

Az OCR költségek és a pontosság egyensúlyozására a Visibill **kétlépcsős OCR stratégiát** alkalmaz ([A-008]):

```
                    [ Beérkező PDF Dokumentum ]
                                 │
                                 ▼
             [ Primary OCR: Microsoft MarkItDown ]
               (Vektoros / Szöveges PDF olvasás)
                                 │
                 ┌───────────────┴───────────────┐
                 │ (Sikeres szöveg kinyerés)    │ (Szkennelt / Üres / Fotózott PDF)
                 ▼                               ▼
     [ Text LLM Input ]             [ Secondary OCR: GPT-4o Vision ]
     (LiteLLM -> Fast LLM)          (PDF -> Kép konverzió -> Vision LLM)
                 │                               │
                 └───────────────┬───────────────┘
                                 ▼
                   [ Pydantic JSON Validáció ]
```

### 1. Elsődleges Lépcső (Primary OCR — MarkItDown)
A tisztán digitálisan generált (vektoros) PDF-eknél a Microsoft `MarkItDown` könyvtárát használjuk. Ez **azonnali, ingyenes és 100%-os pontosságú** Markdown szöveget ad vissza token költség nélkül.

### 2. Másodlagos Lépcső (Secondary OCR — GPT-4o Vision Fallback)
Ha a PDF szkennelt (kép alapú), fotózott vagy a MarkItDown nem tud belőle szöveget kinyerni, a worker a PDF oldalait képekké alakítja (`pdf2image` / `poppler`), és átadja a **GPT-4o Vision** multimédiás AI modellnek feldolgozásra.

---

## 💡 Teljesítmény & Költség optimalizáció

- **PDF Splitter:** A többoldalas (pl. 50 oldalas gyűjtő) PDF-eket a `pdf_splitter.py` különálló számlákra vágja szét a feldolgozás előtt.
- **Költség csökkentés:** A MarkItDown használata az esetek **~85%-ában** kiváltja a drága Vision OCR hívásokat, több száz dollárt megtakarítva havonta.
