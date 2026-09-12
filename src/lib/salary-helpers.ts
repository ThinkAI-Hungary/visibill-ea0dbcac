import { format } from 'date-fns';
import { hu } from 'date-fns/locale';

export interface SalaryItem {
  id: string;
  név: string;
  összeg: number;
  dátum: string | null;
  tipus: string | null;
  statusz: string | null;
  kifizetes_ideje: string | null;
  fizetesi_mod: string | null;
  megjegyzes: string | null;
  munkavallalo_neve: string | null;
  transaction_id: string | null;
  created_at: string;
  updated_at: string;
}

export const formatDate = (dateString: string | null) => {
  if (!dateString) return "—";
  try {
    return format(new Date(dateString), "yyyy. MMM d.", { locale: hu });
  } catch {
    return dateString;
  }
};

export const getTypeBadge = (tipus: string | null, t?: (key: string, defaultValue?: any) => string) => {
  const normalized = tipus?.toLowerCase() ?? "";
  if (normalized === "bér")
    return { label: t ? t('hr:salaries.types.salary', 'Bér') : "Bér", className: "bg-purple-500/15 text-purple-500 border-purple-500/20" };
  if (normalized === "bruttó_bér")
    return { label: t ? t('hr:salaries.types.gross_salary', 'Bruttó Bér') : "Bruttó Bér", className: "bg-indigo-500/15 text-indigo-500 border-indigo-500/20" };
  if (normalized === "áfa")
    return { label: t ? t('hr:salaries.types.vat', 'ÁFA') : "ÁFA", className: "bg-blue-500/15 text-blue-500 border-blue-500/20" };
  if (normalized === "adó")
    return { label: t ? t('hr:salaries.types.tax', 'Adó') : "Adó", className: "bg-rose-500/15 text-rose-500 border-rose-500/20" };
  if (normalized === "járulék")
    return { label: t ? t('hr:salaries.types.contribution', 'Járulék') : "Járulék", className: "bg-amber-500/15 text-amber-500 border-amber-500/20" };
  return { label: tipus || "—", className: "bg-muted text-muted-foreground border-border" };
};

export function isSalaryItemPaid(item: SalaryItem): boolean {
  return (
    !!item.transaction_id ||
    item.fizetesi_mod === 'készpénz' ||
    item.statusz?.toLowerCase() === 'paid' ||
    item.statusz?.toLowerCase() === 'fizetve'
  );
}

export const getStatusBadge = (item: SalaryItem, t?: (key: string, defaultValue?: any) => string) => {
  if (isSalaryItemPaid(item)) {
    return { label: t ? t('hr:salaries.status.paid', 'Fizetve') : 'Fizetve', className: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/20' };
  }
  return { label: t ? t('hr:salaries.status.open', 'Nyitott') : 'Nyitott', className: 'bg-amber-500/15 text-amber-500 border-amber-500/20' };
};

export const getLocalizedSalaryTaxName = (name: string, t?: (key: string, defaultValue?: any) => string): string => {
  if (!t) return name;
  const n = name.trim().toLowerCase();
  if (n.includes('szja') || n.includes('levont szja')) {
    return t('hr:salaries.tax_items.szja', name);
  }
  if (n.includes('kiva')) {
    return t('hr:salaries.tax_items.kiva', name);
  }
  if (n.includes('egysz') || n.includes('egyszerűsített')) {
    return t('hr:salaries.tax_items.simple_emp', name);
  }
  if (n.includes('társ.bizt') || n.includes('társadalombiztosítás')) {
    return t('hr:salaries.tax_items.social_security', name);
  }
  if (n.includes('szociális hozzájárulási')) {
    return t('hr:salaries.tax_items.social_tax', name);
  }
  if (n.includes('szakképzési')) {
    return t('hr:salaries.tax_items.vocational', name);
  }
  return name;
};

export const formatPaymentDate = (dateString: string | null) => {
  if (!dateString) return "–";
  try {
    return format(new Date(dateString), "yyyy.MM.dd.", { locale: hu });
  } catch {
    return dateString;
  }
};
