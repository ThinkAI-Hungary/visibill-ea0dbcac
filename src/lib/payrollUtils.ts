/**
 * Munkaidő-nyilvántartó modul – Üzleti logika.
 *
 * A rezsióradíj és projektköltség számításokat kliens oldalon
 * preview/UI célokra biztosítjuk. A végleges számítások
 * PostgreSQL-ben történnek (calculate_hourly_cost SQL fn + nézet).
 */

// ── Típusok ──

export interface EmployeeRate {
  id: string;
  company_id: string;
  user_id: string | null;
  employee_name: string;
  employee_type: 'employee' | 'contractor';
  base_salary_cost: number | null;
  hourly_rate: number | null;
  effective_date: string;
  email: string | null;
  phone: string | null;
  project_id?: string | null;
  registration_token: string | null;
  created_at: string;
  updated_at: string;
}

export interface TimeEntry {
  id: string;
  company_id: string;
  user_id: string;
  project_id: string | null;
  date: string;
  hours: number;
  description: string | null;
  status: 'draft' | 'submitted' | 'approved';
  absence_type: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompanyWorkSettings {
  id: string;
  company_id: string;
  work_start_time: string;
  work_end_time: string;
  admin_deadline: string;
  monthly_working_hours: number;
  created_at: string;
  updated_at: string;
}

export interface SalaryCostItem {
  tipus: string | null;
  összeg: number;
}

// ── Számítási függvények ──

/**
 * Rezsióradíj számítás: teljes bérköltség / havi munkaórák.
 *
 * A teljes bérköltség = nettó bér + adó + járulék (a cég összes
 * költsége az adott dolgozóra egy hónapban).
 *
 * @param totalSalaryCost  A dolgozó teljes havi költsége (bér + adó + járulék)
 * @param monthlyWorkingHours  Havi munkaórák száma (default: 168)
 * @returns  Rezsióradíj kerekítve 2 tizedesre
 */
export function calculateHourlyCost(
  totalSalaryCost: number,
  monthlyWorkingHours: number = 168
): number {
  if (monthlyWorkingHours <= 0) return 0;
  return Math.round((totalSalaryCost / monthlyWorkingHours) * 100) / 100;
}

/**
 * Teljes bérköltség kiszámítása a salary tételekből.
 * Csak a 'bér' + 'adó' + 'járulék' típusú tételeket összegzi.
 *
 * A 'bruttó_bér' típust NEM számítjuk bele, mert az a
 * bérlista szerinti bruttó (nettó + SZJA), de a járulék
 * a bruttón felül a cég által fizetett közteher.
 */
export function calculateTotalSalaryCost(
  salaryItems: SalaryCostItem[]
): number {
  return salaryItems
    .filter(item => ['bér', 'adó', 'járulék'].includes(item.tipus ?? ''))
    .reduce((sum, item) => sum + Number(item.összeg), 0);
}

/**
 * Projekt valós bérköltség számítás.
 */
export function calculateProjectLaborCost(
  hours: number,
  hourlyRate: number
): number {
  return Math.round(hours * hourlyRate * 100) / 100;
}

/**
 * Dátum validáció: nem a jövőben.
 */
export function isValidEntryDate(date: Date): boolean {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return date <= today;
}

/**
 * Összeg formázás (HUF, magyar formátum).
 * Újrahasználható helper a munkaidő modulban.
 */
export function formatHourlyRate(rate: number | null): string {
  if (rate === null || rate === 0) return '—';
  return new Intl.NumberFormat('hu-HU', {
    style: 'currency',
    currency: 'HUF',
    maximumFractionDigits: 0,
  }).format(rate);
}
