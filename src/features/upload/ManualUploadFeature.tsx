import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEaisybillPermissions } from '@/hooks/useEaisybillPermissions';
import { useUrlTab } from '@/lib/navigation';
import { UploadHeader } from './components/header/UploadHeader';
import { UploadChannelTab } from './components/channel/UploadChannelTab';
import { UploadDialogManager } from './components/dialogs/UploadDialogManager';
import { useDocumentUpload } from './hooks/useDocumentUpload';
import { CHANNEL_CONFIGS } from './config/channelConfigs';
import UploadedFilesModal from '@/components/UploadedFilesModal';
import UploadHistory from '@/components/UploadHistory';
import type { UploadChannelId } from './types';

const UPLOAD_TAB_SLUGS = [
  'invoices',
  'vouchers',
  'bank',
  'salaries',
  'transactions',
  'reports',
] as const;

export function ManualUploadFeature() {
  const { canWrite: canWriteModule } = useEaisybillPermissions();
  const writable = canWriteModule('upload');

  // URL-synced tab state
  const [activeTab, setActiveTab] = useUrlTab(
    'upload',
    'invoices' as UploadChannelId,
    UPLOAD_TAB_SLUGS
  );

  const [filesModalOpen, setFilesModalOpen] = useState(false);

  // Independent state per channel to preserve staged files across tab switches
  const invoiceUpload = useDocumentUpload('invoices');
  const voucherUpload = useDocumentUpload('vouchers');
  const bankUpload = useDocumentUpload('bank');
  const salaryUpload = useDocumentUpload('salaries');
  const transactionUpload = useDocumentUpload('transactions');
  const reportUpload = useDocumentUpload('reports');

  const channelStates: Record<UploadChannelId, ReturnType<typeof useDocumentUpload>> = {
    invoices: invoiceUpload,
    vouchers: voucherUpload,
    bank: bankUpload,
    salaries: salaryUpload,
    transactions: transactionUpload,
    reports: reportUpload,
  };

  const currentChannel = (activeTab as UploadChannelId) || 'invoices';
  const activeUploadState = channelStates[currentChannel] || invoiceUpload;

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <UploadHeader onOpenFilesModal={() => setFilesModalOpen(true)} />

      {/* Channel Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as UploadChannelId)}
        className="space-y-6"
      >
        <TabsList className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1 h-auto p-1 bg-muted/60">
          {(Object.keys(CHANNEL_CONFIGS) as UploadChannelId[]).map((channelId) => {
            const cfg = CHANNEL_CONFIGS[channelId];
            const state = channelStates[channelId];
            const fileCount = state.selectedFiles.length;
            const Icon = cfg.icon;

            return (
              <TabsTrigger
                key={channelId}
                value={channelId}
                className="flex items-center gap-1.5 py-2 px-2.5 text-xs sm:text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{cfg.title}</span>
                {fileCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-primary text-primary-foreground leading-tight">
                    {fileCount}
                  </span>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="invoices" className="mt-0 focus-visible:outline-none">
          <UploadChannelTab uploadState={invoiceUpload} writable={writable} />
        </TabsContent>

        <TabsContent value="vouchers" className="mt-0 focus-visible:outline-none">
          <UploadChannelTab uploadState={voucherUpload} writable={writable} />
        </TabsContent>

        <TabsContent value="bank" className="mt-0 focus-visible:outline-none">
          <UploadChannelTab uploadState={bankUpload} writable={writable} />
        </TabsContent>

        <TabsContent value="salaries" className="mt-0 focus-visible:outline-none">
          <UploadChannelTab uploadState={salaryUpload} writable={writable} />
        </TabsContent>

        <TabsContent value="transactions" className="mt-0 focus-visible:outline-none">
          <UploadChannelTab uploadState={transactionUpload} writable={writable} />
        </TabsContent>

        <TabsContent value="reports" className="mt-0 focus-visible:outline-none">
          <UploadChannelTab uploadState={reportUpload} writable={writable} />
        </TabsContent>
      </Tabs>

      {/* Upload History Table */}
      <UploadHistory activeTab={activeTab} />

      {/* Centralized Upload Dialog Manager */}
      <UploadDialogManager activeUploadState={activeUploadState} />

      {/* Processed Files Modal */}
      <UploadedFilesModal
        open={filesModalOpen}
        onOpenChange={setFilesModalOpen}
        activeTab={activeTab as any}
      />
    </div>
  );
}
