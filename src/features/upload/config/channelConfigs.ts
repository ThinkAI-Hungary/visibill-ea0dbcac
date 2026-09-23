import { FileText, Coins, Landmark, Wallet, CreditCard, Package } from 'lucide-react';
import type { UploadChannelId, ChannelConfig } from '../types';
import i18n from '@/lib/i18n';

export const CHANNEL_CONFIGS: Record<UploadChannelId, ChannelConfig> = {
  invoices: {
    id: 'invoices',
    title: 'Számlák',
    cardTitle: 'Számlafájlok feltöltése',
    cardDescription: 'Válassz PDF vagy kép fájlokat, amelyek számlákat tartalmaznak. A rendszer automatikusan kinyeri az adatokat és rögzíti a számlákat.',
    icon: FileText,
    targetTable: 'invoice_uploads',
    storageBucket: 'invoice-uploads',
    storageFolder: '',
    notificationType: 'invoice',
    allowedExtensions: ['.pdf', '.jpg', '.jpeg', '.png', '.webp'],
    allowedMimeTypes: [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
    ],
    fileTypeDescription: 'PDF vagy kép fájlokat (JPG, PNG, WebP)',
    dragPrompt: 'Húzd ide a számlafájlokat, vagy kattints a tallózáshoz',
    actionButtonLabel: (count: number) =>
      i18n.t('upload:channels_config.invoices.action_button', {
        count,
        defaultValue: `${count} számlafájl feltöltése`,
      }),
    documentCategory: 'invoice',
  },
  vouchers: {
    id: 'vouchers',
    title: 'Pénztárbizonylat',
    cardTitle: 'Pénztárbizonylat fájlok feltöltése',
    cardDescription: 'Válassz PDF vagy kép fájlokat, amelyek kiadási vagy bevételi pénztárbizonylatokat tartalmaznak. Támogatott formátumok: PDF, JPG, PNG, WebP',
    icon: Coins,
    targetTable: 'invoice_uploads',
    storageBucket: 'invoice-uploads',
    storageFolder: '',
    notificationType: 'invoice',
    allowedExtensions: ['.pdf', '.jpg', '.jpeg', '.png', '.webp'],
    allowedMimeTypes: [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
    ],
    fileTypeDescription: 'PDF vagy kép fájlokat (JPG, PNG, WebP)',
    dragPrompt: 'Húzd ide a pénztárbizonylat fájlokat, vagy kattints a tallózáshoz',
    actionButtonLabel: (count: number) =>
      i18n.t('upload:channels_config.vouchers.action_button', {
        count,
        defaultValue: `${count} pénztárbizonylat feltöltése`,
      }),
    documentCategory: 'penztarbizonylat',
    defaultMetadata: {
      source: 'manual_voucher_upload',
      document_type: 'cash_voucher',
    },
  },
  transactions: {
    id: 'transactions',
    title: 'Tranzakciók',
    cardTitle: 'Tranzakciós fájlok feltöltése',
    cardDescription: 'Válassz PDF, CSV vagy Excel fájlokat, amelyek banki vagy egyéb pénzügyi tranzakciókat tartalmaznak. A rendszer automatikusan kinyeri az adatokat és rögzíti a tranzakciókat.',
    icon: CreditCard,
    targetTable: 'transaction_uploads',
    storageBucket: 'transactions',
    storageFolder: '',
    notificationType: 'transaction',
    allowedExtensions: ['.pdf', '.csv', '.xls', '.xlsx'],
    allowedMimeTypes: [
      'application/pdf',
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
    fileTypeDescription: 'PDF, CSV vagy Excel (XLS, XLSX) fájlokat',
    dragPrompt: 'Húzd ide a tranzakciós fájlokat, vagy kattints a tallózáshoz',
    actionButtonLabel: (count: number) =>
      i18n.t('upload:channels_config.transactions.action_button', {
        count,
        defaultValue: `${count} tranzakciós fájl feltöltése`,
      }),
    hasBankHintSelector: true,
  },
  salaries: {
    id: 'salaries',
    title: 'Bérek & Járulékok',
    cardTitle: 'Bérek és járulékok feltöltése',
    cardDescription: 'Tölts fel bérlistát, bérszámfejtési összesítőt, járulékbevallást vagy NAV határozatot PDF, CSV vagy Excel formátumban. A rendszer automatikusan feldolgozza és kategóriába rendezi.',
    icon: Wallet,
    targetTable: 'invoice_uploads',
    storageBucket: 'invoice-uploads',
    storageFolder: '',
    notificationType: 'salary',
    allowedExtensions: ['.pdf', '.csv', '.xls', '.xlsx'],
    allowedMimeTypes: [
      'application/pdf',
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
    fileTypeDescription: 'PDF, CSV vagy Excel fájlokat',
    dragPrompt: 'Húzd ide a bér- vagy járulékfájlokat, vagy kattints a tallózáshoz',
    actionButtonLabel: (count: number) =>
      i18n.t('upload:channels_config.salaries.action_button', {
        count,
        defaultValue: `${count} bérfájl feltöltése`,
      }),
    documentCategory: 'payroll',
    defaultMetadata: {
      source: 'manual_salary_upload',
      document_type: 'payroll_report',
    },
  },
  reports: {
    id: 'reports',
    title: 'Futár riportok',
    cardTitle: 'Futár riportok feltöltése',
    cardDescription: 'Válassz futár riport fájlokat (GLS, MPL, Mixpack). A rendszer automatikusan párosítja a csomagokat a kiállított számlákkal.',
    icon: Package,
    targetTable: 'report_uploads',
    storageBucket: 'report-uploads',
    storageFolder: '',
    notificationType: 'report',
    allowedExtensions: ['.xls', '.xlsx', '.csv', '.pdf', '.doc', '.docx'],
    allowedMimeTypes: [
      'application/pdf',
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    fileTypeDescription: 'XLS, XLSX, CSV, PDF vagy DOCX fájlokat',
    dragPrompt: 'Húzd ide a futár riportokat, vagy kattints a tallózáshoz',
    actionButtonLabel: (count: number) =>
      i18n.t('upload:channels_config.reports.action_button', {
        count,
        defaultValue: `${count} riportfájl feltöltése`,
      }),
    hasCourierSelector: true,
  },
};

export interface BankHintOption {
  value: string;
  label: string;
  group: 'auto' | 'hungary' | 'fintech' | 'other';
  hint?: string;
}

export const BANK_HINT_OPTIONS: BankHintOption[] = [
  { value: 'auto', label: 'Automatikus felismerés', group: 'auto', hint: '(fájlnév alapján)' },
  { value: 'otp', label: 'OTP Bank', group: 'hungary' },
  { value: 'erste', label: 'Erste Bank', group: 'hungary' },
  { value: 'kh', label: 'K&H Bank', group: 'hungary' },
  { value: 'raiffeisen', label: 'Raiffeisen Bank', group: 'hungary' },
  { value: 'mbh', label: 'MBH Bank', group: 'hungary' },
  { value: 'cib', label: 'CIB Bank', group: 'hungary' },
  { value: 'unicredit', label: 'UniCredit Bank', group: 'hungary' },
  { value: 'granit', label: 'Gránit Bank', group: 'hungary' },
  { value: 'magnet', label: 'MagNet Bank', group: 'hungary' },
  { value: 'revolut', label: 'Revolut', group: 'fintech' },
  { value: 'wise', label: 'Wise', group: 'fintech' },
  { value: 'szep', label: 'SZÉP Kártya', group: 'other', hint: '(elfogadóhelyi)' },
  { value: 'zaba', label: 'Zagrebačka banka (ZABA)', group: 'other' },
  { value: 'minimax', label: 'Minimax / e-racuni', group: 'other' },
];

export const COURIER_OPTIONS = [
  { value: 'gls', label: 'GLS Hungary' },
  { value: 'mpl', label: 'Magyar Posta (MPL)' },
  { value: 'mixpack', label: 'Mixpack' },
];
