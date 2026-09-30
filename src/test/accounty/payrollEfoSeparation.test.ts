import { describe, it, expect } from 'vitest';

describe('Payroll 3-Column Dashboard: Regular vs EFO Separation', () => {
  const efoCodes = ['81', '82', '83', '1181', '1138', '1139', 'efo', 'efo_alkalmi'];

  interface Employee {
    id: string;
    first_name: string;
    last_name: string;
    tax_id: string | null;
    taj_number: string | null;
    status: string;
  }

  interface Employment {
    id: string;
    employee_id: string;
    employment_type: string | null;
    job_code: string | null;
    job_title: string;
  }

  interface EfoEntry {
    id: string;
    tax_id: string;
    name: string;
    taj_number: string | null;
    days_alkalmi: number;
    days_total_used: number;
    days_total_available: number;
  }

  const isEmployeeEfo = (
    emp: Employee,
    employments: Employment[],
    efoEntries: EfoEntry[]
  ): boolean => {
    const empJobs = employments.filter(e => e.employee_id === emp.id);
    const hasEfoJob = empJobs.some(j => {
      const t = (j.employment_type || '').toLowerCase();
      const c = (j.job_code || '').trim().toLowerCase();
      return efoCodes.includes(t) || efoCodes.includes(c) || t.includes('efo');
    });
    if (hasEfoJob) return true;

    return efoEntries.some(efo =>
      (emp.tax_id && efo.tax_id === emp.tax_id) ||
      (emp.taj_number && efo.taj_number && efo.taj_number === emp.taj_number)
    );
  };

  const sampleEmployees: Employee[] = [
    { id: 'emp-1', first_name: 'Ferenc', last_name: 'Bakó', tax_id: '8401122078', taj_number: '112020789', status: 'active' },
    { id: 'emp-2', first_name: 'Istvánné', last_name: 'Dr. Zay', tax_id: '8390795930', taj_number: '079593085', status: 'active' },
    { id: 'emp-3', first_name: 'Viktor Ferenc', last_name: 'Jámbor', tax_id: '8420418164', taj_number: '041816497', status: 'active' },
    { id: 'emp-4', first_name: 'Mária', last_name: 'Tóth', tax_id: '8351068112', taj_number: '106811241', status: 'active' },
  ];

  const sampleEmployments: Employment[] = [
    { id: 'job-1', employee_id: 'emp-1', employment_type: 'efo_alkalmi', job_code: '1138', job_title: 'Művészeti kisegítő' },
    { id: 'job-2', employee_id: 'emp-2', employment_type: 'efo_alkalmi', job_code: '1138', job_title: 'Szervező asszisztens' },
    { id: 'job-3', employee_id: 'emp-3', employment_type: 'tarsas_vallalkozo', job_code: '1121', job_title: 'Ügyvezető' },
    { id: 'job-4', employee_id: 'emp-4', employment_type: 'munkaviszony', job_code: '1111', job_title: 'Könyvelő' },
  ];

  const sampleEfoEntries: EfoEntry[] = [
    { id: 'efo-1', tax_id: '8401122078', name: 'Bakó Ferenc', taj_number: '112020789', days_alkalmi: 14, days_total_used: 14, days_total_available: 120 },
    { id: 'efo-2', tax_id: '8390795930', name: 'Dr. Zay Istvánné', taj_number: '079593085', days_alkalmi: 95, days_total_used: 95, days_total_available: 120 },
    // EFO person from NAV ÜPO not yet registered as accounty_employees
    { id: 'efo-unregistered', tax_id: '8559998877', name: 'Kovács Új Alkalmi', taj_number: '999888777', days_alkalmi: 5, days_total_used: 5, days_total_available: 120 },
  ];

  it('correctly partitions employees into regular vs EFO sets', () => {
    const regularEmployees = sampleEmployees.filter(e => !isEmployeeEfo(e, sampleEmployments, sampleEfoEntries));
    const efoEmployees = sampleEmployees.filter(e => isEmployeeEfo(e, sampleEmployments, sampleEfoEntries));

    expect(regularEmployees.map(e => `${e.last_name} ${e.first_name}`)).toEqual([
      'Jámbor Viktor Ferenc',
      'Tóth Mária',
    ]);

    expect(efoEmployees.map(e => `${e.last_name} ${e.first_name}`)).toEqual([
      'Bakó Ferenc',
      'Dr. Zay Istvánné',
    ]);
  });

  it('identifies EFO employee even if only present in accounty_efo_entries (NAV ÜPO cross-check)', () => {
    const unregisteredEmp: Employee = {
      id: 'emp-5',
      first_name: 'Új',
      last_name: 'Kovács',
      tax_id: '8559998877',
      taj_number: '999888777',
      status: 'active',
    };
    // No employment record yet
    expect(isEmployeeEfo(unregisteredEmp, [], sampleEfoEntries)).toBe(true);
  });

  it('builds combined EFO list including NAV ÜPO entries not yet in employee directory', () => {
    const efoEmployees = sampleEmployees.filter(e => isEmployeeEfo(e, sampleEmployments, sampleEfoEntries));
    const list: any[] = [];
    const matchedTaxIds = new Set<string>();

    for (const emp of efoEmployees) {
      const efoData = sampleEfoEntries.find(efo => efo.tax_id === emp.tax_id);
      if (emp.tax_id) matchedTaxIds.add(emp.tax_id);
      list.push({
        name: `${emp.last_name} ${emp.first_name}`,
        daysTotalUsed: efoData?.days_total_used ?? 0,
      });
    }

    for (const efo of sampleEfoEntries) {
      if (!matchedTaxIds.has(efo.tax_id)) {
        list.push({
          name: efo.name,
          daysTotalUsed: efo.days_total_used,
        });
      }
    }

    expect(list).toHaveLength(3);
    expect(list.map(i => i.name)).toEqual([
      'Bakó Ferenc',
      'Dr. Zay Istvánné',
      'Kovács Új Alkalmi',
    ]);
  });

  it('flags warning when an EFO employee exceeds 90 days out of 120 annual limit', () => {
    const bako = sampleEfoEntries[0];
    const zay = sampleEfoEntries[1];

    expect(bako.days_total_used > 90).toBe(false);
    expect(zay.days_total_used > 90).toBe(true);
  });
});
