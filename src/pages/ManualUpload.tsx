import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileText, X, Building2, CreditCard, Wallet, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useCompany } from '@/contexts/CompanyContext';
import SubscriptionUsage from '@/components/SubscriptionUsage';

const ManualUpload = () => {
  const [selectedInvoiceFiles, setSelectedInvoiceFiles] = useState<File[]>([]);
  const [selectedBankFiles, setSelectedBankFiles] = useState<File[]>([]);
  const [selectedSalaryFiles, setSelectedSalaryFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const { canProcessInvoice, incrementUsage, remainingInvoices } = useSubscription();

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

  const uploadFileToStorage = async (file: File, bucket: string, folder: string) => {
    if (!user) throw new Error('User not authenticated');

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
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

  const handleInvoiceUpload = async () => {
    if (selectedInvoiceFiles.length === 0) {
      toast({
        variant: "destructive",
        title: "Nincs kiválasztott fájl",
        description: "Kérlek válassz ki legalább egy számlafájlt a feltöltéshez."
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

          // Trigger N8N webhook processing - call both webhooks
          const webhookUrls = [
            'https://n8n.thinkaikontir.hu/webhook-test/bd504dd3-8af8-45d6-90f6-cfc635a22da6',
            'https://n8n.thinkaikontir.hu/webhook/bd504dd3-8af8-45d6-90f6-cfc635a22da6'
          ];

          for (const webhookUrl of webhookUrls) {
            try {
              const { error: webhookError } = await supabase.functions.invoke('trigger-invoice-processing', {
                body: { 
                  uploadId: uploadRecord.id,
                  webhookUrl
                }
              });

              if (webhookError) {
                console.error(`Webhook trigger error for ${webhookUrl}:`, webhookError);
                // Don't throw here - file is uploaded, webhook is secondary
              }
            } catch (webhookError) {
              console.error(`Failed to trigger processing webhook ${webhookUrl}:`, webhookError);
              // Continue - file upload succeeded
            }
          }

          successfulUploads++;
        } catch (fileError) {
          console.error(`Error processing file ${file.name}:`, fileError);
          // Continue with next file
        }
      }
      
      if (successfulUploads > 0) {
        toast({
          title: "Feltöltés sikeres!",
          description: `${successfulUploads} számlafájl feltöltve és feldolgozásra küldve.`
        });
        
        setSelectedInvoiceFiles([]);
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

        // Trigger processing webhook - call both webhooks
        const webhookUrls = [
          'https://n8n.thinkaikontir.hu/webhook-test/a6f3dbf0-9eab-4e1c-98cf-c8ff56a498f6',
          'https://n8n.thinkaikontir.hu/webhook/a6f3dbf0-9eab-4e1c-98cf-c8ff56a498f6'
        ];

        for (const webhookUrl of webhookUrls) {
          try {
            const { error: webhookError } = await supabase.functions.invoke('trigger-bank-statement-processing', {
              body: {
                uploadId: uploadRecord.id,
                webhookUrl
              }
            });

            if (webhookError) {
              console.error(`Webhook error for ${webhookUrl}:`, webhookError);
              // Log but don't show toast for every webhook failure
            }
          } catch (webhookError) {
            console.error(`Webhook trigger error for ${webhookUrl}:`, webhookError);
          }
        }
      }
      
      toast({
        title: "Feltöltés sikeres!",
        description: `${selectedBankFiles.length} bankkivonat feltöltve és feldolgozásra elküldve.`
      });
      
      setSelectedBankFiles([]);
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

        // Trigger webhooks
        const webhookUrls = [
          'https://n8n.thinkaikontir.hu/webhook-test/jarulek',
          'https://n8n.thinkaikontir.hu/webhook/jarulek'
        ];

        const webhookPayload = {
          fileName: file.name,
          fileUrl: urlData.publicUrl,
          filePath: uploadData.path,
          userId: user.id,
          fileSize: file.size,
          fileType: file.type,
          uploadedAt: new Date().toISOString()
        };

        // Insert preliminary record into salary_files table
        const { error: dbError } = await supabase
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
            source: 'automated'
          });

        if (dbError) {
          console.error('Database insert error:', dbError);
        }

        for (const webhookUrl of webhookUrls) {
          try {
            await fetch(webhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(webhookPayload)
            });
          } catch (webhookError) {
            console.error(`Webhook error for ${webhookUrl}:`, webhookError);
          }
        }
      }
      
      toast({
        title: "Feltöltés sikeres!",
        description: `${selectedSalaryFiles.length} bér/járulék fájl feltöltve és feldolgozásra elküldve.`
      });
      
      setSelectedSalaryFiles([]);
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
          <Tabs defaultValue="invoices" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="invoices" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Számlák
              </TabsTrigger>
              <TabsTrigger value="bank-statements" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Bankkivonatok
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
                  {remainingInvoices <= 5 && (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-800">
                        Figyelem: Csak {remainingInvoices} számlát tudsz még feldolgozni ebben a hónapban.
                      </p>
                    </div>
                  )}
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
</div>
  );
};

export default ManualUpload;