import type { LucideIcon } from 'lucide-react';

export type UploadChannelId = 'invoices' | 'vouchers' | 'bank' | 'salaries' | 'transactions' | 'reports';

export type UploadTargetTable = 'invoice_uploads' | 'transaction_uploads' | 'bank_statement_uploads' | 'report_uploads';

export type CourierReportType = 'gls' | 'mpl' | 'mixpack';

export type UploadNotificationType = 'invoice' | 'bank' | 'salary' | 'transaction' | 'report';

export interface ChannelConfig {
  id: UploadChannelId;
  title: string;
  cardTitle: string;
  cardDescription: string;
  icon: LucideIcon;
  targetTable: UploadTargetTable;
  storageBucket: string;
  storageFolder: string;
  notificationType: UploadNotificationType;
  allowedExtensions: string[];
  allowedMimeTypes: string[];
  fileTypeDescription: string;
  dragPrompt: string;
  actionButtonLabel: (count: number) => string;
  hasBankHintSelector?: boolean;
  hasCourierSelector?: boolean;
  defaultMetadata?: Record<string, any>;
}

export interface SelectedFileItem {
  file: File;
  reportType?: CourierReportType;
}

export interface UploadBatchOptions {
  channelId: UploadChannelId;
  files: File[];
  userId: string;
  companyId: string;
  bankHint?: string;
  reportType?: CourierReportType;
  reuploadFileNames?: Set<string> | null;
}

export interface UploadHistoryRecord {
  id: string;
  file_name: string;
  file_size: number;
  file_type: string;
  file_url: string;
  user_id: string;
  upload_status: string;
  processing_status: string;
  created_at: string;
  error_message: string | null;
}
