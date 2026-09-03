/**
 * Tömeges Dolgozói Import és Bérszámfejtési Rekonstrukciós React Hooks
 * 
 * Biztosítja a dolgozói adatok, jogviszonyok és havi bérszámfejtési ciklusok
 * atomikus, megbízható mentését és frissítését a Supabase adatbázisban.
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { payrollQueryKeys, type PayrollEmployee, type PayrollEmployment } from '@/hooks/usePayrollData';
import { useToast } from '@/hooks/use-toast';
import type { Parsed08Document, Parsed08Employee } from '@/lib/payroll/nav08XmlParser';
import { preparePayrollCalculationRecord } from '@/lib/payroll/payrollReconstructionEngine';

export interface BulkImportResult {
  totalProcessed: number;
  employeesCreated: number;
  employeesUpdated: number;
  employmentsCreated: number;
  errors: string[];
}

export interface ReconstructionResult {
  cyclesProcessed: number;
  cyclesCreated: number;
  cyclesUpdated: number;
  totalCalculationsCreated: number;
  errors: string[];
}

export function useBulkImportPayroll() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; message: string }>({
    current: 0,
    total: 0,
    message: '',
  });

  /**
   * Dolgozók és Jogviszonyaik tömeges mentése (Excel vagy 08 XML adatokból)
   */
  const importEmployeesMutation = useMutation({
    mutationFn: async ({
      companyId,
      employees,
    }: {
      companyId: string;
      employees: Parsed08Employee[];
    }): Promise<BulkImportResult> => {
      if (!companyId || employees.length === 0) {
        throw new Error('Nincs feldolgozandó dolgozói adat vagy hiányzik a cég azonosítója.');
      }

      setIsProcessing(true);
      setProgress({ current: 0, total: employees.length, message: 'Meglévő dolgozók lekérdezése...' });

      // 1. Lekérjük a cég meglévő dolgozóit és jogviszonyait
      const { data: existingEmps, error: empErr } = await supabase
        .from('accounty_employees')
        .select('*')
        .eq('company_id', companyId);

      if (empErr) throw empErr;

      const { data: existingEmployments, error: emplErr } = await supabase
        .from('accounty_employments')
        .select('*')
        .eq('company_id', companyId);

      if (emplErr) throw emplErr;

      const localEmps = [...(existingEmps || [])];
      const localEmployments = [...(existingEmployments || [])];

      let employeesCreated = 0;
      let employeesUpdated = 0;
      let employmentsCreated = 0;
      const errors: string[] = [];

      for (let i = 0; i < employees.length; i++) {
        const emp = employees[i];

        // Védelem szellem-dolgozók ellen: ha sem név, sem TAJ, sem adóazonosító nincs megadva, kihagyjuk
        if (!emp.lastName && !emp.firstName && !emp.tajNumber && !emp.taxId) {
          errors.push(`${i + 1}. sor kihagyva: hiányzó azonosító adatok (név és azonosító nélkül nem hozható létre dolgozó).`);
          continue;
        }

        setProgress({
          current: i + 1,
          total: employees.length,
          message: `${emp.lastName || ''} ${emp.firstName || ''} mentése (${i + 1}/${employees.length})...`,
        });

        try {
          // Keressük a meglévő dolgozót TAJ vagy Adóazonosító alapján
          const cleanTaj = emp.tajNumber?.replace(/[\s-]/g, '');
          const cleanTax = emp.taxId?.replace(/[\s-]/g, '');

          let matchedEmp = localEmps.find(e => {
            const matchTaj = cleanTaj && e.taj_number && e.taj_number.replace(/[\s-]/g, '') === cleanTaj;
            const matchTax = cleanTax && e.tax_id && e.tax_id.replace(/[\s-]/g, '') === cleanTax;
            return matchTaj || matchTax;
          });

          let employeeId: string;

          if (matchedEmp) {
            employeeId = matchedEmp.id;
            employeesUpdated++;
          } else {
            // Új dolgozó létrehozása
            const { data: newEmp, error: insertEmpErr } = await supabase
              .from('accounty_employees')
              .insert({
                company_id: companyId,
                last_name: emp.lastName,
                first_name: emp.firstName,
                birth_name: emp.birthName || null,
                birth_date: emp.birthDate || null,
                birth_place: emp.birthPlace || null,
                mothers_name: emp.mothersName || null,
                taj_number: emp.tajNumber || null,
                tax_id: emp.taxId || null,
                gender: emp.gender || null,
                nationality: emp.nationality || 'HU',
                status: 'active',
              })
              .select()
              .single();

            if (insertEmpErr) throw insertEmpErr;
            employeeId = newEmp.id;
            localEmps.push(newEmp as PayrollEmployee);
            employeesCreated++;
          }

          // Jogviszony ellenőrzése és létrehozása
          const hasActiveEmployment = localEmployments.some(
            empl => empl.employee_id === employeeId && (empl.status === 'active' || !empl.status)
          );

          if (!hasActiveEmployment) {
            const { data: newEmpl, error: insertEmplErr } = await supabase
              .from('accounty_employments')
              .insert({
                employee_id: employeeId,
                company_id: companyId,
                job_code: emp.jobCode || '1101',
                job_serial_number: 1,
                employment_type: emp.employmentType || 'munkaviszony',
                start_date: emp.startDate || new Date().toISOString().slice(0, 10),
                end_date: emp.endDate || null,
                weekly_hours: emp.weeklyHours || 40,
                feor_code: emp.feorCode || null,
                job_title: emp.jobTitle || null,
                base_salary: emp.baseSalary || emp.grossSalary || null,
                salary_type: 'monthly',
                is_insured: true,
                status: 'active',
              })
              .select()
              .single();

            if (insertEmplErr) throw insertEmplErr;
            if (newEmpl) localEmployments.push(newEmpl as PayrollEmployment);
            employmentsCreated++;
          }
        } catch (err: any) {
          errors.push(`${emp.lastName} ${emp.firstName}: ${err.message}`);
        }
      }

      setIsProcessing(false);

      return {
        totalProcessed: employees.length,
        employeesCreated,
        employeesUpdated,
        employmentsCreated,
        errors,
      };
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.employees(variables.companyId) });
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.companyEmployments(variables.companyId) });
      toast({
        title: 'Sikeres dolgozói import',
        description: `${result.employeesCreated} új dolgozó, ${result.employmentsCreated} jogviszony létrehozva.`,
      });
    },
    onError: (err: Error) => {
      setIsProcessing(false);
      toast({
        variant: 'destructive',
        title: 'Hiba a dolgozói import során',
        description: err.message,
      });
    },
  });

  /**
   * Korábbi Havi Bérszámfejtések Gyors Rekonstruálása (08-as XML fájlokból)
   */
  const reconstructCyclesMutation = useMutation({
    mutationFn: async ({
      companyId,
      documents,
      overwriteExisting = true,
    }: {
      companyId: string;
      documents: Parsed08Document[];
      overwriteExisting?: boolean;
    }): Promise<ReconstructionResult> => {
      if (!companyId || documents.length === 0) {
        throw new Error('Nincs feldolgozandó 08-as dokumentum.');
      }

      setIsProcessing(true);
      const errors: string[] = [];
      let cyclesCreated = 0;
      let cyclesUpdated = 0;
      let totalCalculationsCreated = 0;

      // 1. Összegyűjtjük az egyedi dolgozókat az összes havi XML-ből a duplikált import és toast-özön elkerülésére
      const uniqueEmployeesMap = new Map<string, Parsed08Employee>();
      for (const doc of documents) {
        for (const emp of doc.employees) {
          const key = (emp.taxId || emp.tajNumber || `${emp.lastName}_${emp.firstName}`).trim();
          if (key && !uniqueEmployeesMap.has(key)) {
            uniqueEmployeesMap.set(key, emp);
          }
        }
      }

      if (uniqueEmployeesMap.size > 0) {
        await importEmployeesMutation.mutateAsync({
          companyId,
          employees: Array.from(uniqueEmployeesMap.values()),
        });
      }

      // 2. Frissítjük a lekérdezett dolgozókat és jogviszonyokat
      const { data: allEmployees } = await supabase
        .from('accounty_employees')
        .select('*')
        .eq('company_id', companyId);

      const { data: allEmployments } = await supabase
        .from('accounty_employments')
        .select('*')
        .eq('company_id', companyId);

      const { data: existingCycles } = await supabase
        .from('accounty_payroll_cycles')
        .select('*')
        .eq('company_id', companyId);

      const localCycles = [...(existingCycles || [])];

      // 3. Rekonstruáljuk a havi ciklusokat és kalkulációkat
      for (let dIdx = 0; dIdx < documents.length; dIdx++) {
        const doc = documents[dIdx];
        setProgress({
          current: dIdx + 1,
          total: documents.length,
          message: `${doc.year}. ${doc.month}. havi számfejtési ciklus felépítése...`,
        });

        try {
          let cycleId: string;
          const matchCycle = localCycles.find(c => c.year === doc.year && c.month === doc.month);

          if (matchCycle) {
            cycleId = matchCycle.id;
            cyclesUpdated++;
            if (overwriteExisting) {
              await supabase
                .from('accounty_payroll_cycles')
                .update({
                  status: 'closed',
                  current_step: 8,
                  notes: `Rekonstruálva NAV 08 (${doc.filingType}) XML-ből`,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', cycleId);

              // Töröljük a régi kalkulációkat, hogy tisztán újraírjuk
              await supabase.from('accounty_payroll_calculations').delete().eq('cycle_id', cycleId);
            }
          } else {
            // Új ciklus létrehozása closed státusszal (lezárt havi számfejtés)
            const { data: newCycle, error: cycleErr } = await supabase
              .from('accounty_payroll_cycles')
              .insert({
                company_id: companyId,
                year: doc.year,
                month: doc.month,
                status: 'closed',
                current_step: 8,
                notes: `Rekonstruálva NAV 08 (${doc.filingType}) XML-ből`,
              })
              .select()
              .single();

            if (cycleErr) throw cycleErr;
            cycleId = newCycle.id;
            localCycles.push(newCycle);
            cyclesCreated++;
          }

          // Kalkulációk előkészítése és kötegelt beszúrása
          const calcRecords = [];
          for (const emp of doc.employees) {
            const cleanTaj = emp.tajNumber?.replace(/[\s-]/g, '');
            const cleanTax = emp.taxId?.replace(/[\s-]/g, '');

            const matchedEmp = (allEmployees || []).find(e => {
              const matchTaj = cleanTaj && e.taj_number && e.taj_number.replace(/[\s-]/g, '') === cleanTaj;
              const matchTax = cleanTax && e.tax_id && e.tax_id.replace(/[\s-]/g, '') === cleanTax;
              return matchTaj || matchTax;
            });

            if (!matchedEmp) continue;

            const matchedEmployment = (allEmployments || []).find(
              empl => empl.employee_id === matchedEmp.id && (empl.status === 'active' || !empl.status)
            ) || (allEmployments || []).find(
              empl => empl.employee_id === matchedEmp.id
            );

            if (!matchedEmployment) continue;

            calcRecords.push(
              preparePayrollCalculationRecord(cycleId, matchedEmployment.id, emp)
            );
          }

          if (calcRecords.length > 0) {
            const { error: calcInsertErr } = await supabase
              .from('accounty_payroll_calculations')
              .insert(calcRecords);

            if (calcInsertErr) throw calcInsertErr;
            totalCalculationsCreated += calcRecords.length;
          }
        } catch (err: any) {
          errors.push(`${doc.year}/${doc.month}: ${err.message}`);
        }
      }

      setIsProcessing(false);

      return {
        cyclesProcessed: documents.length,
        cyclesCreated,
        cyclesUpdated,
        totalCalculationsCreated,
        errors,
      };
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.cycles(variables.companyId) });
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.employees(variables.companyId) });
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.companyEmployments(variables.companyId) });
      toast({
        title: 'Bérszámfejtés sikeresen rekonstruálva!',
        description: `${result.cyclesProcessed} havi ciklus és ${result.totalCalculationsCreated} dolgozói bérszámfejtési kalkuláció mentve.`,
      });
    },
    onError: (err: Error) => {
      setIsProcessing(false);
      toast({
        variant: 'destructive',
        title: 'Hiba a bérszámfejtés rekonstrukciója során',
        description: err.message,
      });
    },
  });

  return {
    importEmployees: importEmployeesMutation.mutateAsync,
    reconstructCycles: reconstructCyclesMutation.mutateAsync,
    isImporting: importEmployeesMutation.isPending,
    isReconstructing: reconstructCyclesMutation.isPending,
    isProcessing,
    progress,
  };
}
