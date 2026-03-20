import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import { getPaymentStatusBadge } from '@/hooks/useComputedStatus';

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

export const getTypeBadge = (tipus: string | null) => {
  const t = tipus?.toLowerCase() ?? "";
  if (t === "bér")
    return { label: "Bér", className: "bg-purple-500/15 text-purple-500 border-purple-500/20" };
  if (t === "bruttó_bér")
    return { label: "Bruttó Bér", className: "bg-indigo-500/15 text-indigo-500 border-indigo-500/20" };
  if (t === "áfa")
    return { label: "ÁFA", className: "bg-blue-500/15 text-blue-500 border-blue-500/20" };
  if (t === "adó")
    return { label: "Adó", className: "bg-rose-500/15 text-rose-500 border-rose-500/20" };
  if (t === "járulék")
    return { label: "Járulék", className: "bg-amber-500/15 text-amber-500 border-amber-500/20" };
  return { label: tipus || "—", className: "bg-muted text-muted-foreground border-border" };
};

export const getStatusBadge = (item: SalaryItem) => {
  return getPaymentStatusBadge(item.transaction_id);
};

export const formatPaymentDate = (dateString: string | null) => {
  if (!dateString) return "–";
  try {
    return format(new Date(dateString), "yyyy.MM.dd.", { locale: hu });
  } catch {
    return dateString;
  }
};
