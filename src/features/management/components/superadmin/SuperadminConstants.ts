import React from 'react';
import { SuperadminModuleKey } from '../../api/types';
import {
  FileText, Landmark, ArrowLeftRight, BookOpen, Briefcase, Wallet,
  Tags, FolderKanban, Users, Package2, Truck, FileSpreadsheet, Upload,
  AlertCircle, Scale, ClipboardList, CalendarClock, HardHat, Coins,
  ScrollText, ShieldCheck, Gavel, Badge
} from 'lucide-react';

export const SUPERADMIN_MODULES: Array<{ key: SuperadminModuleKey; label: string; icon: React.ElementType; platform: 'eaisybill' | 'eaisybooks' }> = [
  // ── eaisybill ──
  { key: 'invoices', label: 'Számlák', icon: FileText, platform: 'eaisybill' },
  { key: 'nav_invoices', label: 'NAV számlák', icon: Landmark, platform: 'eaisybill' },
  { key: 'transactions', label: 'Tranzakciók', icon: ArrowLeftRight, platform: 'eaisybill' },
  { key: 'gl_journal_entries', label: 'Főkönyv', icon: BookOpen, platform: 'eaisybill' },
  { key: 'salary', label: 'Bér', icon: Briefcase, platform: 'eaisybill' },
  { key: 'petty_cash_entries', label: 'Házipénztár', icon: Wallet, platform: 'eaisybill' },
  { key: 'categories', label: 'Kategóriák', icon: Tags, platform: 'eaisybill' },
  { key: 'projects', label: 'Projektek', icon: FolderKanban, platform: 'eaisybill' },
  { key: 'partners', label: 'Partnertörzs', icon: Users, platform: 'eaisybill' },
  { key: 'fixed_assets', label: 'TENY', icon: Package2, platform: 'eaisybill' },
  { key: 'shipments', label: 'Fuvarok', icon: Truck, platform: 'eaisybill' },
  { key: 'annual_reports', label: 'Beszámoló', icon: FileSpreadsheet, platform: 'eaisybill' },
  { key: 'uploads', label: 'Feldolgozások', icon: Upload, platform: 'eaisybill' },
  { key: 'app_error_logs', label: 'App hibák', icon: AlertCircle, platform: 'eaisybill' },
  // ── eaisyBooks ──
  { key: 'accounty_assignments', label: 'Portfólió', icon: Briefcase, platform: 'eaisybooks' },
  { key: 'accounty_tax_profiles', label: 'Adó profil', icon: Scale, platform: 'eaisybooks' },
  { key: 'accounty_missing_items', label: 'Hiányzó dok.', icon: ClipboardList, platform: 'eaisybooks' },
  { key: 'accounty_deadlines', label: 'Határidők', icon: CalendarClock, platform: 'eaisybooks' },
  { key: 'accounty_employees', label: 'Alkalmazottak', icon: HardHat, platform: 'eaisybooks' },
  { key: 'accounty_payroll_cycles', label: 'Bérszámfejtés', icon: Coins, platform: 'eaisybooks' },
  { key: 'accounty_filings', label: 'Bevallások', icon: ScrollText, platform: 'eaisybooks' },
  { key: 'accounty_tao_yearly', label: 'TAO', icon: Landmark, platform: 'eaisybooks' },
  { key: 'accounty_audit_log', label: 'Audit napló', icon: ShieldCheck, platform: 'eaisybooks' },
  { key: 'accounty_documents', label: 'Dokumentumok', icon: FileText, platform: 'eaisybooks' },
  { key: 'accounty_templates', label: 'Sablonok', icon: FileSpreadsheet, platform: 'eaisybooks' },
  { key: 'accounty_job_codes', label: 'Jogviszonyok', icon: BookOpen, platform: 'eaisybooks' },
  { key: 'accounty_legal_updates', label: 'Jogszabályok', icon: Gavel, platform: 'eaisybooks' },
];

