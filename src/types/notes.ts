export interface Note {
  id: string;
  company_id: string;
  user_id: string;
  title: string;
  content: string;
  is_private: boolean;
  invoice_id: string | null;
  invoice_ids?: string[];
  transaction_id?: string | null;
  transaction_ids?: string[];
  created_at: string;
  updated_at: string;
  // Joined fields
  profiles?: {
    full_name: string | null;
    email: string | null;
  };
  invoices?: Array<{
    id: string;
    invoice_number: string;
    supplier_name: string;
    net_amount: number;
    currency: string;
    invoice_date: string;
  }>;
  transactions?: Array<{
    id: string;
    transaction_date: string;
    description: string;
    amount: number;
    currency: string;
    bank_name: string;
  }>;
}
