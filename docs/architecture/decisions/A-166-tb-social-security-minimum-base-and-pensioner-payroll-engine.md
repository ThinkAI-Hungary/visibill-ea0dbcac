# A-166: Magyar Társadalombiztosítási (TB) Adómotor, Minimális Járulékalap (Tbj. 27. §), Nyugdíj és 2608 M-lap Architektúra

**Állapot:** Elfogadva (Accepted)  
**Dátum:** 2026-09-27  
**Döntéshozó:** Architecture, Tax & Payroll Engineering Team  
**Kapcsolódó döntések:** P-125, A-003, A-092, A-158  

---

## 1. Döntési Kontextus és Jogszabályi Háttér

A magyar bérszámfejtésben és adózásban a társadalombiztosítási járulék (18,5%) és a szociális hozzájárulási adó (13%) megállapítása szigorú törvényi minimum küszöbökhöz kötött.
1. **Tbj. 27. § (2) bekezdés szerinti járulékfizetési alsó határ:**
   - Munkaviszonyban állóknál a járulékalap havonta legalább a minimálbér (vagy középfokú végzettséget igénylő munkakör esetén a garantált bérminimum) 30%-a.
   - Amennyiben a tényleges bruttó munkabér ennél alacsonyabb (pl. részmunkaidős foglalkoztatásnál), a tényleges bér és a minimális alap közötti különbözet (`min_base_gross_diff`) után a **munkáltató köteles megfizetni** a 18,5% TB-járulékot és a 13% SZOCHO-t.
   - Törvényes mentesülési jogcímek (amikor a minimum alap szabály nem alkalmazandó):
     - Gyermekgondozási ellátások (CSED, GYED, GYES, GYET).
     - Nappali tagozatos közép- vagy felsőfokú tanulmányok folytatása.
     - Keresőképtelenség (betegszabadság, táppénz).
     - Igazolatlan hiányzás vagy fizetés nélküli szabadság időarányos csökkentő tényezőként.
     - Hóközi belépés és kilépés (naptári napok arányában tört havi minimális alap).
2. **Saját jogú nyugdíjasok mentesülése (Tbj. és Szocho tv.):**
   - A saját jogú nyugdíjas munkavállaló mentesül a 18,5% TB-járulék és a 13% SZOCHO fizetési kötelezettség alól (a kifizetőt sem terheli SZOCHO).
   - Hóközi nyugdíjazás esetén a nyugdíj előtti aktív napokra arányosítani kell a járulék- és adóalapot, míg a nyugdíj kezdő napjától a mentesülés teljes körűen beáll.
3. **Önkéntes nyugdíjpénztári munkáltatói hozzájárulás:**
   - A havi minimálbér összegét meg nem haladó rész adómentes béren kívüli juttatás, a felette lévő rész viszont bérjövedelemként adóköteles (SZJA + SZOCHO).
4. **NAV ÁNYK 2608 M-lap XML export és többes jogviszony:**
   - Egy magánszemélynek ugyanazon cégnél több párhuzamos jogviszonya is lehet (pl. megbízási jogviszony + munkaviszony). A NAV 2608 M-lap nyomtatványán ezeket diszkrét `<Jogviszonysorszam>` sorszámmal, önálló lapként kell szerepeltetni.

---

## 2. Adatbázis Séma Bővítés

A módosítások a `supabase/migrations/20260927150000_tb_social_security_module.sql` migrációban kerültek élesítésre.

### 2.1 `public.accounty_employments` módosítások:
```sql
ALTER TABLE public.accounty_employments
  ADD COLUMN IF NOT EXISTS pensioner_type TEXT,
  ADD COLUMN IF NOT EXISTS pension_start_date DATE,
  ADD COLUMN IF NOT EXISTS is_social_security_pensioner BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS job_serial_number INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS job_code TEXT,
  ADD COLUMN IF NOT EXISTS feor_code TEXT,
  ADD COLUMN IF NOT EXISTS tb_min_base_exempt BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS tb_min_base_exempt_reason TEXT,
  ADD COLUMN IF NOT EXISTS voluntary_pension_employer_huf NUMERIC(12, 2) DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_accounty_employments_pensioner 
  ON public.accounty_employments(company_id, is_social_security_pensioner) 
  WHERE is_social_security_pensioner = true;

CREATE INDEX IF NOT EXISTS idx_accounty_employments_tb_exempt 
  ON public.accounty_employments(company_id, tb_min_base_exempt) 
  WHERE tb_min_base_exempt = true;
```

### 2.2 `public.accounty_payroll_calculations` módosítások:
```sql
ALTER TABLE public.accounty_payroll_calculations
  ADD COLUMN IF NOT EXISTS min_base_gross_diff NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_base_employer_contribution NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_pensioner_exempt BOOLEAN DEFAULT false;
```

