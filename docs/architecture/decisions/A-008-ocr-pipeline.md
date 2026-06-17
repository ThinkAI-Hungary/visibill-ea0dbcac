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

## Consequences

**Pozitív:**
- MarkItDown gyors és olcsó (nincs API hívás, lokális feldolgozás)
- Vision OCR magas pontosságú kézzel írt/rossz minőségű dokumentumoknál
- A két útvonal kombinációja lefedi a dokumentumtípusok 99%-át

**Negatív:**
- Vision OCR költséges (GPT-4o Vision per-image pricing)
- Többoldalas PDF-ek szétbontása memória-intenzív
- A MarkItDown nem kezeli jól a táblázatokat komplex layout-ban
