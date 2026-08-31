# Decision 012: Számla Típusok

**Status:** Decided

**Category:** Számla Kezelés

**Question:** Milyen számla típusokat támogat a rendszer?

**Decision:**

| Típus | DB érték | Leírás |
|-------|----------|--------|
| Normál számla | `sima_szla` | Alapértelmezett, teljes ÁFA bontással |
| Egyszerűsített számla | `egyszerusitett_szla` | Kisebb tételű számlák |
| Díjbekérő / Proforma | `dijbekero_proforma` | Előzetes fizetési felszólítás |
| Díjbekérő | `dijbekero` | Fizetési felszólítás |
| Végszámla | `vegszamla` | Előlegszámlára hivatkozó végszámla |
| Pénztárbizonylat | `penztarbizonylat` | Házipénztári bevételi/kiadási bizonylat |
| Vámhatározat | `vamhatarozat` | Import vám és import ÁFA kivetés hivatalos határozat |

Minden típusnál rögzített mezők: eladó/vevő adatok, ÁFA bontás, fizetési mód, határidő, bruttó/nettó összegek, fordított adózás flag, pénzforgalmi elszámolás flag.

**Rationale:** A fenti típusok lefedik a magyar számlázási és bizonylatolási rendszer dokumentumtípusait. A rendszer LLM-el automatikusan felismeri a típust a feldolgozás során. A backup táblák (sima_szamla_backup, vegszamla_backup, stb.) az eredeti típus-specifikus struktúrákat őrzik.

---
Lásd még: [Decision 040: Számla Kapcsolatok és Párosítási Logikák (Matching & Relations)](./040-invoice-relations-matching.md)
