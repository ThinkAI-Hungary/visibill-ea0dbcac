import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { UploadDropzone } from '../dropzone/UploadDropzone';
import { UploadFileList } from '../file-list/UploadFileList';
import { BankHintSelector } from './BankHintSelector';
import { CourierTypeSelector } from './CourierTypeSelector';
import type { useDocumentUpload } from '../../hooks/useDocumentUpload';

interface UploadChannelTabProps {
  uploadState: ReturnType<typeof useDocumentUpload>;
  writable: boolean;
}

export function UploadChannelTab({ uploadState, writable }: UploadChannelTabProps) {
  const { config } = uploadState;
  const Icon = config.icon;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-primary" />
          {config.cardTitle}
        </CardTitle>
        <CardDescription>
          {config.cardDescription}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Optional Extra Selectors */}
        {config.hasBankHintSelector && (
          <BankHintSelector
            value={uploadState.selectedBankHint}
            onChange={uploadState.setSelectedBankHint}
            disabled={uploadState.uploading || !writable}
          />
        )}

        {config.hasCourierSelector && (
          <CourierTypeSelector
            value={uploadState.selectedReportType}
            onChange={uploadState.setSelectedReportType}
            disabled={uploadState.uploading || !writable}
          />
        )}

        {/* Drag and Drop Zone */}
        <UploadDropzone
          config={config}
          dragOver={uploadState.dragOver}
          setDragOver={uploadState.setDragOver}
          onFilesAdded={uploadState.handleFilesAdded}
          writable={writable}
        />

        {/* Selected Files Staging List & Upload Button */}
        <UploadFileList
          files={uploadState.selectedFiles}
          config={config}
          uploading={uploadState.uploading}
          writable={writable}
          onRemoveFile={uploadState.removeFile}
          onClearFiles={uploadState.clearFiles}
          onStartUpload={uploadState.startUpload}
        />
      </CardContent>
    </Card>
  );
}
