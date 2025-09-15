import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Upload, FileText, X, CreditCard, Building2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const ManualUpload = () => {
  const [selectedInvoiceFiles, setSelectedInvoiceFiles] = useState<File[]>([]);
  const [selectedBankStatements, setSelectedBankStatements] = useState<File[]>([]);
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

  const handleBankStatementSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    // Filter for bank statement file types
    const allowedTypes = [
      'application/pdf',
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain'
    ];
    
    const validFiles = files.filter(file => {
      if (allowedTypes.includes(file.type)) {
        return true;
      }
      toast({
        variant: "destructive",
        title: "Érvénytelen fájltípus",
        description: `${file.name} nem támogatott fájltípus. Kérlek tölts fel PDF, CSV vagy Excel fájlokat.`
      });
      return false;
    });

    setSelectedBankStatements(prev => [...prev, ...validFiles]);
  };

  const removeInvoiceFile = (index: number) => {
    setSelectedInvoiceFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeBankStatement = (index: number) => {
    setSelectedBankStatements(prev => prev.filter((_, i) => i !== index));
  };

  const handleInvoiceUpload = async () => {
    if (selectedInvoiceFiles.length === 0) {
      toast({
        variant: "destructive",
        title: "Nincs kiválasztott fájl",
        description: "Kérlek válassz ki legalább egy fájlt a feltöltéshez."
      });
      return;
    }

    setUploading(true);
    
    try {
      // TODO: Implement actual invoice file upload logic here
      // For now, just simulate upload
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast({
        title: "Feltöltés sikeres!",
        description: `${selectedInvoiceFiles.length} számla fájl feltöltve és feldolgozásra várakozik.`
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
    if (selectedBankStatements.length === 0) {
      toast({
        variant: "destructive",
        title: "Nincs kiválasztott fájl",
        description: "Kérlek válassz ki legalább egy bank kivonatot a feltöltéshez."
      });
      return;
    }

    if (!user) {
      toast({
        variant: "destructive",
        title: "Nincs bejelentkezve",
        description: "A fájlok feltöltéséhez be kell jelentkezned."
      });
      return;
    }

    setUploading(true);
    
    try {
      for (const file of selectedBankStatements) {
        // Upload file to storage
        const fileName = `${user.id}/${Date.now()}-${file.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('bank-statements')
          .upload(fileName, file);

        if (uploadError) {
          throw uploadError;
        }

        // Create database record
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

        if (dbError) {
          throw dbError;
        }
      }
      
      toast({
        title: "Feltöltés sikeres!",
        description: `${selectedBankStatements.length} bank kivonat feltöltve és feldolgozásra várakozik.`
      });
      
      setSelectedBankStatements([]);
    } catch (error) {
      console.error('Bank statement upload error:', error);
      toast({
        variant: "destructive",
        title: "Feltöltés sikertelen",
        description: "Hiba történt a bank kivonatok feltöltése során. Kérlek próbáld újra."
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
        <h1 className="text-3xl font-bold tracking-tight">Fájl feltöltés</h1>
        <p className="text-muted-foreground">
          Tölts fel számla fájlokat és bank kivonatokat feldolgozásra
        </p>
      </div>

      <Tabs defaultValue="invoices" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="invoices" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Számlák
          </TabsTrigger>
          <TabsTrigger value="bank-statements" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Bank kivonatok
          </TabsTrigger>
        </TabsList>

        {/* Invoice Upload Tab */}
        <TabsContent value="invoices">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
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
                  <p className="text-sm font-medium">Válassz számla fájlokat a feltöltéshez</p>
                  <p className="text-xs text-muted-foreground">
                    Több fájlt is kiválaszthatsz egyszerre vagy egyenként is feltöltheted
                  </p>
                </div>
                <Button 
                  className="mt-4"
                  onClick={() => document.getElementById('invoice-file-input')?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Számla fájlok tallózása
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
                  <h3 className="font-medium">Kiválasztott számla fájlok ({selectedInvoiceFiles.length})</h3>
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
                        Számla feltöltés...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        {selectedInvoiceFiles.length} számla feltöltése
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
                <CreditCard className="h-5 w-5" />
                Bank kivonat feltöltése
              </CardTitle>
              <CardDescription>
                Válassz bank kivonat fájlokat feldolgozásra. Támogatott formátumok: PDF, CSV, Excel (XLS/XLSX), TXT
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-info-subtle border border-info/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Building2 className="h-5 w-5 text-info mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-info-foreground">Támogatott bank kivonatok</p>
                    <p className="text-xs text-info-foreground/80">
                      A rendszer automatikusan feldolgozza a tranzakciókat és kategorizálja őket a könyveléshez.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                <CreditCard className="h-12 w-12 text-muted-foreground mb-4" />
                <div className="space-y-2">
                  <p className="text-sm font-medium">Válassz bank kivonat fájlokat a feltöltéshez</p>
                  <p className="text-xs text-muted-foreground">
                    PDF, CSV, Excel vagy szöveges formátumban
                  </p>
                </div>
                <Button 
                  className="mt-4"
                  onClick={() => document.getElementById('bank-statement-input')?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Bank kivonatok tallózása
                </Button>
                <input
                  id="bank-statement-input"
                  type="file"
                  multiple
                  accept=".pdf,.csv,.xls,.xlsx,.txt"
                  onChange={handleBankStatementSelect}
                  className="hidden"
                />
              </div>

              {selectedBankStatements.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-medium">Kiválasztott bank kivonatok ({selectedBankStatements.length})</h3>
                  <div className="space-y-2">
                    {selectedBankStatements.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <CreditCard className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium text-sm">{file.name}</p>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs">
                                {file.type.includes('csv') ? 'CSV' : 
                                 file.type.includes('excel') || file.type.includes('spreadsheet') ? 'EXCEL' :
                                 file.type.includes('pdf') ? 'PDF' : 'TXT'}
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
                          onClick={() => removeBankStatement(index)}
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
                        Bank kivonat feltöltés...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        {selectedBankStatements.length} bank kivonat feltöltése
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