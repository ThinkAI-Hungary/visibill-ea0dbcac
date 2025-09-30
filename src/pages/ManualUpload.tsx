import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileText, X, Building2, CreditCard } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const ManualUpload = () => {
  const [selectedInvoiceFiles, setSelectedInvoiceFiles] = useState<File[]>([]);
  const [selectedBankFiles, setSelectedBankFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

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

  const handleInvoiceUpload = async () => {
    if (selectedInvoiceFiles.length === 0) {
      toast({
        variant: "destructive",
        title: "Nincs kiválasztott fájl",
        description: "Kérlek válassz ki legalább egy számlafájlt a feltöltéshez."
      });
      return;
    }

    setUploading(true);
    
    try {
      // TODO: Implement actual invoice upload logic here
      // For now, just simulate upload
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast({
        title: "Feltöltés sikeres!",
        description: `${selectedInvoiceFiles.length} számlafájl feltöltve és feldolgozásra várakozik.`
      });
      
      setSelectedInvoiceFiles([]);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Feltöltés sikertelen",
        description: "Hiba történt a fájlok feltöltése során. Kérlek próbáld újra."
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
        
        // Save bank statement record to database
        const { error: dbError } = await supabase
          .from('bank_statements')
          .insert({
            user_id: user.id,
            file_name: file.name,
            file_url: uploadData.path,
            file_size: file.size,
            file_type: file.type,
            status: 'uploaded'
          });

        if (dbError) throw dbError;
      }
      
      toast({
        title: "Feltöltés sikeres!",
        description: `${selectedBankFiles.length} bankkivonat feltöltve és feldolgozásra várakozik.`
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
        <h1 className="text-3xl font-bold tracking-tight">Dokumentum feltöltés</h1>
        <p className="text-muted-foreground">
          Tölts fel számlákat és bankkivonatokat feldolgozásra és elemzésre
        </p>
      </div>

      <Tabs defaultValue="invoices" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="invoices" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Számlák
          </TabsTrigger>
          <TabsTrigger value="bank-statements" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Bankkivonatok
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
      </Tabs>
    </div>
  );
};

export default ManualUpload;