---

## 3. Adómotor és Számítási Logika (`taxEngine.ts`)

A `calculatePayroll` függvény az alábbi matematikai és törvényi algoritmust futtatja:

1. **Minimális Alap Küszöb Megállapítása:**
   $$\text{minBaseThreshold} = (\text{isSkilled} \ ? \ \text{guaranteedMinWage} : \text{minWage}) \times 0.30$$
2. **Időarányosítás Kieső Idők és Tört Hónap Szerint:**
   $$\text{eligibleRatio} = \frac{\max(0, \text{activeDaysInMonth} - \text{suspensionDays} - \text{sickLeaveDays})}{\text{totalDaysInMonth}}$$
   $$\text{effectiveMinBase} = \text{round}(\text{minBaseThreshold} \times \text{eligibleRatio})$$
3. **Hóközi Nyugdíjazás Arányosítás:**
   Ha a munkavállaló hó közben ment nyugdíjba (`pensionStartDate`):
   $$\text{nonPensionerRatio} = \frac{\text{pensionStartDate.getDate()} - 1}{\text{totalDaysInMonth}}$$
   A TB járulék és a SZOCHO csak a nyugdíj előtti aktív napokra kerül megállapításra:
   $$\text{tbBase} = \text{round}(\text{grossSalary} \times \text{nonPensionerRatio})$$
   $$\text{effectiveMinBase} = \text{round}(\text{effectiveMinBase} \times \text{nonPensionerRatio})$$
4. **Munkáltatói Különbözeti Járulékfizetési Kötelezettség:**
   Ha nem áll fenn mentesülés (`!tbMinBaseExempt && !isPensionerExempt`) és $\text{grossSalary} < \text{effectiveMinBase}$:
   $$\text{minBaseGrossDiff} = \text{effectiveMinBase} - \text{grossSalary}$$
   $$\text{minBaseEmployerTb} = \text{round}(\text{minBaseGrossDiff} \times 0.185)$$
   $$\text{minBaseEmployerSzocho} = \text{round}(\text{minBaseGrossDiff} \times 0.13)$$
   $$\text{minBaseEmployerContribution} = \text{minBaseEmployerTb} + \text{minBaseEmployerSzocho}$$

---

## 4. Távollét Szűrés és Dátum-határ Védelem (`usePayrollData.ts`)

Korábban a munkavállalóhoz tartozó összes távollét lekérdezésre került szűretlenül.
- **Megoldás:** Supabase lekérdezési ablak:
  ```typescript
  .lte('start_date', cycleEndDate)
  .gte('end_date', cycleStartDate)
  ```
- **Hónaphatár átfedés korrekció:**
  ```typescript
  const overlapStart = new Date(Math.max(leaveStart.getTime(), monthStart.getTime()));
  const overlapEnd = new Date(Math.min(leaveEnd.getTime(), monthEnd.getTime()));
  const overlapDays = Math.max(0, Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 3600 * 24)) + 1);
  const actualOverlap = Math.min(leave.days, overlapDays);
  ```

---

## 5. ÁNYK 2608 M-lap XML és Többes Jogviszony (`filingGenerator.ts`)

A NAV 2608 havi bevallás M-lapjai a magánszemély adóazonosító jele és a jogviszony sorszáma alapján alkotnak egyedi kulcsot:
- `<Jogviszonysorszam>${emp.jobSerialNumber || 1}</Jogviszonysorszam>`
- A `Filing2608Page.tsx` lekérdezi az `accounty_employments` táblát, és ha egy dolgozó több jogviszonnyal rendelkezik, minden jogviszonyhoz önálló kalkulációs sort rendel `(Jogviszony #X)` megjelöléssel és átadja az XML generátornak.

---

## 6. Következmények és Trade-offok

**Pozitív:**
- 100%-os jogszabályi megfelelőség a Tbj. 27. § (2) szerinti NAV elvárásokkal.
- Nincs több torzítás korábbi vagy jövőbeli fizetés nélküli szabadságok miatt.
- Azonnali, hiba nélküli ÁNYK 2608 XML import többes jogviszony esetén is.
- A könyvelő a feladás előtt azonnali figyelmeztetést kap a 0 Ft-os bruttó bér melletti munkáltatói terhekről.

**Trade-offok:**
- A hóközi nyugdíjazás naptári napos arányosítása pontos, de feltételezi, hogy a hóközi bér egyenletesen oszlik el a hónapban (a törvényes standard átalányelv). Ha a munkavállaló speciális elszámolású órabéres, a bérfelosztást a jelenléti ív órái szerint a `PayrollStep8` manuálisan is finomhangolhatja.
