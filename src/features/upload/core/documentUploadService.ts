import { supabase } from '@/integrations/supabase/client';
import { reportError } from '@/lib/errorReporter';
import { handleRateLimitError } from '@/lib/supabaseErrors';
import type { ChannelConfig, UploadBatchOptions, UploadHistoryRecord, UploadTargetTable } from '../types';

/**
 * Validates whether a file matches the channel's allowed MIME types or extensions.
 */
export function validateFileType(file: File, config: ChannelConfig): boolean {
  if (config.allowedMimeTypes.includes(file.type)) {
    return true;
  }

  const fileNameLower = file.name.toLowerCase();
  return config.allowedExtensions.some(ext => fileNameLower.endsWith(ext.toLowerCase()));
}

/**
 * Checks for existing files with matching names in the target table for this company.
 * Returns an array of duplicate file names.
 */
export async function checkDatabaseDuplicates(
  fileNames: string[],
  targetTable: UploadTargetTable,
  companyId: string
): Promise<string[]> {
  if (!companyId || fileNames.length === 0) return [];

  // Check all relevant statuses (P1 dedup guard - ADR A-023)
  const { data, error } = await supabase
    .from(targetTable)
    .select('file_name')
    .eq('company_id', companyId)
    .in('file_name', fileNames)
    .eq('upload_status', 'uploaded')
    .in('processing_status', [
      'processed', 'pending', 'processing', 'ignored', 'completed', 'webhook_sent'
    ]);

  if (error || !data) {
    return [];
  }

  const foundSet = new Set(data.map((row: any) => row.file_name));
  return fileNames.filter(name => foundSet.has(name));
}

/**
 * Uploads a single file to Supabase Storage.
 */
export async function uploadSingleFileToStorage(
  file: File,
  bucket: string,
  folder: string,
  userId: string
): Promise<{ fileUrl: string; storagePath: string }> {
  if (!userId) throw new Error('User not authenticated');

  const fileExt = file.name.split('.').pop() || '';
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');

  let filePath: string;
  if (bucket === 'invoice-uploads') {
    // Standard invoice uploads naming
    filePath = `${userId}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
  } else if (folder) {
    filePath = `${folder}/${userId}/${Date.now()}-${sanitizedName}`;
  } else {
    filePath = `${userId}/${Date.now()}-${sanitizedName}`;
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filePath, file);

  if (error) {
    reportError({
      type: 'upload',
      component: 'DocumentUploadService',
      action: 'error',
      message: `Storage upload error in bucket ${bucket}:`,
      error,
    });
    throw new Error(`Fájl feltöltési hiba (${file.name}): ${error.message}`);
  }

  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(data.path);

  return {
    fileUrl: urlData.publicUrl,
    storagePath: data.path,
  };
}

/**
 * Executes a full batch upload for a channel:
 * 1. Storage uploads
 * 2. Database batch insert with multi-tenancy & metadata (ADR A-023 bypass flags)
 * 3. Rollback cleanup on database failure
 */
export async function executeBatchUpload(
  options: UploadBatchOptions,
  config: ChannelConfig
): Promise<UploadHistoryRecord[]> {
  const { files, userId, companyId, bankHint, reportType, reuploadFileNames } = options;

  if (files.length === 0) return [];

  const storageResults: { file: File; fileUrl: string; storagePath: string }[] = [];

  try {
    // Phase 1: Upload files to Storage
    for (const file of files) {
      const res = await uploadSingleFileToStorage(file, config.storageBucket, config.storageFolder, userId);
      storageResults.push({
        file,
        fileUrl: res.fileUrl,
        storagePath: res.storagePath,
      });
    }

    // Phase 2: Construct batch insert rows
    const insertRows = storageResults.map(r => {
      const isReupload = reuploadFileNames ? reuploadFileNames.has(r.file.name) : false;
      const metadata: Record<string, any> = {
        ...(config.defaultMetadata || {}),
        ...(isReupload ? { source: 'manual_reupload' } : {}),
      };

      const row: Record<string, any> = {
        user_id: userId,
        company_id: companyId,
        file_name: r.file.name,
        file_url: r.fileUrl,
        file_size: r.file.size,
        file_type: r.file.type,
        upload_status: 'uploaded',
        processing_status: 'pending',
      };

      if (Object.keys(metadata).length > 0) {
        row.metadata = metadata;
      }

      if (config.hasBankHintSelector && bankHint && bankHint !== 'auto') {
        row.bank_hint = bankHint;
      }

      if (config.hasCourierSelector && reportType) {
        row.report_type = reportType;
      }

      return row;
    });

    // Phase 3: DB Batch Insert
    const { data: insertedRecords, error: dbError } = await (supabase
      .from(config.targetTable) as any)
      .insert(insertRows)
      .select();

    if (dbError) {
      if (handleRateLimitError(dbError)) {
        throw new Error('Rate limit exceeded');
      }
      // Rollback uploaded storage files on DB insert failure
      const pathsToRemove = storageResults.map(r => r.storagePath);
      await supabase.storage.from(config.storageBucket).remove(pathsToRemove);
      throw dbError;
    }

    return (insertedRecords || []).map((rec: any) => ({
      id: rec.id,
      file_name: rec.file_name,
      file_size: rec.file_size,
      file_type: rec.file_type,
      file_url: rec.file_url,
      user_id: rec.user_id,
      upload_status: rec.upload_status,
      processing_status: rec.processing_status,
      created_at: rec.created_at || new Date().toISOString(),
      error_message: rec.error_message || null,
    }));
  } catch (err: any) {
    reportError({
      type: 'upload',
      component: 'DocumentUploadService',
      action: 'error',
      message: `Batch upload failed for channel ${config.id}:`,
      error: err,
    });
    throw err;
  }
}
