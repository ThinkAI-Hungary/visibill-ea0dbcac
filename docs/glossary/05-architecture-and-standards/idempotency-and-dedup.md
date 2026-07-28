# 🔄 Idempotency & Dedup (Idempotencia és Duplikáció Megelőzés)

> **Utoljára frissítve:** 2026-07-25  
> **Kapcsolódó doksi:** [A-023: Upload Dedup Protection](../../architecture/decisions/A-023-upload-dedup-protection.md) | [A-041: Mailgun Concurrent Dedup](../../architecture/decisions/A-041-mailgun-concurrent-dedup.md) | [GLOSSARY Index](../index.md)

---

## 📖 Fogalom Meghatározása

Az **Idempotencia (Idempotency)** a szoftverarchitektúrában azt jelenti, hogy egy adott művelet vagy API kérés **többszöri (duplikált) lefutása pontosan ugyanazt az eredményt és adatbázis-állapotot hozza létre**, mint az első sikeres lefutás, nem kívánt mellékhatások (pl. duplikált számlák, kétszer levont költségek) nélkül.

Az **Idempotence Key (vagy Unique Constraint)** az az egyedi azonosító kulcs, amely alapján a rendszer azonnal felismeri a már feldolgozott kérést.

---

## 💡 Miért Életbevágó az Idempotencia a Visibillben?

1. **Hálózati Újrapróbálkozások (Retry Policy):**  
   Ha a Mailgun webhook vagy egy külső kliens nem kap azonnali válasz kérést a hálózat ingadozása miatt, újra elküldi ugyanazt a HTTP kérést. Idempotencia nélkül a rendszer 2x hozná létre ugyanazt a számlát.

2. **PGMQ Queue Re-delivery:**  
   Ha a Python worker Visibility Timeout-ja lejár, mielőtt a törlést visszaigazolná, a PGMQ újra átadhatja a job-ot. A workernek ellenőriznie kell, hogy az adott feladatot elvégezte-e már.

---

## 🛡️ Háromrétegű Idempotencia Architektúra a Visibillben ([A-041])

Az e-mailben érkező számlák párhuzamos feldolgozási duplikációja ellen a Visibill **3 védelmi réteget (L1, L2, L3)** alkalmaz ([A-041]):

```
 ┌─────────────────────────────────────────────────────────────┐
 │ L1: Frontend / Edge Function Check (upload_table status)   │
 └──────────────────────────────┬──────────────────────────────┘
                                │ (Ha átment az L1-en)
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ L2: LLM Cost Tracker Check (llm_koltsegek file_hash)        │
 └──────────────────────────────┬──────────────────────────────┘
                                │ (Ha átment az L2-en)
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ L3: PostgreSQL Database UNIQUE Constraint & Index           │
 └─────────────────────────────────────────────────────────────┘
```

1. **L1 Réteg (Upload Table Check):** Megvizsgálja, hogy létezik-e már az adott `(company_id, file_name, file_hash)` kombináció az upload táblákban.
2. **L2 Réteg (LLM Processing Check):** Az `llm_koltsegek` táblában ellenőrzi, hogy az adott fájl hash-ére futott-e már LLM hívás.
3. **L3 Réteg (Adatbázis UNIQUE Constraint):** PostgreSQL szintű `UNIQUE(company_id, file_hash)` index, amely végső védelmi vonalként adatbázis hibával dobja vissza a törvénytelen másodlagos INSERT kísérletet.
