import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Download, FileText, Code } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { NavCredentials, NavQueryParams } from './NavIntegration';

interface NavInvoiceViewerProps {
  invoiceNumber: string;
  credentials: NavCredentials | null;
  queryParams: NavQueryParams;
  onClose: () => void;
}

export const NavInvoiceViewer = ({
  invoiceNumber,
  credentials,
  queryParams,
  onClose,
}: NavInvoiceViewerProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [invoiceData, setInvoiceData] = useState<{
    rawXml: string;
    invoiceXml: string | null;
  } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (invoiceNumber && credentials) {
      fetchInvoiceData();
    }
  }, [invoiceNumber, credentials]);

  const fetchInvoiceData = async () => {
    if (!credentials) return;

    setIsLoading(true);
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      
      const searchParams = new URLSearchParams({
        action: 'data',
        test: queryParams.useTestEnvironment.toString(),
      });
      
      const response = await fetch(`https://vxxgvdlqvvchtlmqnrqf.supabase.co/functions/v1/nav?${searchParams}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5NzAwNTAsImV4cCI6MjA3MzU0NjA1MH0.Ec9KFcjt89cY6FF9Nq9GnW1hzlnDUhQCCJ_LhWm2evY`,
        },
        body: JSON.stringify({
          ...credentials,
          direction: queryParams.direction,
          invoiceNumber,
        }),
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Network error');

      if (!data?.ok) throw new Error(data?.error || 'Nem sikerült lekérni a számla adatokat');

      setInvoiceData({
        rawXml: data.rawXml,
        invoiceXml: data.invoiceXml,
      });
    } catch (error) {
      console.error('Failed to fetch invoice data:', error);
      toast({
        title: "Hiba",
        description: error instanceof Error ? error.message : "Nem sikerült lekérni a számla adatokat",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const downloadXml = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const formatXml = (xmlString: string) => {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlString, 'application/xml');
      const serializer = new XMLSerializer();
      let formatted = serializer.serializeToString(xmlDoc);
      
      // Simple formatting
      formatted = formatted.replace(/></g, '>\n<');
      return formatted;
    } catch {
      return xmlString;
    }
  };

  return (
    <Dialog open={!!invoiceNumber} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Számla XML adatok
              </DialogTitle>
              <DialogDescription>
                Számlaszám: <Badge variant="secondary">{invoiceNumber}</Badge>
              </DialogDescription>
            </div>
            
            {invoiceData && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadXml(invoiceData.rawXml, `nav-response-${invoiceNumber}.xml`)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  NAV válasz
                </Button>
                {invoiceData.invoiceXml && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadXml(invoiceData.invoiceXml!, `invoice-${invoiceNumber}.xml`)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Számla XML
                  </Button>
                )}
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Számla adatok betöltése...</span>
            </div>
          ) : invoiceData ? (
            <Tabs defaultValue="invoice" className="h-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="invoice" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Számla XML
                </TabsTrigger>
                <TabsTrigger value="raw" className="flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  NAV válasz
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="invoice" className="h-[500px] mt-4">
                {invoiceData.invoiceXml ? (
                  <Textarea
                    value={formatXml(invoiceData.invoiceXml)}
                    readOnly
                    className="h-full font-mono text-sm resize-none"
                    placeholder="Számla XML tartalma..."
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    Nincs elérhető számla XML adat
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="raw" className="h-[500px] mt-4">
                <Textarea
                  value={formatXml(invoiceData.rawXml)}
                  readOnly
                  className="h-full font-mono text-sm resize-none"
                  placeholder="NAV API válasz XML tartalma..."
                />
              </TabsContent>
            </Tabs>
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              Nem sikerült betölteni a számla adatokat
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};