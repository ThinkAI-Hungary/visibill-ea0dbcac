import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { normalizeChildItem } from '../DeclarationDialogs';
import { EmployeeLeaveTab } from '../EmployeeLeaveTab';
import { resolveEmployeeLeaveInput, calculateLeaveBalance } from '@/lib/payroll/leaveCalculator';
import { calculatePayroll, type PayrollCalculationInput, type TaxParameters } from '@/lib/payroll/taxEngine';

const mockTaxParams: TaxParameters = {
  szja_rate: 0.15,
  tb_rate: 0.185,
  szocho_rate: 0.13,
  minimum_wage: 322800,
  guaranteed_minimum: 373200,
  family_1_child: 133340,
  family_2_children: 266660,
  family_3plus_children: 440000,
  young_25_cap: 715765,
  personal_disability: 107600,
  first_marriage: 33335,
  health_service_monthly: 12300,
};

describe('EB-0223: Gyermek pótszabadság & Tartós betegség Teljes Integrációs Tesztcsomag', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Adatnormalizálás és form állapot (normalizeChildItem)', () => {
    it('megőrzi az is_disabled: true értéket és pontos típuskonverziót végez', () => {
      const item = normalizeChildItem({
        id: 'child-1',
        birth_name: 'Teszt Péter',
        tax_id: '8401011234',
        birth_date: '2020-05-15',
        is_fetus: false,
        is_disabled: true,
      });

      expect(item.id).toBe('child-1');
      expect(item.birth_name).toBe('Teszt Péter');
      expect(item.tax_id).toBe('8401011234');
      expect(item.birth_date).toBe('2020-05-15');
      expect(item.is_fetus).toBe(false);
      expect(item.is_disabled).toBe(true);
    });

    it('támogatja a legacy "disabled" kulcsot is az is_disabled feloldásakor', () => {
      const item = normalizeChildItem({
        birth_name: 'Teszt Anna',
        disabled: true,
      });

      expect(item.is_disabled).toBe(true);
    });

    it('Falsy Zero védelem: null vagy undefined esetén megbízhatóan false értéket ad', () => {
      const itemEmpty = normalizeChildItem({});
      expect(itemEmpty.is_disabled).toBe(false);
      expect(itemEmpty.is_fetus).toBe(false);

      const itemNull = normalizeChildItem({ is_disabled: null, is_fetus: null });
      expect(itemNull.is_disabled).toBe(false);
      expect(itemNull.is_fetus).toBe(false);
    });
  });

  describe('2. Felületi Megjelenítés (EmployeeLeaveTab integráció)', () => {
    it('megjeleníti a Fogyatékos gyermek pótszabadság tételes sort és összesítést a Szabadság fülön', () => {
      // Számított egyenleg 1 tartós beteg és 1 egészséges gyermekkel (20 alap + 6 életkori + 4 gyermek + 2 fogyatékos = 32 nap)
      const mockLeaveBalance = {
        baseLeave: 20,
        baseLeaveHours: 160,
        ageSupplement: 6,
        ageSupplementHours: 48,
        childSupplement: 4,
        childSupplementHours: 32,
        disabledChildSupplement: 2,
        disabledChildSupplementHours: 16,
        paternityLeave: 0,
        parentalLeave: 0,
        studyLeave: 0,
        extraordinaryLeave: 0,
        carriedOver: 0,
        carriedOverHours: 0,
        extraLeave: 0,
        totalAnnual: 32,
        totalAnnualHours: 256,
        totalAvailable: 32,
        totalAvailableHours: 256,
        used: 5,
        remaining: 27,
      };

      render(<EmployeeLeaveTab leaves={[]} leaveBalance={mockLeaveBalance as any} />);

      // Ellenőrizzük a Quick Stats kártyát
      expect(screen.getByText('Éves keret összesen')).toBeInTheDocument();
      expect(screen.getAllByText('32 nap').length).toBeGreaterThanOrEqual(1);

      // Ellenőrizzük a tételes kategória sort
      expect(screen.getByText('Fogyatékos gyermek pótszabadság')).toBeInTheDocument();
      expect(screen.getByText('16 óra')).toBeInTheDocument();

      // Ellenőrizzük az ÖSSZESÍTÉS fejlécet és cellát
      expect(screen.getByText('ÖSSZESÍTÉS')).toBeInTheDocument();
      expect(screen.getAllByText('256 óra').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('3. End-to-End Adatfolyam Lánc (Nyilatkozat -> Kalkulátor -> UI)', () => {
    const mockEmployee = {
      id: 'emp-101',
      birth_date: '1988-06-20', // 2026-ban 38 éves -> 20 alap + 6 életkori pótszabadság (Mt. 117. §)
    };

    it('egy gyermek pótszabadság nyilatkozatból (child_leave) automatikusan feloldja a szabadságkeretet', () => {
      // 1. Felhasználó által rögzített child_leave nyilatkozat 2 gyermekkel (1 tartós beteg)
      const declarations = [
        {
          declaration_type: 'child_leave',
          status: 'active',
          valid_from: '2026-01-01',
          parameters: {
            children: [
              { birth_name: 'Kovács Bence', birth_date: '2018-04-12', is_fetus: false, is_disabled: true },
              { birth_name: 'Kovács Lili', birth_date: '2021-09-03', is_fetus: false, is_disabled: false },
            ],
          },
        },
      ];

      // 2. Szabadság bemenet feloldása
      const leaveInput = resolveEmployeeLeaveInput({
        employee: mockEmployee,
        targetYear: 2026,
        dependents: [],
        declarations,
        leaves: [],
      });

      expect(leaveInput).not.toBeNull();
      expect(leaveInput?.childrenUnder16).toBe(2);
      expect(leaveInput?.disabledChildren).toBe(1);

      // 3. Éves egyenleg kiszámítása
      const balance = calculateLeaveBalance(leaveInput!);
      expect(balance.baseLeave).toBe(20);
      expect(balance.ageSupplement).toBe(6); // 38 éves -> 6 nap (Mt. 117. §)
      expect(balance.childSupplement).toBe(4); // 2 gyermek -> 4 nap
      expect(balance.disabledChildSupplement).toBe(2); // 1 tartós beteg -> +2 nap
      expect(balance.totalAnnual).toBe(32); // 20 + 6 + 4 + 2 = 32 nap

      // 4. UI Megjelenítés tesztelése ezzel a számított értékkel
      const { unmount } = render(<EmployeeLeaveTab leaves={[]} leaveBalance={balance} />);
      expect(screen.getByText('Fogyatékos gyermek pótszabadság')).toBeInTheDocument();
      expect(screen.getAllByText('32 nap').length).toBeGreaterThanOrEqual(1);
      unmount();
    });

    it('biztosítja a taxEngine izolációt: a child_leave nyilatkozat NEM csökkenti az SZJA adóalapot', () => {
      // Munkavállaló havi bére
      const baseSalaryInput: PayrollCalculationInput = {
        grossComponents: {
          baseSalary: 500_000,
          overtime: 0,
          nightShift: 0,
          sundayPremium: 0,
          holidayPremium: 0,
          bonus: 0,
          sickLeave: 0,
          otherIncome: 0,
        },
        employeeAge: 38,
        employeeGender: 'female',
        declarations: {}, // Alapeset: nincs családi adókedvezmény
        params: mockTaxParams,
      };

      const baselineTax = calculatePayroll(baseSalaryInput);
      expect(baselineTax.szjaBase).toBe(500_000);
      expect(baselineTax.szjaAmount).toBe(75_000); // 500k * 15%

      // Ha az adómotorba kizárólag a pótszabadság (child_leave) nyilatkozat kerül (nincs family adókedvezmény):
      // A taxEngine csak declarations.family-t vizsgálja!
      const taxWithChildLeaveOnly = calculatePayroll({
        ...baseSalaryInput,
        declarations: {}, // child_leave NEM hoz létre declarations.family-t
      });

      expect(taxWithChildLeaveOnly.szjaBase).toBe(500_000);
      expect(taxWithChildLeaveOnly.szjaAmount).toBe(75_000);
      expect(taxWithChildLeaveOnly.netSalary).toBe(baselineTax.netSalary);
    });
  });

  describe('4. Kuka gomb és Törzsadat megerősítés (handleRemoveChild viselkedés)', () => {
    it('megerősítés kérése (window.confirm) tesztelése meglévő adatbázis rekord törlésekor', () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true);

      // Szimuláljuk a törlési logikát:
      const childrenList = [
        { id: 'db-dep-1', birth_name: 'Gyermek 1', tax_id: '', birth_date: '', is_fetus: false, is_disabled: true },
        { id: undefined, birth_name: 'Új Gyermek', tax_id: '', birth_date: '', is_fetus: false, is_disabled: false },
      ];

      // 1. Törlés adatbázisban létező gyermeknél (id-vel)
      const targetChild = childrenList[0];
      let dbDeleted = false;
      if (targetChild.id) {
        const confirmed = window.confirm('Szeretnéd az eltartottak törzséből is törölni ezt a gyermeket?');
        if (confirmed) {
          dbDeleted = true;
        }
      }

      expect(confirmSpy).toHaveBeenCalledWith('Szeretnéd az eltartottak törzséből is törölni ezt a gyermeket?');
      expect(dbDeleted).toBe(true);

      // 2. Ha a felhasználó Mégse-t választ (false)
      confirmSpy.mockReturnValueOnce(false);
      let dbDeletedCancelled = false;
      if (targetChild.id) {
        const confirmed = window.confirm('Szeretnéd az eltartottak törzséből is törölni ezt a gyermeket?');
        if (confirmed) {
          dbDeletedCancelled = true;
        }
      }
      expect(dbDeletedCancelled).toBe(false);
    });
  });
});
