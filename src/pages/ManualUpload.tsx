import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileText, X, Building2, CreditCard, Wallet, Info, Landmark } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useCompany } from '@/contexts/CompanyContext';
import SubscriptionUsage from '@/components/SubscriptionUsage';
import UploadHistory from '@/components/UploadHistory';

const ManualUpload = () => {
  const [selectedInvoiceFiles, setSelectedInvoiceFiles] = useState<File[]>([]);
  const [selectedBankFiles, setSelectedBankFiles] = useState<File[]>([]);
  const [selectedSalaryFiles, setSelectedSalaryFiles] = useState<File[]>([]);
  const [selectedTransactionFiles, setSelectedTransactionFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('invoices');
  const [uploadRefreshKey, setUploadRefreshKey] = useState(0);
  const { toast } = useToast();
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const { canProcessInvoice, incrementUsage, remainingInvoices } = useSubscription();
  const queryClient = useQueryClient();

  const delayedUploadHistoryInvalidation = useCallback(() => {
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['uploadHistory'] });
    }, 800);
  }, [queryClient]);

  const addToUploadHistoryCache = useCallback((newRecord: {
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
  }) => {
    queryClient.setQueriesData(
      { queryKey: ['uploadHistory'] },
      (old: any) => old ? { ...old, records: [newRecord, ...old.records] } : old
    );
  }, [queryClient]);

  const handleInvoiceFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);

    // Filter for common invoice file types
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp'
    ];

    const validFiles = files.filter(file => {
      if (allowedTypes.includes(file.type)) {
        return true;
      }
      toast({
        variant: "destructive",
        title: "Érvénytelen fájltípus",
        description: `${file.name} nem támogatott fájltípus. Kérlek tölts fel PDF vagy kép fájlokat.`
      });
      return false;
    });

    setSelectedInvoiceFiles(prev => [...prev, ...validFiles]);
  };

  const handleBankStatementFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);

    // Filter for bank statement file types (PDF, CSV, XLS/XLSX)
    const allowedTypes = [
      'application/pdf',
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    const validFiles = files.filter(file => {
      if (allowedTypes.includes(file.type)) {
        return true;
      }
      toast({
        variant: "destructive",
        title: "Érvénytelen fájltípus",
        description: `${file.name} nem támogatott fájltípus. Bankkivonatokhoz tölts fel PDF, CSV vagy Excel fájlokat.`
      });
      return false;
    });

    setSelectedBankFiles(prev => [...prev, ...validFiles]);
  };

  const removeInvoiceFile = (index: number) => {
    setSelectedInvoiceFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeBankFile = (index: number) => {
    setSelectedBankFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSalaryFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);

    // Filter for salary file types (PDF, CSV, XLS/XLSX)
    const allowedTypes = [
      'application/pdf',
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    const validFiles = files.filter(file => {
      if (allowedTypes.includes(file.type)) {
        return true;
      }
      toast({
        variant: "destructive",
        title: "Érvénytelen fájltípus",
        description: `${file.name} nem támogatott fájltípus. Bérekhez/járulékokhoz tölts fel PDF, CSV vagy Excel fájlokat.`
      });
      return false;
    });

    setSelectedSalaryFiles(prev => [...prev, ...validFiles]);
  };

  const removeSalaryFile = (index: number) => {
    setSelectedSalaryFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleTransactionFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);

    // Filter for transaction file types (PDF, CSV, XLS/XLSX)
    const allowedTypes = [
      'application/pdf',
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    const validFiles = files.filter(file => {
      if (allowedTypes.includes(file.type)) {
        return true;
      }
      toast({
        variant: "destructive",
        title: "Érvénytelen fájltípus",
        description: `${file.name} nem támogatott fájltípus. Tranzakciókhoz tölts fel PDF, CSV vagy Excel fájlokat.`
      });
      return false;
    });

    setSelectedTransactionFiles(prev => [...prev, ...validFiles]);
  };

  const removeTransactionFile = (index: number) => {
    setSelectedTransactionFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFileToStorage = async (file: File, bucket: string, folder: string) => {
    if (!user) throw new Error('User not authenticated');

    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `${Date.now()}-${sanitizedName}`;
    const filePath = `${folder}/${fileName}`;

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file);

    if (error) throw error;
    return data;
  };

  const uploadFileToInvoiceStorage = async (file: File, userId: string): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('invoice-uploads')
      .upload(fileName, file);

    if (error) {
      console.error('Storage upload error:', error);
      throw new Error(`Fájl feltöltési hiba: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('invoice-uploads')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  };

  const checkDuplicateFile = async (fileName: string, table: 'invoice_uploads' | 'transaction_uploads'): Promise<boolean> => {
    if (!selectedCompany?.id) return false;

    const { data } = await supabase
      .from(table)
      .select('id, file_name')
      .eq('company_id', selectedCompany.id)
      .eq('file_name', fileName)
      .eq('upload_status', 'uploaded')
      .eq('processing_status', 'completed')
      .limit(1);

    return (data && data.length > 0);
  };

  const handleInvoiceUpload = async () => {
    if (selectedInvoiceFiles.length === 0) {
      toast({
        variant: "destructive",
        title: "Nincs kiválasztott fájl",
        description: "Kérlek válassz ki legalább egy számlafájlt a feltöltéshez."
      });
      return;
    }

    // Check for duplicate files
    const duplicates: string[] = [];
    for (const file of selectedInvoiceFiles) {
      const isDuplicate = await checkDuplicateFile(file.name, 'invoice_uploads');
      if (isDuplicate) {
        duplicates.push(file.name);
      }
    }

    if (duplicates.length > 0) {
      toast({
        variant: "destructive",
        title: "Korábban már feltöltött fájl(ok)",
        description: `A következő fájl(ok) már sikeresen fel lettek töltve és feldolgozva: ${duplicates.join(', ')}`
      });
      return;
    }

    // Check if user can process invoices
    if (!canProcessInvoice()) {
      toast({
        variant: "destructive",
        title: "Elérted a számlafeldolgozási limitet",
        description: "Frissítsd csomagodat vagy várj a következő billing ciklusig további számlák feldolgozásához."
      });
      return;
    }

    // Check if trying to upload more invoices than remaining limit
    if (selectedInvoiceFiles.length > remainingInvoices) {
      toast({
        variant: "destructive",
        title: "Túl sok számla",
        description: `Csak ${remainingInvoices} számlát tudsz még feldolgozni ebben a billing ciklusban.`
      });
      return;
    }

    setUploading(true);

    try {
      // Process each invoice and increment usage
      let successfulUploads = 0;
      const uploadedIds: { id: string; fileName: string }[] = [];

      for (const file of selectedInvoiceFiles) {
        // Check if we can still process this invoice
        if (!canProcessInvoice()) {
          toast({
            variant: "destructive",
            title: "Elérted a limitet",
            description: `${successfulUploads} számla sikeresen feltöltve, de elérted a havi limitet.`
          });
          break;
        }

        // Try to increment usage before processing
        const canIncrement = await incrementUsage();
        if (!canIncrement) {
          toast({
            variant: "destructive",
            title: "Nem sikerült a feldolgozás",
            description: `${successfulUploads} számla sikeresen feltöltve, de nem tudtunk több számlát feldolgozni.`
          });
          break;
        }

        try {
          // Upload file to storage
          const fileUrl = await uploadFileToInvoiceStorage(file, user?.id!);

          // Create upload record in database
          const { data: uploadRecord, error: uploadError } = await supabase
            .from('invoice_uploads')
            .insert({
              user_id: user?.id!,
              company_id: selectedCompany?.id || null,
              file_name: file.name,
              file_size: file.size,
              file_type: file.type,
              file_url: fileUrl,
              upload_status: 'uploaded',
              processing_status: 'pending'
            })
            .select()
            .single();

          if (uploadError) {
            console.error('Database insert error:', uploadError);
            throw new Error(`Adatbázis hiba: ${uploadError.message}`);
          }

          // Trigger N8N webhook processing (production only)
          try {
            const { error: webhookError } = await supabase.functions.invoke('trigger-invoice-processing', {
              body: {
                uploadId: uploadRecord.id,
                webhookUrl: 'https://n8n.thinkaikontir.hu/webhook/bd504dd3-8af8-45d6-90f6-cfc635a22da6'
              }
            });

            if (webhookError) {
              console.error('Webhook trigger error:', webhookError);
            }
          } catch (webhookError) {
            console.error('Failed to trigger processing webhook:', webhookError);
          }

          addToUploadHistoryCache({
            id: uploadRecord.id,
            file_name: file.name,
            file_size: file.size,
            file_type: file.type,
            file_url: fileUrl,
            user_id: user?.id!,
            upload_status: 'uploaded',
            processing_status: 'pending',
            created_at: new Date().toISOString(),
            error_message: null,
          });
          uploadedIds.push({ id: uploadRecord.id, fileName: file.name });
          successfulUploads++;
        } catch (fileError) {
          console.error(`Error processing file ${file.name}:`, fileError);
          // Continue with next file
        }
      }

      if (successfulUploads > 0) {
        toast({
          title: "Feltöltés sikeres!",
          description: "A feltöltött adatok feldolgozásának eredménye pár percen belül válik láthatóvá.",
          duration: 3000,
        });

        // Polling fallback for each invoice upload (5s interval, max 90s)
        for (const { id: uploadId, fileName } of uploadedIds) {
          const runInvoicePoll = async () => {
            const maxAttempts = 18;
            const intervalMs = 5000;
            console.log(`[InvoicePoll] Starting polling for invoice_uploads_id=${uploadId}`);
            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
              await new Promise(res => setTimeout(res, intervalMs));
              try {
                const { data: invoiceRows } = await supabase
                  .from('invoices')
                  .select('id')
                  .eq('invoice_uploads_id', uploadId)
                  .limit(1);
                console.log(`[InvoicePoll] Attempt ${attempt}/${maxAttempts}: found ${invoiceRows?.length ?? 0} rows`);
                if (invoiceRows && invoiceRows.length > 0) {
                  const { toast: sonnerToast } = await import('sonner');
                  const { createElement } = await import('react');
                  const { CheckCircle2 } = await import('lucide-react');
                  sonnerToast.success('Gratulálunk!', {
                    id: `file-processed-${uploadId}`,
                    description: `A következő fájl sikeresen fel lett dolgozva: ${fileName}`,
                    duration: 5000,
                    icon: createElement(CheckCircle2, { className: 'h-5 w-5 text-emerald-500' }),
                  });
                  queryClient.invalidateQueries({ queryKey: ['submittedInvoices'] });
                  queryClient.invalidateQueries({ queryKey: ['filteredSubmittedInvoices'] });
                  queryClient.invalidateQueries({ queryKey: ['uploadHistory'] });
                  return;
                }
              } catch (err) {
                console.error(`[InvoicePoll] Attempt ${attempt} error:`, err);
              }
            }
            console.log(`[InvoicePoll] ⚠️ Polling timed out for ${uploadId}`);
          };
          runInvoicePoll();
        }

        setSelectedInvoiceFiles([]);
        setUploadRefreshKey(k => k + 1);
        delayedUploadHistoryInvalidation();
      } else {
        toast({
          variant: "destructive",
          title: "Feltöltés sikertelen",
          description: "Nem sikerült egyetlen fájlt sem feltölteni."
        });
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        variant: "destructive",
        title: "Feltöltés sikertelen",
        description: error instanceof Error ? error.message : "Hiba történt a fájlok feltöltése során. Kérlek próbáld újra."
      });
    } finally {
      setUploading(false);
    }
  };

  const handleBankStatementUpload = async () => {
    if (selectedBankFiles.length === 0) {
      toast({
        variant: "destructive",
        title: "Nincs kiválasztott fájl",
        description: "Kérlek válassz ki legalább egy bankkivonat fájlt a feltöltéshez."
      });
      return;
    }

    if (!user) {
      toast({
        variant: "destructive",
        title: "Nem vagy bejelentkezve",
        description: "A feltöltéshez be kell jelentkezned."
      });
      return;
    }

    setUploading(true);

    try {
      for (const file of selectedBankFiles) {
        // Upload file to storage
        const uploadData = await uploadFileToStorage(file, 'bank-statements', user.id);

        // Get the public URL
        const { data: urlData } = supabase.storage
          .from('bank-statements')
          .getPublicUrl(uploadData.path);

        // Save to bank_statement_uploads table for tracking
        const { data: uploadRecord, error: dbError } = await supabase
          .from('bank_statement_uploads')
          .insert({
            user_id: user.id,
            company_id: selectedCompany?.id || null,
            file_name: file.name,
            file_url: urlData.publicUrl,
            file_size: file.size,
            file_type: file.type,
            upload_status: 'uploaded',
            processing_status: 'pending'
          })
          .select()
          .single();

        if (dbError) throw dbError;

        // Trigger processing webhook (production only)
        try {
          const { error: webhookError } = await supabase.functions.invoke('trigger-bank-statement-processing', {
            body: {
              uploadId: uploadRecord.id,
              webhookUrl: 'https://n8n.thinkaikontir.hu/webhook/a6f3dbf0-9eab-4e1c-98cf-c8ff56a498f6'
            }
          });

          if (webhookError) {
            console.error('Webhook error:', webhookError);
          }
        } catch (webhookError) {
          console.error('Webhook trigger error:', webhookError);
        }
      }

      // Optimistic update for each uploaded bank file
      for (const file of selectedBankFiles) {
        addToUploadHistoryCache({
          id: crypto.randomUUID(),
          file_name: file.name,
          file_size: file.size,
          file_type: file.type,
          file_url: '',
          user_id: user.id,
          upload_status: 'uploaded',
          processing_status: 'pending',
          created_at: new Date().toISOString(),
          error_message: null,
        });
      }

      toast({
        title: "Feltöltés sikeres!",
        description: "A feltöltött adatok feldolgozásának eredménye pár percen belül válik láthatóvá.",
        duration: 3000,
      });

      setSelectedBankFiles([]);
      setUploadRefreshKey(k => k + 1);
      delayedUploadHistoryInvalidation();
    } catch (error) {
      console.error('Bank statement upload error:', error);
      toast({
        variant: "destructive",
        title: "Feltöltés sikertelen",
        description: "Hiba történt a bankkivonatok feltöltése során. Kérlek próbáld újra."
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSalaryUpload = async () => {
    if (selectedSalaryFiles.length === 0) {
      toast({
        variant: "destructive",
        title: "Nincs kiválasztott fájl",
        description: "Kérlek válassz ki legalább egy bér/járulék fájlt a feltöltéshez."
      });
      return;
    }

    if (!user) {
      toast({
        variant: "destructive",
        title: "Nem vagy bejelentkezve",
        description: "A feltöltéshez be kell jelentkezned."
      });
      return;
    }

    setUploading(true);

    try {
      for (const file of selectedSalaryFiles) {
        // Upload file to storage
        const uploadData = await uploadFileToStorage(file, 'salaries', user.id);

        // Get the public URL
        const { data: urlData } = supabase.storage
          .from('salaries')
          .getPublicUrl(uploadData.path);

        // Insert preliminary record into salary_files table
        const { data: uploadRecord, error: dbError } = await supabase
          .from('salary_files' as any)
          .insert({
            user_id: user.id,
            company_id: selectedCompany?.id || null,
            payment_type: 'other',
            recipient_name: 'Feldolgozás alatt',
            description: `${file.name} - Feldolgozás alatt...`,
            amount_to_transfer: 0,
            status: 'pending',
            file_url: urlData.publicUrl,
            file_name: file.name,
            file_size: file.size,
            source: 'automated'
          })
          .select()
          .single() as { data: { id: string } | null; error: any };

        if (dbError) {
          console.error('Database insert error:', dbError);
          continue;
        }

        // Trigger processing via edge function (production webhook only)
        try {
          const { error: triggerError } = await supabase.functions.invoke('trigger-salary-processing', {
            body: {
              uploadId: uploadRecord.id,
              webhookUrl: 'https://n8n.thinkaikontir.hu/webhook/jarulek'
            }
          });

          if (triggerError) {
            console.error('Edge function error:', triggerError);
          }
        } catch (webhookError) {
          console.error('Webhook trigger error:', webhookError);
        }

        // Polling fallback: bounded retry loop (5s interval, max 90s)
        // Realtime from service_role INSERTs is unreliable, and processing takes ~20-30s
        const salaryFileId = uploadRecord.id;
        const runPollingLoop = async () => {
          const maxAttempts = 18; // 18 * 5s = 90s
          const intervalMs = 5000;
          console.log(`[SalaryPoll] Starting polling for salary_file_id=${salaryFileId}, max ${maxAttempts} attempts`);
          
          for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            await new Promise(res => setTimeout(res, intervalMs));
            try {
              // Check for salary rows first (primary success signal)
              const { data: salaryRows } = await supabase
                .from('salary')
                .select('id')
                .eq('salary_file_id', salaryFileId)
                .limit(1);
              
              console.log(`[SalaryPoll] Attempt ${attempt}/${maxAttempts}: found ${salaryRows?.length ?? 0} salary rows`);
              
              if (salaryRows && salaryRows.length > 0) {
                // Fetch file name for toast
                const { data: sfData } = await supabase
                  .from('salary_files' as any)
                  .select('file_name')
                  .eq('id', salaryFileId)
                  .single() as { data: { file_name: string } | null; error: any };
                const fileName = sfData?.file_name || file.name;
                // Show notification (deduplicated by toast id)
                const { toast: sonnerToast } = await import('sonner');
                const { createElement } = await import('react');
                const { CheckCircle2 } = await import('lucide-react');
                sonnerToast.success('Gratulálunk!', {
                  id: `file-processed-${salaryFileId}`,
                  description: `A következő fájl sikeresen fel lett dolgozva: ${fileName}`,
                  duration: 5000,
                  icon: createElement(CheckCircle2, { className: 'h-5 w-5 text-emerald-500' }),
                });
                console.log(`[SalaryPoll] ✅ Toast shown for ${salaryFileId}`);
                // Invalidate caches
                queryClient.invalidateQueries({ queryKey: ['salaries'] });
                queryClient.invalidateQueries({ queryKey: ['salary_files'] });
                queryClient.invalidateQueries({ queryKey: ['uploadHistory'] });
                return; // Done!
              }
            } catch (err) {
              console.error(`[SalaryPoll] Attempt ${attempt} error:`, err);
            }
          }
          console.log(`[SalaryPoll] ⚠️ Polling timed out for ${salaryFileId} after ${maxAttempts} attempts`);
        };
        // Fire and forget - runs in background
        runPollingLoop();
      }

      // Optimistic update for each uploaded salary file
      for (const file of selectedSalaryFiles) {
        addToUploadHistoryCache({
          id: crypto.randomUUID(),
          file_name: file.name,
          file_size: file.size,
          file_type: '',
          file_url: '',
          user_id: user.id,
          upload_status: 'pending',
          processing_status: 'pending',
          created_at: new Date().toISOString(),
          error_message: null,
        });
      }

      toast({
        title: "Feltöltés sikeres!",
        description: "A feltöltött adatok feldolgozásának eredménye pár percen belül válik láthatóvá.",
        duration: 3000,
      });

      setSelectedSalaryFiles([]);
      setUploadRefreshKey(k => k + 1);
      delayedUploadHistoryInvalidation();
    } catch (error) {
      console.error('Salary upload error:', error);
      toast({
        variant: "destructive",
        title: "Feltöltés sikertelen",
        description: "Hiba történt a bérek/járulékok feltöltése során. Kérlek próbáld újra."
      });
    } finally {
      setUploading(false);
    }
  };

  const handleTransactionUpload = async () => {
    if (selectedTransactionFiles.length === 0) {
      toast({
        variant: "destructive",
        title: "Nincs kiválasztott fájl",
        description: "Kérlek válassz ki legalább egy tranzakció fájlt a feltöltéshez."
      });
      return;
    }

    if (!user) {
      toast({
        variant: "destructive",
        title: "Nem vagy bejelentkezve",
        description: "A feltöltéshez be kell jelentkezned."
      });
      return;
    }

    if (!selectedCompany?.id) {
      toast({
        variant: "destructive",
        title: "Nincs kiválasztott cég",
        description: "A feltöltéshez válassz ki egy céget."
      });
      return;
    }

    // Check for duplicate files
    const duplicates: string[] = [];
    for (const file of selectedTransactionFiles) {
      const isDuplicate = await checkDuplicateFile(file.name, 'transaction_uploads');
      if (isDuplicate) {
        duplicates.push(file.name);
      }
    }

    if (duplicates.length > 0) {
      toast({
        variant: "destructive",
        title: "Korábban már feltöltött fájl(ok)",
        description: `A következő fájl(ok) már sikeresen fel lettek töltve és feldolgozva: ${duplicates.join(', ')}`
      });
      return;
    }

    setUploading(true);

    // Show processing toast
    const processingToast = toast({
      title: "Feldolgozás...",
      description: "Tranzakciók feltöltése és feldolgozásra küldése folyamatban..."
    });

    try {
      let successfulUploads = 0;

      for (const file of selectedTransactionFiles) {
        // Upload file to storage
        const uploadData = await uploadFileToStorage(file, 'transactions', user.id);

        // Get the public URL
        const { data: urlData } = supabase.storage
          .from('transactions')
          .getPublicUrl(uploadData.path);

        // Save to transaction_uploads table for tracking with pending status
        const { data: uploadRecord, error: dbError } = await supabase
          .from('transaction_uploads')
          .insert({
            user_id: user.id,
            company_id: selectedCompany.id,
            file_name: file.name,
            file_url: urlData.publicUrl,
            file_size: file.size,
            file_type: file.type,
            upload_status: 'uploaded',
            processing_status: 'pending'
          })
          .select()
          .single();

        if (dbError) throw dbError;

        // Trigger processing via edge function (avoids CORS issues with direct webhook calls)
        const webhookUrl = 'https://n8n.thinkaikontir.hu/webhook/supabase-transaction_storage-trigger';

        try {
          console.log('Triggering transaction processing via edge function:', { uploadId: uploadRecord.id });

          const { data: triggerData, error: triggerError } = await supabase.functions.invoke('trigger-transaction-processing', {
            body: {
              uploadId: uploadRecord.id,
              webhookUrl,
              fileUrl: urlData.publicUrl,
              fileName: file.name,
              companyId: selectedCompany.id
            }
          });

          if (triggerError) {
            console.error('Edge function error:', triggerError);
          } else if (triggerData?.success) {
            addToUploadHistoryCache({
              id: uploadRecord.id,
              file_name: file.name,
              file_size: file.size,
              file_type: file.type,
              file_url: urlData.publicUrl,
              user_id: user.id,
              upload_status: 'uploaded',
              processing_status: 'pending',
              created_at: new Date().toISOString(),
              error_message: null,
            });
            successfulUploads++;
          } else {
            console.error('Webhook failed via edge function:', triggerData);
          }
        } catch (webhookError) {
          console.error('Webhook trigger error:', webhookError);
        }
      }

      // Dismiss processing toast
      processingToast.dismiss();

      if (successfulUploads > 0) {
        toast({
          title: "Feltöltés sikeres!",
          description: "A feltöltött adatok feldolgozásának eredménye pár percen belül válik láthatóvá.",
          duration: 3000,
        });

        setSelectedTransactionFiles([]);
        setUploadRefreshKey(k => k + 1);
        delayedUploadHistoryInvalidation();
      } else {
        toast({
          variant: "destructive",
          title: "Feldolgozás sikertelen",
          description: "A fájlok feltöltve, de a webhook hívás sikertelen. Kérlek próbáld újra később."
        });
      }
    } catch (error) {
      console.error('Transaction upload error:', error);
      processingToast.dismiss();
      toast({
        variant: "destructive",
        title: "Feltöltés sikertelen",
        description: "Hiba történt a tranzakciók feltöltése során. Kérlek próbáld újra."
      });
    } finally {
      setUploading(false);
      // Reset file input to allow re-uploading
      const inputElement = document.getElementById('transaction-file-input') as HTMLInputElement;
      if (inputElement) {
        inputElement.value = '';
      }
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Dokumentum feltöltés</h1>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-5 w-5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Tölts fel PDF, képek vagy Excel fájlokat. A rendszer automatikusan feldolgozza és adatbázisba menti az információkat.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <p className="text-muted-foreground">
          Tölts fel számlákat és bankkivonatokat feldolgozásra és elemzésre
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Tabs defaultValue="invoices" className="space-y-6" onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="invoices" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Számlák
              </TabsTrigger>
              <TabsTrigger value="transactions" className="flex items-center gap-2">
                <Landmark className="h-4 w-4" />
                Banki tranzakciók
              </TabsTrigger>
              <TabsTrigger value="salaries" className="flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Bérek/Járulékok
              </TabsTrigger>
            </TabsList>

            {/* Invoice Upload Tab */}
            <TabsContent value="invoices">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Számla fájlok feltöltése
                  </CardTitle>
                  <CardDescription>
                    Válassz PDF vagy kép fájlokat, amelyek számlákat tartalmaznak. Támogatott formátumok: PDF, JPG, PNG, WebP
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                    <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Válassz számlafájlokat a feltöltéshez</p>
                      <p className="text-xs text-muted-foreground">
                        Több fájlt is kiválaszthatsz egyszerre vagy egyenként is feltöltheted
                      </p>
                    </div>
                    <Button
                      className="mt-4"
                      onClick={() => document.getElementById('invoice-file-input')?.click()}
                      disabled={!canProcessInvoice()}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {canProcessInvoice() ? 'Fájlok tallózása' : 'Elérted a limitet'}
                    </Button>
                    <input
                      id="invoice-file-input"
                      type="file"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      onChange={handleInvoiceFileSelect}
                      className="hidden"
                      disabled={!canProcessInvoice()}
                    />
                  </div>

                  {selectedInvoiceFiles.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="font-medium">Kiválasztott fájlok ({selectedInvoiceFiles.length})</h3>
                      <div className="space-y-2">
                        {selectedInvoiceFiles.map((file, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-3 border rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="font-medium text-sm">{file.name}</p>
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary" className="text-xs">
                                    {file.type.split('/')[1].toUpperCase()}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {formatFileSize(file.size)}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeInvoiceFile(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>

                      <Button
                        onClick={handleInvoiceUpload}
                        disabled={uploading || !canProcessInvoice()}
                        className="w-full"
                      >
                        {uploading ? (
                          <>
                            <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent mr-2"></div>
                            Feldolgozás...
                          </>
                        ) : !canProcessInvoice() ? (
                          'Elérted a havi limitet'
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            {selectedInvoiceFiles.length} számlafájl feltöltése
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Bank Statement Upload Tab */}
            <TabsContent value="bank-statements">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Bankkivonat feltöltése
                  </CardTitle>
                  <CardDescription>
                    Tölts fel bankkivonatokat automatikus tranzakció feldolgozásra. Támogatott formátumok: PDF, CSV, Excel (XLS/XLSX)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                    <CreditCard className="h-12 w-12 text-muted-foreground mb-4" />
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Válassz bankkivonat fájlokat</p>
                      <p className="text-xs text-muted-foreground">
                        A rendszer automatikusan feldolgozza a tranzakciókat és kategorizálja őket
                      </p>
                    </div>
                    <Button
                      className="mt-4"
                      onClick={() => document.getElementById('bank-file-input')?.click()}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Bankkivonatok tallózása
                    </Button>
                    <input
                      id="bank-file-input"
                      type="file"
                      multiple
                      accept=".pdf,.csv,.xls,.xlsx"
                      onChange={handleBankStatementFileSelect}
                      className="hidden"
                    />
                  </div>

                  {selectedBankFiles.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="font-medium">Kiválasztott bankkivonatok ({selectedBankFiles.length})</h3>
                      <div className="space-y-2">
                        {selectedBankFiles.map((file, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-3 border rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="font-medium text-sm">{file.name}</p>
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary" className="text-xs">
                                    {file.type === 'text/csv' ? 'CSV' :
                                      file.type === 'application/pdf' ? 'PDF' :
                                        file.type.includes('excel') || file.type.includes('spreadsheet') ? 'EXCEL' :
                                          file.type.split('/')[1].toUpperCase()}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {formatFileSize(file.size)}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeBankFile(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>

                      <Button
                        onClick={handleBankStatementUpload}
                        disabled={uploading}
                        className="w-full"
                      >
                        {uploading ? (
                          <>
                            <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent mr-2"></div>
                            Feltöltés és feldolgozás...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            {selectedBankFiles.length} bankkivonat feltöltése
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Transaction Upload Tab */}
            <TabsContent value="transactions">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Landmark className="h-5 w-5" />
                    Tranzakciók feltöltése
                  </CardTitle>
                  <CardDescription>
                    Tölts fel tranzakciós fájlokat feldolgozásra. Támogatott formátumok: PDF, CSV, Excel (XLS/XLSX)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                    <Landmark className="h-12 w-12 text-muted-foreground mb-4" />
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Válassz tranzakciós fájlokat</p>
                      <p className="text-xs text-muted-foreground">
                        A rendszer automatikusan feldolgozza és kategorizálja a tranzakciókat
                      </p>
                    </div>
                    <Button
                      className="mt-4"
                      onClick={() => document.getElementById('transaction-file-input')?.click()}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Tranzakciók tallózása
                    </Button>
                    <input
                      id="transaction-file-input"
                      type="file"
                      multiple
                      accept=".pdf,.csv,.xls,.xlsx"
                      onChange={handleTransactionFileSelect}
                      className="hidden"
                    />
                  </div>

                  {selectedTransactionFiles.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="font-medium">Kiválasztott tranzakciók ({selectedTransactionFiles.length})</h3>
                      <div className="space-y-2">
                        {selectedTransactionFiles.map((file, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-3 border rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <Landmark className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="font-medium text-sm">{file.name}</p>
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary" className="text-xs">
                                    {file.type === 'text/csv' ? 'CSV' :
                                      file.type === 'application/pdf' ? 'PDF' :
                                        file.type.includes('excel') || file.type.includes('spreadsheet') ? 'EXCEL' :
                                          file.type.split('/')[1].toUpperCase()}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {formatFileSize(file.size)}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeTransactionFile(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>

                      <Button
                        onClick={handleTransactionUpload}
                        disabled={uploading}
                        className="w-full"
                      >
                        {uploading ? (
                          <>
                            <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent mr-2"></div>
                            Feltöltés...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            {selectedTransactionFiles.length} tranzakció feltöltése
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Salary/Contributions Upload Tab */}
            <TabsContent value="salaries">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="h-5 w-5" />
                    Bérek és Járulékok feltöltése
                  </CardTitle>
                  <CardDescription>
                    Tölts fel bér és járulék dokumentumokat feldolgozásra. Támogatott formátumok: PDF, CSV, Excel (XLS/XLSX)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                    <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Válassz bér/járulék fájlokat</p>
                      <p className="text-xs text-muted-foreground">
                        A rendszer automatikusan feldolgozza és kategorizálja a dokumentumokat
                      </p>
                    </div>
                    <Button
                      className="mt-4"
                      onClick={() => document.getElementById('salary-file-input')?.click()}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Bérek/Járulékok tallózása
                    </Button>
                    <input
                      id="salary-file-input"
                      type="file"
                      multiple
                      accept=".pdf,.csv,.xls,.xlsx"
                      onChange={handleSalaryFileSelect}
                      className="hidden"
                    />
                  </div>

                  {selectedSalaryFiles.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="font-medium">Kiválasztott fájlok ({selectedSalaryFiles.length})</h3>
                      <div className="space-y-2">
                        {selectedSalaryFiles.map((file, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-3 border rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <Wallet className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="font-medium text-sm">{file.name}</p>
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary" className="text-xs">
                                    {file.type === 'text/csv' ? 'CSV' :
                                      file.type === 'application/pdf' ? 'PDF' :
                                        file.type.includes('excel') || file.type.includes('spreadsheet') ? 'EXCEL' :
                                          file.type.split('/')[1].toUpperCase()}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {formatFileSize(file.size)}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeSalaryFile(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>

                      <Button
                        onClick={handleSalaryUpload}
                        disabled={uploading}
                        className="w-full"
                      >
                        {uploading ? (
                          <>
                            <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent mr-2"></div>
                            Feltöltés és feldolgozás...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            {selectedSalaryFiles.length} fájl feltöltése
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

        </div>

        {/* Subscription Usage Sidebar */}
        <div className="lg:col-span-1">
          <SubscriptionUsage />
        </div>
      </div>

      <UploadHistory activeTab={activeTab} refreshKey={uploadRefreshKey} />
    </div>
  );
};

export default ManualUpload;