export const MODULE_COLUMNS: Record<SuperadminModuleKey, string[]> = {
  // eaisybill
  invoices: ['kibocsatas_datuma', 'bizonylatsorszam', 'elado_nev', 'adoalap_osszesen', 'brutto_vegosszeg', 'invoice_type', 'invoice_direction', 'statusz'],
  nav_invoices: ['invoice_issue_date', 'invoice_number', 'supplier_name', 'invoice_net_amount', 'invoice_gross_amount'],
  transactions: ['transaction_date', 'amount', 'currency', 'description', 'type', 'match_type'],
  gl_journal_entries: ['voucher_date', 'voucher_number', 'debit_account', 'credit_account', 'amount', 'partner_name'],
  salary: ['dátum', 'név', 'összeg', 'statusz', 'tipus'],
  petty_cash_entries: ['entry_date', 'description', 'amount', 'currency', 'source_type'],
  categories: ['name', 'icon', 'color', 'created_at'],
  projects: ['name', 'project_code', 'project_type', 'client_name', 'status', 'budget', 'start_date', 'end_date'],
  partners: ['name', 'tax_number', 'partner_type', 'email', 'address'],
  fixed_assets: ['name', 'inventory_number', 'acquisition_value', 'purchase_date', 'status', 'depreciation_method'],
  shipments: ['position_number', 'pickup_date', 'delivery_date', 'carrier_name', 'calculated_amount_huf', 'match_status'],
  annual_reports: ['status', 'created_at', 'updated_at'],
  uploads: ['created_at', 'file_name', 'upload_type', 'processing_status', 'error_message'],
  app_error_logs: ['created_at', 'component', 'error_type', 'message', 'severity'],
  // eaisyBooks
  accounty_assignments: ['role', 'kanban_status', 'is_primary', 'is_main_accountant', 'assigned_at'],
  accounty_tax_profiles: ['vat_frequency', 'contribution_frequency', 'is_kata', 'is_kiva', 'tax_group', 'has_payroll'],
  accounty_missing_items: ['created_at', 'category', 'title', 'status', 'amount', 'item_date'],
  accounty_deadlines: ['due_date', 'deadline_type', 'title', 'status', 'notes'],
  accounty_employees: ['last_name', 'first_name', 'tax_id', 'birth_date', 'status'],
  accounty_payroll_cycles: ['year', 'month', 'status', 'current_step', 'created_at'],
  accounty_filings: ['filing_type', 'period_year', 'period_month', 'status', 'channel', 'submitted_at'],
  accounty_tao_yearly: ['tax_year', 'status', 'revenue', 'tax_base', 'calculated_tax', 'payable_tax'],
  accounty_audit_log: ['created_at', 'user_name', 'action', 'entity_type', 'details'],
  accounty_documents: ['title', 'doc_type', 'status', 'period', 'created_at'],
  accounty_templates: ['name', 'category', 'is_active', 'version', 'updated_at'],
  accounty_job_codes: ['code', 'name', 'is_insured', 'valid_from', 'is_active'],
  accounty_legal_updates: ['title', 'source', 'published_at', 'implementation_status'],
};

