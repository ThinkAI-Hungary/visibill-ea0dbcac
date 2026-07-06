# Decision 041: Manuális Kifizetés Rögzítése (Máshogyan kiegyenlített tételek)

**Status:** Decided  
**Date:** 2026-07-03  
**Category:** Pénzügyi Modulok / Számlázás  

---

## Question
Hogyan kezelje a rendszer azokat a számlákat, amelyeket nem a cég bankszámlájáról egyenlítettek ki (pl. készpénz, privát kártya, tagi hitel)?

## Decision
Bevezetésre kerül a **"Máshogyan kiegyenlített"** funkció, amely lehetővé teszi virtuális tranzakciók létrehozását a számlákhoz.

1. **Virtuális Tranzakciók:** A rendszer a `transactions` táblában hoz létre egy rekordot, amelynek `is_manual = true` flagje van.
2. **Kifizetés Típusok:** Támogatott típusok:
    - `private_card`: Privát bankkártyás fizetés
    - `cash`: Készpénzes fizetés
    - `owner_loan`: Tagi hitel
3. **Párosítás:** A virtuális tranzakció azonnal és automatikusan párosításra kerül a kiválasztott számlához (`matched_invoice_id`).
4. **Adatmodell:** 
    - A `transactions` tábla bővül az `is_manual` (boolean), `manual_payment_type` (text) és `manual_payment_note` (text) mezőkkel.
    - Egy új RPC függvény (`record_manual_invoice_payment`) kezeli az atomi rögzítést.

## Rationale
Sok kisvállalkozásnál előfordul, hogy a cégvezető privát forrásból fizet ki céges számlát. Ezeket a tételeket is rögzíteni kell a könyvelés és az ÁFA bevallás (pénzforgalmi szemlélet) miatt. A virtuális tranzakciók létrehozása lehetővé teszi, hogy a meglévő párosítási és riportálási logika változatlanul működjön ezeknél a tételeknél is.

## Implications
- **Riportok:** A pénzügyi riportokban és a főkönyvben ezek a tételek külön jelölhetők vagy szűrhetők a `is_manual` flag alapján.
- **Pénzforgalmi ÁFA:** A manuálisan megadott fizetési dátum lesz az adófizetési kötelezettség alapja.

---

## Kapcsolódó Dokumentáció
- **Use Case:** [UC-013: Manuális Kifizetés Rögzítése](../use-cases.md#uc-013-manuális-kifizetés-rögzítése)
- **Decision 017:** [Tranzakció Kezelés & Párosítás](./017-transaction-matching.md)
- **Decision 040:** [Számla Kapcsolatok és Párosítási Logikák](./040-invoice-relations-matching.md)
