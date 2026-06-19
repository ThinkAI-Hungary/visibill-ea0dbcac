// ── Accounty shared types ──

export interface ClientData {
  id: string;
  name: string;
  taxNumber: string;
  status: 'Rendben' | 'Feldolgozandó' | 'Kritikus';
  unprocessedCount: number;
  missingCount: number;
  deadline: string;
  deadlineDate: string;
  progress: number;
  colorHex: string;
  assignedToMe: boolean;
  ownerId: string;
  isMainAccountant?: boolean;
}


export type BlockingCategory = 'bejovo' | 'kimeno' | 'bank' | 'ber';

export interface BlockingItem {
  id: string;
  clientId: string;
  category: BlockingCategory;
  title: string;
  subtitle: string;
  source: string;
  amount?: string;
  date?: string;
  priority: 'urgent' | 'medium' | 'low';
  details: string;
  invoiceNumber?: string;
  resolveRoute?: string;
}

export const blockingCategoryMeta: Record<BlockingCategory, { label: string; icon: string }> = {
  bejovo:  { label: 'Bejövő',  icon: '' },
  kimeno:  { label: 'Kimenő',  icon: '' },
  bank:    { label: 'Bank',    icon: '' },
  ber:     { label: 'Bér',     icon: '' },
};
