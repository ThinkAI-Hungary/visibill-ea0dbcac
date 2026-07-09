# Decision 020: Adó Modul Scope

**Status:** Partially Decided

**Category:** Pénzügyi Modulok

**Question:** Mi az adó modul pontos scope-ja? Csak nyilvántartás (ÁFA, TAO összegek rögzítése), vagy aktív kalkuláció is (ÁFA bevallás összeállítás, TAO alap számítás, SZJA)? Kell-e bevallás generálás (ÁNYK kompatibilis)?

**Decision:**

### eaisyBill (fő app)
A `tax` tábla létezik (adonem, osszeg, datum, company_id) de jelenleg 0 rekord van benne production-ben. Az alap struktúra kész, de a funkció még nem aktív.

### eaisyBooks — EV Adóforma-összehasonlítás (2026-07-08)

Az eaisyBooks EV modulban implementált **adóforma-összehasonlító** (`EvComparePage.tsx`) aktív kalkulációt végez három adóforma között:

| Adóforma | Kalkuláció | Jogszabály |
|----------|-----------|------------|
| **Átalányadó** | Bevétel × költséghányad (45/80/90%) → jövedelem → SZJA (15%) | Szja tv. 50–56. § |
| **Vállalkozói SZJA** | (Bevétel − költség) × 9% + osztalék SZJA + osztalék szocho | Szja tv. 49/B–49/C. § |
| **KATA** | Havi tételes adó (50.000 Ft) + túllépési pótlék (40%) | KATA tv. 7–8. § |

**Járulék-kalkuláció (minimumjárulék-alappal):**

Az összehasonlítás az adókon felül tartalmazza a **TB-járulékot (18,5%)** és a **szocho-t (13%)** is, foglalkoztatási státusz szerint differenciálva:

| Státusz | TB-járulék | Szocho | Minimum alap |
|---------|-----------|--------|-------------|
| **Főfoglalkozású** | 18,5% (min. alap: minimálbér/garBérmin) | 13% (min. alap: minimálbér/garBérmin) | Igen — ha a tényleges jövedelem < minimálbér×12 |
| **Mellékállású** | 18,5% (tényleges jövedelem után) | 13% (tényleges jövedelem után) | Nem |
| **Kiegészítő (nyugdíjas)** | Mentes | Mentes | — |

**Szakképzettség hatása:** Főfoglalkozásúaknál a „Szakképzettséget igénylő főtevékenység" toggle aktiválja a garantált bérminimumot (373.200 Ft/hó 2026-ban) a minimálbér (322.800 Ft/hó) helyett mint minimum járulékalapot.

**Implementáció:**
- Számítási logika: `evCalculations.ts` → `compareTaxForms()` pure function
- UI: `EvComparePage.tsx` (interaktív slider + toggle-ök + 3 összehasonlító kártya)
- Év-specifikus paraméterek: `DEFAULT_2025_PARAMS`, `DEFAULT_2026_PARAMS`
- Route: `/accounty/client/:id/ev/compare`

**Rationale:** A könyvelők számára az adóforma-választás az egyik legértékesebb szolgáltatás, amelyet EV ügyfeleiknek nyújtanak. Az interaktív összehasonlító lehetővé teszi, hogy a könyvelő valós bevételi adatokkal szimulálja a különböző adóformák terheit — a járulékokkal együtt —, és megalapozott javaslatot tegyen az ügyfélnek.
