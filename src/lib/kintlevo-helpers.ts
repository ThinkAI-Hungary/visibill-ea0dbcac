import React from 'react';
import { CheckCircle2, Clock, AlertTriangle, Skull } from 'lucide-react';

export type AgingCategory = 'green' | 'yellow' | 'red' | 'purple';

export interface UnifiedInvoice {
  id: string;
  invoiceNumber: string;
  issueDate: string | null;
  dueDate: string;
  amount: number;
  currency: string;
  companyName: string;
  taxNumber: string | null;
  source: 'nav' | 'manual';
  attachmentUrl: string | null;
  daysOverdue: number;
  category: AgingCategory;
}

export interface CompanyGroup {
  companyName: string;
  taxNumber: string | null;
  partnerId: string | null;
  partnerEmail: string | null;
  invoices: UnifiedInvoice[];
  totalAmount: number;
  worstCategory: AgingCategory;
  lastSent: string | null;
}

export const CATEGORY_ORDER: AgingCategory[] = ['green', 'yellow', 'red', 'purple'];

export const CAT = {
  green: {
    label: 'Nem lejárt',
    rowBg: 'bg-emerald-500/5',
    border: 'border-emerald-500/25',
    text: 'text-emerald-400',
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    card: 'bg-emerald-500/5 border-emerald-500/20',
    icon: CheckCircle2,
  },
  yellow: {
    label: '1–30 napos',
    rowBg: 'bg-amber-500/5',
    border: 'border-amber-500/25',
    text: 'text-amber-400',
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    card: 'bg-amber-500/5 border-amber-500/20',
    icon: Clock,
  },
  red: {
    label: '31–180 napos',
    rowBg: 'bg-red-500/5',
    border: 'border-red-500/25',
    text: 'text-red-400',
    badge: 'bg-red-500/15 text-red-300 border-red-500/30',
    card: 'bg-red-500/5 border-red-500/20',
    icon: AlertTriangle,
  },
  purple: {
    label: '180+ napos',
    rowBg: 'bg-purple-500/5',
    border: 'border-purple-500/25',
    text: 'text-purple-400',
    badge: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    card: 'bg-purple-500/5 border-purple-500/20',
    icon: Skull,
  },
} satisfies Record<AgingCategory, {
  label: string; rowBg: string; border: string;
  text: string; badge: string; card: string; icon: React.ComponentType<any>;
}>;

export function getCategory(daysOverdue: number): AgingCategory {
  if (daysOverdue <= 0) return 'green';
  if (daysOverdue <= 30) return 'yellow';
  if (daysOverdue <= 180) return 'red';
  return 'purple';
}

export function worstOf(invoices: UnifiedInvoice[]): AgingCategory {
  let worst: AgingCategory = 'green';
  for (const inv of invoices) {
    if (CATEGORY_ORDER.indexOf(inv.category) > CATEGORY_ORDER.indexOf(worst)) {
      worst = inv.category;
    }
  }
  return worst;
}

export function fmt(n: number): string {
  return new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 0 }).format(n) + ' Ft';
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