export const COL_LABELS: Record<string, string> = {
  // invoices (Hungarian column names)
  kibocsatas_datuma: 'Kelt', bizonylatsorszam: 'Bizonylat', elado_nev: 'Eladó',
  adoalap_osszesen: 'Nettó', brutto_vegosszeg: 'Bruttó', invoice_type: 'Típus',
  invoice_direction: 'Irány', statusz: 'Státusz', letrehozva: 'Létrehozva',
  // nav_invoices
  invoice_issue_date: 'Kiállítva', invoice_number: 'Számlasz.', supplier_name: 'Szállító',
  invoice_net_amount: 'Nettó', invoice_gross_amount: 'Bruttó', invoice_vat_amount: 'ÁFA',
  // transactions
  transaction_date: 'Dátum', amount: 'Összeg', currency: 'Deviza',
  description: 'Leírás', type: 'Típus', match_type: 'Párosítás',
  // gl_journal_entries
  voucher_date: 'Dátum', voucher_number: 'Bizonylat',
  debit_account: 'Tartozik szla', credit_account: 'Követel szla', partner_name: 'Partner',
  // salary (Hungarian)
  'dátum': 'Időszak', 'név': 'Alkalmazott', 'összeg': 'Összeg', tipus: 'Típus',
  // petty_cash_entries
  entry_date: 'Dátum', source_type: 'Forrás típusa',
  // categories / projects / partners
  name: 'Név', icon: 'Ikon', color: 'Szín',
  project_code: 'Kód', project_type: 'Típus', client_name: 'Ügyfél', budget: 'Költségkeret',
  start_date: 'Kezdés', end_date: 'Vég',
  tax_number: 'Adószám', partner_type: 'Partner típus', email: 'Email', address: 'Cím',
  // fixed_assets
  inventory_number: 'Leltári szám', acquisition_value: 'Bekerülési érték',
  purchase_date: 'Vásárlás', depreciation_method: 'Leírási mód',
  // shipments
  position_number: 'Pozíció', pickup_date: 'Felvétel', delivery_date: 'Kiszállítás',
  carrier_name: 'Fuvarozó', calculated_amount_huf: 'Összeg (HUF)',
  // uploads / errors
  created_at: 'Létrehozva', file_name: 'Fájlnév', upload_type: 'Feltöltés típusa',
  processing_status: 'Státusz', error_message: 'Hiba',
  updated_at: 'Módosítva',
  // app_error_logs
  component: 'Komponens', error_type: 'Hiba típus', message: 'Üzenetek', severity: 'Súlyosság', action: 'Akció',
  // eaisyBooks common
  category: 'Kategória', title: 'Megnevezés', status: 'Státusz', resolved_at: 'Megoldva',
  item_date: 'Dátum',
  due_date: 'Határidő', deadline_type: 'Típus', notes: 'Megjegyzés',
  first_name: 'Keresztnév', last_name: 'Vezetéknév', tax_id: 'Adóazonosító', birth_date: 'Születési dátum',
  year: 'Év', month: 'Hónap', current_step: 'Lépés',
  // accounty_assignments
  role: 'Szerep', kanban_status: 'Kanban', is_primary: 'Elsődleges', is_main_accountant: 'Fő könyvelő', assigned_at: 'Hozzárendelve',
  // accounty_tax_profiles
  vat_frequency: 'ÁFA gyakoriság', contribution_frequency: 'Járulék gyak.', is_kata: 'KATA', is_kiva: 'KIVA', tax_group: 'Adócsoport', has_payroll: 'Bérszámf.',
  nav_synced: 'NAV szinkr.',
  // accounty_filings
  filing_type: 'Bevallás típus', period_year: 'Év', period_month: 'Hónap', channel: 'Csatorna', submitted_at: 'Beküldve',
  // accounty_tao
  tax_year: 'Adóév', revenue: 'Árbevétel', tax_base: 'Adóalap', calculated_tax: 'Számított adó', payable_tax: 'Fizetendő adó', filing_status: 'Beadás státusz',
  // accounty_audit
  user_name: 'Felhasználó', entity_type: 'Entitás', details: 'Részletek',
  // accounty_documents
  doc_type: 'Dok. típus', period: 'Időszak',
  // accounty_templates
  is_active: 'Aktív', version: 'Verzió',
  // accounty_job_codes
  code: 'Kód', is_insured: 'Biztosított', valid_from: 'Érvényes',
  // accounty_legal_updates
  source: 'Forrás', published_at: 'Közzétéve', implementation_status: 'Implementáció', affected_modules: 'Érintett modulok',
};

export const STATUS_KEYS = new Set(['processing_status', 'sync_status', 'matching_status', 'status']);
