import { useState, useCallback, useRef } from 'react';
import { formatFileSize, extractStoragePath, cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileText, X, Building2, CreditCard, Wallet, Info, Landmark, Package } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import UploadHistory from '@/components/UploadHistory';

const ManualUpload = () => {
  const [selectedInvoiceFiles, setSelectedInvoiceFiles] = useState<File[]>([]);
  const [selectedBankFiles, setSelectedBankFiles] = useState<File[]>([]);
  const [selectedSalaryFiles, setSelectedSalaryFiles] = useState<File[]>([]);
  const [selectedTransactionFiles, setSelectedTransactionFiles] = useState<File[]>([]);
  const [selectedReportFiles, setSelectedReportFiles] = useState<{file: File; reportType: 'gls' | 'mpl' | 'mixpack'}[]>([]);
  const [reportType, setReportType] = useState<'gls' | 'mpl' | 'mixpack'>('gls');
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('invoices');
  const [dragOver, setDragOver] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { selectedCompany } = useCompany();

  const queryClient = useQueryClient();

  // Duplicate re-upload confirmation state
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateFileNames, setDuplicateFileNames] = useState<string[]>([]);
  const [duplicateUploadType, setDuplicateUploadType] = useState<'invoice' | 'transaction'>('invoice');
  const pendingUploadRef = useRef<(() => void) | null>(null);

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
    event.target.value = '';
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
    event.target.value = '';
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
    event.target.value = '';
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
    event.target.value = '';
  };

  const removeTransactionFile = (index: number) => {
    setSelectedTransactionFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleReportFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const allowedTypes = [
      'application/pdf',
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    const validFiles = files.filter(file => {
      if (allowedTypes.includes(file.type) || file.name.endsWith('.xls')) return true;
      toast({
        variant: "destructive",
        title: "\u00c9rv\u00e9nytelen f\u00e1jlt\u00edpus",
        description: `${file.name} nem t\u00e1mogatott. Riportokhoz t\u00f6lts fel XLS, XLSX, CSV, PDF vagy DOCX f\u00e1jlokat.`
      });
      return false;
    });
    setSelectedReportFiles(prev => [...prev, ...validFiles.map(f => ({ file: f, reportType }))]);
    event.target.value = '';
  };

  const removeReportFile = (index: number) => {
    setSelectedReportFiles(prev => prev.filter((_, i) => i !== index));
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

    // Check for duplicate files — warn but allow re-upload
    const duplicates: string[] = [];
    for (const file of selectedInvoiceFiles) {
      const isDuplicate = await checkDuplicateFile(file.name, 'invoice_uploads');
      if (isDuplicate) {
        duplicates.push(file.name);
      }
    }

    if (duplicates.length > 0) {
      // Show confirmation dialog instead of blocking
      setDuplicateFileNames(duplicates);
      setDuplicateUploadType('invoice');
      pendingUploadRef.current = () => proceedWithInvoiceUpload();
      setDuplicateDialogOpen(true);
      return;
    }

    proceedWithInvoiceUpload();
  };

  const proceedWithInvoiceUpload = async () => {
    setUploading(true);

    try {
      let successfulUploads = 0;
      const uploadedIds: { id: string; fileName: string }[] = [];

      for (const file of selectedInvoiceFiles) {
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
            // BUG #5 FIX: Rollback — remove orphaned Storage file
            const storagePath = extractStoragePath(fileUrl, 'invoice-uploads');
            if (storagePath) {
              await supabase.storage.from('invoice-uploads').remove([storagePath]);
              console.log('Rolled back Storage file:', storagePath);
            }
            throw new Error(`Adatbázis hiba: ${uploadError.message}`);
          }

          // PGMQ: No webhook needed — database trigger automatically enqueues
          // the job to the invoice_jobs queue upon INSERT with processing_status='pending'.
          console.log(`[PGMQ] Invoice upload ${uploadRecord.id} enqueued via DB trigger`);

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


        setSelectedInvoiceFiles([]);
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

        if (dbError) {
          // BUG #5 FIX: Rollback — remove orphaned Storage file
          await supabase.storage.from('bank-statements').remove([uploadData.path]);
          console.log('Rolled back Storage file:', uploadData.path);
          throw dbError;
        }

        // PGMQ: No webhook needed — database trigger automatically enqueues
        // the job upon INSERT with processing_status='pending'.
        console.log(`[PGMQ] Bank statement upload ${uploadRecord.id} enqueued via DB trigger`);
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
      let successfulUploads = 0;
      const uploadedIds: { id: string; fileName: string }[] = [];

      for (const file of selectedSalaryFiles) {
        try {
          // Upload file to invoice-uploads storage (shared bucket)
          const fileUrl = await uploadFileToInvoiceStorage(file, user.id);

          // Create upload record in invoice_uploads with document_category = 'payroll'
          // The autonomous worker will pick this up and route it to the payroll pipeline
          const { data: uploadRecord, error: uploadError } = await supabase
            .from('invoice_uploads')
            .insert({
              user_id: user.id,
              company_id: selectedCompany?.id || null,
              file_name: file.name,
              file_size: file.size,
              file_type: file.type,
              file_url: fileUrl,
              upload_status: 'uploaded',
              processing_status: 'pending',
              document_category: 'payroll'
            } as any)
            .select()
            .single();

          if (uploadError) {
            console.error('Database insert error:', uploadError);
            // Rollback — remove orphaned Storage file
            const storagePath = extractStoragePath(fileUrl, 'invoice-uploads');
            if (storagePath) {
              await supabase.storage.from('invoice-uploads').remove([storagePath]);
              console.log('Rolled back Storage file:', storagePath);
            }
            throw new Error(`Adatbázis hiba: ${uploadError.message}`);
          }

          addToUploadHistoryCache({
            id: uploadRecord.id,
            file_name: file.name,
            file_size: file.size,
            file_type: file.type,
            file_url: fileUrl,
            user_id: user.id,
            upload_status: 'uploaded',
            processing_status: 'pending',
            created_at: new Date().toISOString(),
            error_message: null,
          });
          uploadedIds.push({ id: uploadRecord.id, fileName: file.name });
          successfulUploads++;
        } catch (fileError) {
          console.error(`Error processing salary file ${file.name}:`, fileError);
          // Continue with next file
        }
      }

      if (successfulUploads > 0) {
        toast({
          title: "Feltöltés sikeres!",
          description: "A bér/járulék fájlok feldolgozása automatikusan elindul. Az eredmény pár percen belül látható lesz.",
          duration: 3000,
        });


        setSelectedSalaryFiles([]);
        delayedUploadHistoryInvalidation();
      } else {
        toast({
          variant: "destructive",
          title: "Feltöltés sikertelen",
          description: "Nem sikerült egyetlen fájlt sem feltölteni."
        });
      }
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

    // Check for duplicate files — warn but allow re-upload
    const duplicates: string[] = [];
    for (const file of selectedTransactionFiles) {
      const isDuplicate = await checkDuplicateFile(file.name, 'transaction_uploads');
      if (isDuplicate) {
        duplicates.push(file.name);
      }
    }

    if (duplicates.length > 0) {
      // Show confirmation dialog instead of blocking
      setDuplicateFileNames(duplicates);
      setDuplicateUploadType('transaction');
      pendingUploadRef.current = () => proceedWithTransactionUpload();
      setDuplicateDialogOpen(true);
      return;
    }

    proceedWithTransactionUpload();
  };

  const proceedWithTransactionUpload = async () => {
    setUploading(true);

    // Show processing toast
    const processingToast = toast({
      title: "Feldolgozás...",
      description: "Tranzakciók feltöltése és feldolgozásra küldése folyamatban..."
    });

    try {
      let successfulUploads = 0;
      const txUploadedIds: { id: string; fileName: string }[] = [];
      const batchUploads: { uploadId: string; fileUrl: string; fileName: string }[] = [];

      // Step 1: Upload all files to storage and create DB records
      for (const file of selectedTransactionFiles) {
        const uploadData = await uploadFileToStorage(file, 'transactions', user.id);

        const { data: urlData } = supabase.storage
          .from('transactions')
          .getPublicUrl(uploadData.path);

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

        if (dbError) {
          await supabase.storage.from('transactions').remove([uploadData.path]);
          console.log('Rolled back Storage file:', uploadData.path);
          throw dbError;
        }

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

        batchUploads.push({
          uploadId: uploadRecord.id,
          fileUrl: urlData.publicUrl,
          fileName: file.name,
        });
        txUploadedIds.push({ id: uploadRecord.id, fileName: file.name });
        successfulUploads++;
      }

      // PGMQ: No webhook needed — each INSERT into transaction_uploads with
      // processing_status='pending' automatically triggers the DB trigger
      // that enqueues the job to the transaction_jobs PGMQ queue.
      if (batchUploads.length > 0) {
        console.log(`[PGMQ] ${batchUploads.length} transaction uploads enqueued via DB trigger`);
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

  // formatFileSize is now imported from @/lib/utils

  const handleReportUpload = async () => {
    if (selectedReportFiles.length === 0) {
      toast({ variant: "destructive", title: "Nincs kiv\u00e1lasztott f\u00e1jl", description: "K\u00e9rlek v\u00e1lassz ki legal\u00e1bb egy riport f\u00e1jlt." });
      return;
    }
    if (!user) {
      toast({ variant: "destructive", title: "Nem vagy bejelentkezve", description: "A felt\u00f6lt\u00e9shez be kell jelentkezned." });
      return;
    }
    if (!selectedCompany?.id) {
      toast({ variant: "destructive", title: "Nincs kiv\u00e1lasztott c\u00e9g", description: "A felt\u00f6lt\u00e9shez v\u00e1lassz ki egy c\u00e9get." });
      return;
    }
    setUploading(true);
    try {
      let successfulUploads = 0;
      for (const entry of selectedReportFiles) {
        const { file, reportType: fileReportType } = entry;
        const uploadData = await uploadFileToStorage(file, 'report-uploads', user.id);
        const { data: urlData } = supabase.storage.from('report-uploads').getPublicUrl(uploadData.path);
        const { data: uploadRecord, error: dbError } = await supabase
          .from('report_uploads')
          .insert({
            user_id: user.id,
            company_id: selectedCompany.id,
            file_name: file.name,
            file_url: urlData.publicUrl,
            file_size: file.size,
            file_type: file.type,
            report_type: fileReportType,
            upload_status: 'uploaded',
            processing_status: 'pending',
          })
          .select()
          .single();
        if (dbError) {
          await supabase.storage.from('report-uploads').remove([uploadData.path]);
          throw dbError;
        }
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
      }
      if (successfulUploads > 0) {
        toast({ title: "Felt\u00f6lt\u00e9s sikeres!", description: `${successfulUploads} riport f\u00e1jl feldolgoz\u00e1sra k\u00fcldve.`, duration: 3000 });
        setSelectedReportFiles([]);
        delayedUploadHistoryInvalidation();
      }
    } catch (error) {
      console.error('Report upload error:', error);
      toast({ variant: "destructive", title: "Felt\u00f6lt\u00e9s sikertelen", description: "Hiba t\u00f6rt\u00e9nt a riport felt\u00f6lt\u00e9se sor\u00e1n." });
    } finally {
      setUploading(false);
    }
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

      <div className="space-y-6">
        <div>
          <Tabs defaultValue="invoices" className="space-y-6" onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
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
              <TabsTrigger value="reports" className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Riportok
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
                  <div
                    className={cn(
                      "flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200",
                      dragOver === 'invoices'
                        ? "border-primary bg-primary/5 scale-[1.01] shadow-sm"
                        : "border-muted-foreground/25 hover:border-muted-foreground/40"
                    )}
                    onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver('invoices'); }}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null); }}
                    onDrop={(e) => {
                      e.preventDefault(); e.stopPropagation(); setDragOver(null);
                      const files = Array.from(e.dataTransfer.files);
                      const allowed = ['application/pdf','image/jpeg','image/jpg','image/png','image/webp'];
                      const valid = files.filter(f => allowed.includes(f.type));
                      if (valid.length > 0) setSelectedInvoiceFiles(prev => [...prev, ...valid]);
                    }}
                  >
                    <FileText className={cn("h-12 w-12 mb-4 transition-colors", dragOver === 'invoices' ? "text-primary" : "text-muted-foreground")} />
                    <div className="space-y-2">
                      <p className="text-sm font-medium">{dragOver === 'invoices' ? 'Engedd el a fájlokat a feltöltéshez' : 'Húzd ide a fájlokat, vagy kattints a tallózáshoz'}</p>
                      <p className="text-xs text-muted-foreground">
                        Több fájlt is kiválaszthatsz egyszerre vagy egyenként is feltöltheted
                      </p>
                    </div>
                    <Button
                      className="mt-4"
                      onClick={() => document.getElementById('invoice-file-input')?.click()}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Fájlok tallózása
                    </Button>
                    <input
                      id="invoice-file-input"
                      type="file"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      onChange={handleInvoiceFileSelect}
                      className="hidden"

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
                        disabled={uploading}
                        className="w-full"
                      >
                        {uploading ? (
                          <>
                            <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent mr-2"></div>
                            Feldolgozás...
                          </>
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
                  <div
                    className={cn(
                      "flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200",
                      dragOver === 'bank'
                        ? "border-primary bg-primary/5 scale-[1.01] shadow-sm"
                        : "border-muted-foreground/25 hover:border-muted-foreground/40"
                    )}
                    onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver('bank'); }}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null); }}
                    onDrop={(e) => {
                      e.preventDefault(); e.stopPropagation(); setDragOver(null);
                      const files = Array.from(e.dataTransfer.files);
                      const allowed = ['application/pdf','text/csv','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
                      const valid = files.filter(f => allowed.includes(f.type));
                      if (valid.length > 0) setSelectedBankFiles(prev => [...prev, ...valid]);
                    }}
                  >
                    <CreditCard className={cn("h-12 w-12 mb-4 transition-colors", dragOver === 'bank' ? "text-primary" : "text-muted-foreground")} />
                    <div className="space-y-2">
                      <p className="text-sm font-medium">{dragOver === 'bank' ? 'Engedd el a fájlokat' : 'Húzd ide a bankkivonatokat, vagy tallózz'}</p>
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
                  <div
                    className={cn(
                      "flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200",
                      dragOver === 'transactions'
                        ? "border-primary bg-primary/5 scale-[1.01] shadow-sm"
                        : "border-muted-foreground/25 hover:border-muted-foreground/40"
                    )}
                    onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver('transactions'); }}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null); }}
                    onDrop={(e) => {
                      e.preventDefault(); e.stopPropagation(); setDragOver(null);
                      const files = Array.from(e.dataTransfer.files);
                      const allowed = ['application/pdf','text/csv','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
                      const valid = files.filter(f => allowed.includes(f.type));
                      if (valid.length > 0) setSelectedTransactionFiles(prev => [...prev, ...valid]);
                    }}
                  >
                    <Landmark className={cn("h-12 w-12 mb-4 transition-colors", dragOver === 'transactions' ? "text-primary" : "text-muted-foreground")} />
                    <div className="space-y-2">
                      <p className="text-sm font-medium">{dragOver === 'transactions' ? 'Engedd el a fájlokat' : 'Húzd ide a tranzakciós fájlokat, vagy tallózz'}</p>
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
                  <div
                    className={cn(
                      "flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200",
                      dragOver === 'salaries'
                        ? "border-primary bg-primary/5 scale-[1.01] shadow-sm"
                        : "border-muted-foreground/25 hover:border-muted-foreground/40"
                    )}
                    onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver('salaries'); }}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null); }}
                    onDrop={(e) => {
                      e.preventDefault(); e.stopPropagation(); setDragOver(null);
                      const files = Array.from(e.dataTransfer.files);
                      const allowedExts = ['.pdf','.csv','.xls','.xlsx'];
                      const valid = files.filter(f => allowedExts.some(ext => f.name.toLowerCase().endsWith(ext)));
                      if (valid.length > 0) setSelectedSalaryFiles(prev => [...prev, ...valid]);
                    }}
                  >
                    <Wallet className={cn("h-12 w-12 mb-4 transition-colors", dragOver === 'salaries' ? "text-primary" : "text-muted-foreground")} />
                    <div className="space-y-2">
                      <p className="text-sm font-medium">{dragOver === 'salaries' ? 'Engedd el a fájlokat a feltöltéshez' : 'Húzd ide a fájlokat, vagy kattints a tallózáshoz'}</p>
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

            {/* Report Upload Tab */}
            <TabsContent value="reports">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Riportok feltöltése (GLS/MPL-Posta/Mixpack)
                  </CardTitle>
                  <CardDescription>
                    Tölts fel futárszolgálati riportokat feldolgozásra. A rendszer automatikusan feldolgozza és párosítja a tranzakciókkal és NAV számlákkal.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Report type selector */}
                  <div className="flex items-center gap-4">
                    <label className="text-sm font-medium">Riport típusa:</label>
                    <Select value={reportType} onValueChange={(v: 'gls' | 'mpl' | 'mixpack') => setReportType(v)}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gls">GLS</SelectItem>
                        <SelectItem value="mpl">MPL / Posta</SelectItem>
                        <SelectItem value="mixpack">Mixpack</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div
                    className={cn(
                      "flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200",
                      dragOver === 'reports'
                        ? "border-primary bg-primary/5 scale-[1.01] shadow-sm"
                        : "border-muted-foreground/25 hover:border-muted-foreground/40"
                    )}
                    onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver('reports'); }}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null); }}
                    onDrop={(e) => {
                      e.preventDefault(); e.stopPropagation(); setDragOver(null);
                      const files = Array.from(e.dataTransfer.files);
                      const allowedExts = ['.xls','.xlsx','.csv','.pdf','.doc','.docx'];
                      const valid = files.filter(f => allowedExts.some(ext => f.name.toLowerCase().endsWith(ext)));
                      if (valid.length > 0) setSelectedReportFiles(prev => [...prev, ...valid.map(f => ({ file: f, reportType }))]);
                    }}
                  >
                    <Package className={cn("h-12 w-12 mb-4 transition-colors", dragOver === 'reports' ? "text-primary" : "text-muted-foreground")} />
                    <div className="space-y-2">
                      <p className="text-sm font-medium">{dragOver === 'reports' ? 'Engedd el a fájlokat a feltöltéshez' : 'Húzd ide a fájlokat, vagy kattints a tallózáshoz'}</p>
                      <p className="text-xs text-muted-foreground">
                        Támogatott formátumok: XLS, XLSX, CSV, PDF, DOCX
                      </p>
                    </div>
                    <Button
                      className="mt-4"
                      onClick={() => document.getElementById('report-file-input')?.click()}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Riport fájlok tallózása
                    </Button>
                    <input
                      id="report-file-input"
                      type="file"
                      multiple
                      accept=".xls,.xlsx,.csv,.pdf,.doc,.docx"
                      onChange={handleReportFileSelect}
                      className="hidden"
                    />
                  </div>

                  {selectedReportFiles.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="font-medium">Kiválasztott fájlok ({selectedReportFiles.length})</h3>
                      <div className="space-y-2">
                        {selectedReportFiles.map((rawEntry, index) => {
                          // Guard: normalize stale HMR state where entry may be a raw File
                          const entry = (rawEntry as any).file ? rawEntry : { file: rawEntry as unknown as File, reportType };
                          return (
                          <div
                            key={index}
                            className="flex items-center justify-between p-3 border rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <Package className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="font-medium text-sm">{entry.file.name}</p>
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary" className="text-xs">
                                    {entry.reportType === 'gls' ? 'GLS' : entry.reportType === 'mpl' ? 'MPL' : 'MIXPACK'}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {formatFileSize(entry.file.size)}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeReportFile(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          );
                        })}
                      </div>

                      <Button
                        onClick={handleReportUpload}
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
                            {selectedReportFiles.length} riport feltöltése
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

      </div>

      <UploadHistory activeTab={activeTab} />

      {/* Duplicate re-upload confirmation dialog */}
      <AlertDialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Korábban már feltöltött fájl(ok)</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  A következő fájl(ok) már sikeresen fel lettek töltve és feldolgozva:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  {duplicateFileNames.map((name, i) => (
                    <li key={i} className="font-medium text-foreground">{name}</li>
                  ))}
                </ul>
                <p>
                  Szeretnéd újra feltölteni? A korábbi adatok frissülni fognak az új feldolgozás eredményével.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Mégsem</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setDuplicateDialogOpen(false);
                if (pendingUploadRef.current) {
                  pendingUploadRef.current();
                  pendingUploadRef.current = null;
                }
              }}
            >
              Igen, újra feltöltöm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ManualUpload;