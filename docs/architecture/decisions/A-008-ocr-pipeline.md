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

**Robustness & Fallbacks (2026-07 és 2026-09 frissítés):**
- **Gibberish & CIDFont Detection:** A rendszer észleli a vezérlőkarakterekből vagy `(cid:X)` tokenekből álló értelmezhetetlen szövegeket (gibberish), és automatikusan OCR fallback-et indít.
- **High-Quality PDF Rendering:** Kép-alapú / szkennelt PDF-ek esetén a beágyazott képek hibás kicsomagolása helyett a PyMuPDF (`fitz`) segítségével nagy felbontású (200 DPI) PNG képként rendereljük le a PDF első oldalát a Direct Vision OCR számára.
- **Flaky Vision Refusal Retry:** Ha a Vision API ideiglenesen/flaky módon elutasítja a kép beolvasását (pl. *"I'm sorry, I can't read this..."* sablonválaszok), a rendszer automatikusan észleli a nem-hasznos választ (`_is_vision_response_useful`), és újrapróbálkozik (`max_attempts=2`) a direct vision OCR-rel.
- **Sparse OCR & Phantom Scanner Layer Detection (2026-09 frissítés, EB-0208):** Szkennelt számláknál (pl. irodai szkennerek beépített mini-OCR rétege) gyakori, hogy a PDF tartalmaz ugyan egy minimális láthatatlan szövegréteget, de az csak néhány izolált töredékből áll (pl. 100-250 karakter értelmetlen sorszám vagy fejléc), miközben a számla érdemi adattartalma csak képen látható. A korábbi egyszerű hossz-alapú ellenőrzés (`len(text) < 100`) az ilyen szövegeket natívnak minősítette, ami miatt az LLM classifier "nem számla" hibára futott (`nem_szamla`). Az `is_sparse_ocr_text()` függvény (`worker/ocr_markitdown.py`) számla-kulcsszó és token-sűrűség elemzéssel észleli a ritkás szövegréteget, és automatikusan átirányítja a feldolgozást a Direct Vision OCR útvonalra.

## Consequences

**Pozitív:**
- MarkItDown gyors és olcsó (nincs API hívás, lokális feldolgozás)
- Vision OCR magas pontosságú kézzel írt/rossz minőségű dokumentumoknál
- A két útvonal kombinációja és a hibatűrő automatikus retry logikák minimalizálják a feldolgozási hibákat flaky API válaszok esetén is
- Zéró téves "nem számla" elutasítás szkenner által beágyazott hibás/töredékes szövegrétegek miatt (EB-0208)

**Negatív:**
- Vision OCR költséges (GPT-4o Vision per-image pricing)
- Többoldalas PDF-ek szétbontása memória-intenzív
- A MarkItDown nem kezeli jól a táblázatokat komplex layout-ban

