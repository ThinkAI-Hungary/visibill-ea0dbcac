# 🗝️ Hash Tables & In-Memory Indexing ($O(1)$ Adatelérés)

> **Utoljára frissítve:** 2026-07-25  
> **Kapcsolódó doksi:** [A-039: Transaction Matcher Performance](../../architecture/decisions/A-039-transaction-matcher-performance-optimization.md) | [Big O Notation](../05-architecture-and-standards/big-o-notation.md) | [GLOSSARY Index](../index.md)

---

## 📖 Fogalom Meghatározása

A **Hash Table (Hashtábla / Hash Map)** az egyik legalapvetőbb és leghatékonyabb adatszerkezet a számítástechnikában. Kulcs-érték párokat (Key-Value pairs) tárol, és lehetővé teszi az elemek beszúrását, keresését és törlését átlagosan **konstáns idő alatt ($O(1)$)**.

A működés alapja a **Hash Függvény (Hash Function)**, amely a tetszőleges kulcsból (pl. sztring vagy összetett objektum) egy tömb-indexként használható egész számot generál.

---

## ⚙️ Hash Ütközések (Collisions) Kezelése

Ha két különböző kulcsra a hash függvény ugyanazt az indexet adja ki, **Hash Ütközés (Collision)** keletkezik:

1. **Chaining (Láncolás):** A hashtábla minden slot-ja egy láncolt listát (vagy fát) tartalmaz. Ütközéskor az új elem a lista végére kerül.
2. **Open Addressing (Nyílt Címzés):** Ütközéskor a hashtábla megkeresi a következő szabad helyet a tömbben (Probing).

---

## 💡 Use-Case a Visibillben: $O(N)$ Transaction Matcher ([A-039])

A Visibill banki tranzakció-matching algoritmusának optimalizálásakor az In-Memory Hash Indexing mentette meg a rendszert a fagyástól:

### Előtte ($O(N \times M)$ — Egymásba Ágyazott Ciklus):
```python
# Dupla ciklus: minden tranzakcióhoz végigiterál az ÖSSZES számlán (Lassú!)
for tx in transactions:
    for inv in invoices:
        if tx.amount == inv.amount and tx.tax_number == inv.tax_number:
            match(tx, inv)
```

### Utána ($O(N)$ — In-Memory Hash Map Lookup):
```python
# 1. Lépés: Számlák indexelése memóriabeli Hash Map-be (O(M) lépés)
invoice_hash_map = {
    (inv.amount, inv.tax_number): inv 
    for inv in invoices
}

# 2. Lépés: Párhuzamos kerestetés O(1) eléréssel (O(N) lépés)
for tx in transactions:
    key = (tx.amount, tx.tax_number)
    match_inv = invoice_hash_map.get(key) # Azonnali O(1) hashtábla elérés!
    if match_inv:
        match(tx, match_inv)
```

**Eredmény:** 10,000 tranzakció és 10,000 számla párosítási ideje **45 másodpercről 0.18 másodpercre csökkent**.
