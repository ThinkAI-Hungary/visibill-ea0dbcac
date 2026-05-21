# Decision 019: Bér & Járulék Modul

**Status:** Decided

**Category:** Pénzügyi Modulok

**Question:** Hogyan kezeli a rendszer a béreket, járulékokat és a kapcsolódó dokumentumokat?

**Decision:**
- Bérjegyzék automatikus feldolgozás LLM pipeline-nal (salary_files → salary)
- Típusok: bér, adó, járulék, ÁFA
- Fizetési módok: készpénz, átutalás
- Státuszok: Függő, Kifizetve (+ webhook küldési státuszok)
- Tranzakció-bér párosítás (transaction_id FK)
- Alkalmazotti nyilvántartás: employee_rates (óradíj, havi bér, employee/contractor típus)
- Employee meghívás: registration_token alapú regisztráció

**Rationale:** A bérszámfejtési dokumentumok automatikus feldolgozása csökkenti a manuális adatbevitelt. A tranzakció-bér párosítás biztosítja a pénzügyi nyomon követhetőséget.
