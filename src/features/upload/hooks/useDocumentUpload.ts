import { useState, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { registerPendingUpload } from '@/components/LiveNotificationProvider';
import { CHANNEL_CONFIGS } from '../config/channelConfigs';
import {
  validateFileType,
  checkDatabaseDuplicates,
  executeBatchUpload,
} from '../core/documentUploadService';
import {
  addRecordsToUploadHistoryCache,
  triggerDelayedUploadHistoryInvalidation,
} from '../core/uploadCacheSync';
import type {
  UploadChannelId,
  SelectedFileItem,
  CourierReportType,
} from '../types';

export function useDocumentUpload(channelId: UploadChannelId) {
  const config = CHANNEL_CONFIGS[channelId];
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Selected files in the staging area
  const [selectedFiles, setSelectedFiles] = useState<SelectedFileItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Channel-specific options
  const [selectedBankHint, setSelectedBankHint] = useState<string>('auto');
  const [selectedReportType, setSelectedReportType] = useState<CourierReportType>('gls');

  // Synchronous mutex to prevent rapid multi-click duplicates (ADR A-023 P0)
  const uploadMutexRef = useRef(false);

  // DB-level duplicate dialog state
  const [dbDuplicateDialogOpen, setDbDuplicateDialogOpen] = useState(false);
  const [dbDuplicateFileNames, setDbDuplicateFileNames] = useState<string[]>([]);
  const [selectedDbDuplicates, setSelectedDbDuplicates] = useState<Set<string>>(new Set());
  const pendingDbUploadCallbackRef = useRef<((reuploadNames: Set<string>) => void) | null>(null);

  // List-level duplicate dialog state (file already in pending list)
  const [listDuplicateDialogOpen, setListDuplicateDialogOpen] = useState(false);
  const [listDuplicateFileNames, setListDuplicateFileNames] = useState<string[]>([]);
  const pendingListAddRef = useRef<{ skipDupes: () => void; addAll: () => void } | null>(null);

  /**
   * Adds newly selected or dropped files into the staging list with type validation
   * and in-memory duplicate detection.
   */
  const handleFilesAdded = useCallback((incomingFiles: File[]) => {
    if (!incomingFiles || incomingFiles.length === 0) return;

    const validFiles = incomingFiles.filter(file => {
      const isValid = validateFileType(file, config);
      if (!isValid) {
        toast({
          variant: 'destructive',
          title: 'Érvénytelen fájltípus',
          description: `${file.name} nem támogatott fájltípus. Kérlek ${config.fileTypeDescription} tölts fel.`,
        });
      }
      return isValid;
    });

    if (validFiles.length === 0) return;

    setSelectedFiles(prev => {
      const existingNames = new Set(prev.map(item => item.file.name));
      const newFiles = validFiles.filter(f => !existingNames.has(f.name));
      const dupeFiles = validFiles.filter(f => existingNames.has(f.name));

      if (dupeFiles.length > 0) {
        setListDuplicateFileNames(dupeFiles.map(f => f.name));
        pendingListAddRef.current = {
          skipDupes: () => {
            setSelectedFiles(curr => [
              ...curr,
              ...newFiles.map(f => ({ file: f, reportType: selectedReportType })),
            ]);
            setListDuplicateDialogOpen(false);
          },
          addAll: () => {
            setSelectedFiles(curr => [
              ...curr,
              ...validFiles.map(f => ({ file: f, reportType: selectedReportType })),
            ]);
            setListDuplicateDialogOpen(false);
          },
        };
        setListDuplicateDialogOpen(true);
        return prev;
      }

      return [
        ...prev,
        ...newFiles.map(f => ({ file: f, reportType: selectedReportType })),
      ];
    });
  }, [config, selectedReportType, toast]);

  const removeFile = useCallback((index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const clearFiles = useCallback(() => {
    setSelectedFiles([]);
  }, []);

  /**
   * Internal execution of the batch upload once validation and duplicate checks pass.
   */
  const executeUpload = useCallback(async (reuploadFileNames: Set<string> | null = null, allDuplicates: string[] = []) => {
    if (!user || !selectedCompany?.id) return;

    const dupeSet = reuploadFileNames ? new Set(allDuplicates) : null;
    const filesToProcess = dupeSet
      ? selectedFiles.filter(item => !dupeSet.has(item.file.name) || reuploadFileNames!.has(item.file.name))
      : selectedFiles;

    if (filesToProcess.length === 0) {
      toast({
        title: 'Nincs feltöltendő fájl',
        description: 'Minden fájl ki lett hagyva.',
      });
      return;
    }

    if (uploadMutexRef.current) return;
    uploadMutexRef.current = true;
    setUploading(true);

    const processingToast = toast({
      title: 'Feldolgozás...',
      description: `${config.title} feltöltése folyamatban...`,
    });

    try {
      const records = await executeBatchUpload(
        {
          channelId,
          files: filesToProcess.map(item => item.file),
          userId: user.id,
          companyId: selectedCompany.id,
          bankHint: selectedBankHint,
          reportType: selectedReportType,
          reuploadFileNames,
        },
        config
      );

      // Register live notifications for worker tracking
      for (const rec of records) {
        registerPendingUpload(rec.id, config.notificationType);
      }

      // Optimistically update upload history cache
      addRecordsToUploadHistoryCache(queryClient, records);
      triggerDelayedUploadHistoryInvalidation(queryClient);

      // Clear staged files on success
      setSelectedFiles([]);

      processingToast.dismiss();
      toast({
        title: 'Sikeres feltöltés',
        description: `${records.length} fájl sikeresen feltöltve. A feldolgozás a háttérben megkezdődött.`,
      });
    } catch (err: any) {
      processingToast.dismiss();
      toast({
        variant: 'destructive',
        title: 'Feltöltési hiba',
        description: err?.message || 'Hiba történt a fájlok feltöltése során.',
      });
    } finally {
      uploadMutexRef.current = false;
      setUploading(false);
    }
  }, [user, selectedCompany, selectedFiles, channelId, config, selectedBankHint, selectedReportType, toast, queryClient]);

  /**
   * Public entrypoint when user clicks the upload button.
   */
  const startUpload = useCallback(async () => {
    if (selectedFiles.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Nincs kiválasztott fájl',
        description: 'Kérlek válassz ki legalább egy fájlt a feltöltéshez.',
      });
      return;
    }

    if (!user) {
      toast({
        variant: 'destructive',
        title: 'Nem vagy bejelentkezve',
        description: 'A feltöltéshez be kell jelentkezned.',
      });
      return;
    }

    if (!selectedCompany?.id) {
      toast({
        variant: 'destructive',
        title: 'Nincs kiválasztott cég',
        description: 'A feltöltéshez válassz ki egy céget.',
      });
      return;
    }

    // Check for existing database duplicates
    const fileNames = selectedFiles.map(item => item.file.name);
    const duplicates = await checkDatabaseDuplicates(fileNames, config.targetTable, selectedCompany.id);

    if (duplicates.length > 0) {
      setDbDuplicateFileNames(duplicates);
      setSelectedDbDuplicates(new Set(duplicates));
      pendingDbUploadCallbackRef.current = (reuploadNames: Set<string>) => {
        setDbDuplicateDialogOpen(false);
        executeUpload(reuploadNames, duplicates);
      };
      setDbDuplicateDialogOpen(true);
      return;
    }

    executeUpload(null, []);
  }, [selectedFiles, user, selectedCompany, config, toast, executeUpload]);

  const confirmDbDuplicates = useCallback((reuploadNames: Set<string>) => {
    if (pendingDbUploadCallbackRef.current) {
      pendingDbUploadCallbackRef.current(reuploadNames);
    }
  }, []);

  const confirmListDuplicates = useCallback((action: 'skip' | 'addAll') => {
    if (pendingListAddRef.current) {
      if (action === 'skip') pendingListAddRef.current.skipDupes();
      else pendingListAddRef.current.addAll();
    }
  }, []);

  return {
    config,
    selectedFiles,
    dragOver,
    setDragOver,
    uploading,
    selectedBankHint,
    setSelectedBankHint,
    selectedReportType,
    setSelectedReportType,
    handleFilesAdded,
    removeFile,
    clearFiles,
    startUpload,

    // DB duplicate dialog
    dbDuplicateDialogOpen,
    setDbDuplicateDialogOpen,
    dbDuplicateFileNames,
    selectedDbDuplicates,
    setSelectedDbDuplicates,
    confirmDbDuplicates,

    // List duplicate dialog
    listDuplicateDialogOpen,
    setListDuplicateDialogOpen,
    listDuplicateFileNames,
    confirmListDuplicates,
  };
}
