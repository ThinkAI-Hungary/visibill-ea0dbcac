# 📐 Big O Notation (Algoritmus Komplexitás a Visibillben)

> **Utoljára frissítve:** 2026-07-25  
> **Kapcsolódó doksi:** [A-039: Transaction Matcher Performance](../../architecture/decisions/A-039-transaction-matcher-performance-optimization.md) | [GLOSSARY Index](../index.md)

---

## 📖 Fogalom Meghatározása

A **Big O jelölés ($O$)** a számítástechnikában az algoritmusok **idő- és memóriabeli komplexitásának** mértékegysége. Azt mutatja meg, hogyan skálázódik a futási idő vagy az erőforrás-igény az bemeneti adatok mennyiségének ($N$) növekedésével.

---

## 📊 Komplexitási Osztályok Gyorsáttekintése

| Big O | Elnevezés | Futási idő viselkedése $N$ növekedésével | Példa a Visibillben |
|---|---|---|---|
| **$O(1)$** | Konstáns (Constant) | Független az elemszámtól, azonnali. | Hash map lookup (`map.get(partner_id)`) |
| **$O(\log N)$** | Logaritmikus (Logarithmic) | Lassan nő, felezős keresés. | PostgreSQL B-tree index keresés |
| **$O(N)$** | Lineáris (Linear) | Arányosan nő az elemszámmal. | Egy tömb átfésülése (`Array.filter()`) |
| **$O(N \log N)$** | Linearitmikus | Gyors rendezési algoritmusok. | Tétel lista rendezése dátum/összeg szerint |
| **$O(N^2)$** | Kuadratikus (Quadratic) | **Veszélyes!** $N=1000$ esetén 1.000.000 művelet. | Dupla egymásba ágyazott ciklus matching-nél |

---

## 🚨 A "Big O Problem" a Visibillben & Megoldásai

### 1. Eset: Transaction Matcher Szűk Keresztmetszet ($O(N \times M)$ vs $O(N)$) — [A-039]

- **A Probléma ($O(N \times M)$):**  
  Több ezer banki tranzakció ($N$) és számla ($M$) párosításakor a korábbi egymásba ágyazott ciklusos matching $N \times M$ lépést végzett. 10.000 tranzakció és 10.000 számla esetén ez **100.000.000 összehasonlítást** jelentett, ami a worker fagyásához és időtúllépéséhez (timeout) vezetett.
  
- **A Megoldás ($O(N)$ In-Memory Hash Indexing):**  
  A számlákat a feldolgozás előtt a memóriában egy Hash Map-be indexeltük kulcsok szerint (`bizonylatszam`, `osszeg`, `adoszam`). A párosítás így egyetlen ciklussal, $O(1)$-es lookup-okkal $O(N)$ komplexitásúra csökkent. Futási idő: **45 másodpercről < 0.2 másodpercre**.

```python
# ❌ ROSSZ (O(N * M) - Kuadratikus lassulás):
for tx in transactions:
    for inv in invoices: # Minden tranzakciónál végignézi az ÖSSZES számlát
        if tx.amount == inv.amount and tx.partner_tax == inv.partner_tax:
            match(tx, inv)

# ✅ JÓ (O(N) - In-Memory Hash Map Lookup):
invoice_map = {(inv.amount, inv.partner_tax): inv for inv in invoices} # O(M) felépítés
for tx in transactions:
    match_inv = invoice_map.get((tx.amount, tx.partner_tax)) # O(1) azonnali elérés
    if match_inv:
        match(tx, match_inv)
```

---

### 2. Eset: Adatbázis Lapozás (PostgREST Limit vs Server-Side Aggregation) — [A-046]

- **A Probléma ($O(N)$ memóriabetöltés kliens oldalon):**  
  Ha a frontend vagy az EF 50.000 sornyi `llm_koltsegek` rekordot kér le memóriába aggregálásra, a hálózati sávszélesség és memória linearitása ($O(N)$) lassítja az alkalmazást, ráadásul a PostgREST 1000 soros limitje csonkolja az eredményt.

- **A Megoldás ($O(1)$ hálózati átvitel PostgreSQL RPC-vel):**  
  Az adatbázis motoron belüli `SUM()` és `GROUP BY` aggregációval az $N$ soros nyers adat helyett csak a végeredményt jelentő JSON objektum utazik a hálózaton.
