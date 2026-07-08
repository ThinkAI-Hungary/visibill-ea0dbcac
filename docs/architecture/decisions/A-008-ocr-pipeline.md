# A-008: OCR Pipeline (Vision + MarkItDown)

**Status:** Decided  
**Date:** 2025-10

## Context

A beérkező számlák PDF-ek vagy képek (JPG/PNG). A szöveget ki kell nyerni belőlük, mielőtt az LLM feldolgozhatná.

## Decision

Két OCR útvonal:

1. **MarkItDown** — szöveges PDF-ekhez (natív szöveg kinyerés, nem kép-alapú)
2. **Vision OCR** (GPT-4o Vision) — képekhez és beágyazott képes PDF-ekhez

**Pipeline:**
```
Dokumentum beérkezik
    │
    ├── PDF?
    │   ├── Van natív szöveg? → MarkItDown → markdown
    │   └── Csak kép? → pdf_splitter → oldalankénti kép → Vision OCR → markdown
    │
    └── Kép (JPG/PNG)? → Vision OCR → markdown
    │
    ▼
Markdown szöveg → LLM extraction (adatkinyerés)
```

**pdf_splitter:** Többoldalas PDF-ek oldalankénti képekre bontása — a Vision OCR oldalanként dolgozik.

**Robustness & Fallbacks (2026-07 frissítés):**
- **Gibberish & CIDFont Detection:** A rendszer észleli a vezérlőkarakterekből vagy `(cid:X)` tokenekből álló értelmezhetetlen szövegeket (gibberish), és automatikusan OCR fallback-et indít.
- **High-Quality PDF Rendering:** Kép-alapú / szkennelt PDF-ek esetén a beágyazott képek hibás kicsomagolása helyett a PyMuPDF (`fitz`) segítségével nagy felbontású (200 DPI) PNG képként rendereljük le a PDF első oldalát a Direct Vision OCR számára.
- **Flaky Vision Refusal Retry:** Ha a Vision API ideiglenesen/flaky módon elutasítja a kép beolvasását (pl. *"I'm sorry, I can't read this..."* sablonválaszok), a rendszer automatikusan észleli a nem-hasznos választ (`_is_vision_response_useful`), és újrapróbálkozik (`max_attempts=2`) a direct vision OCR-rel.

## Consequences

**Pozitív:**
- MarkItDown gyors és olcsó (nincs API hívás, lokális feldolgozás)
- Vision OCR magas pontosságú kézzel írt/rossz minőségű dokumentumoknál
- A két útvonal kombinációja és a hibatűrő automatikus retry logikák minimalizálják a feldolgozási hibákat flaky API válaszok esetén is

**Negatív:**
- Vision OCR költséges (GPT-4o Vision per-image pricing)
- Többoldalas PDF-ek szétbontása memória-intenzív
- A MarkItDown nem kezeli jól a táblázatokat komplex layout-ban
