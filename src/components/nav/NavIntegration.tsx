import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Shield, Building, Download } from 'lucide-react';
import { NavCredentialsForm } from './NavCredentialsForm';
import { NavInvoiceQuery } from './NavInvoiceQuery';
import { NavInvoicesTable } from './NavInvoicesTable';
import { NavInvoiceViewer } from './NavInvoiceViewer';
import { useToast } from '@/hooks/use-toast';

export type NavCredentials = {
  login: string;
  password: string;
  signatureKey: string;
  taxNumber: string;
};

export type NavQueryParams = {
  direction: 'INBOUND' | 'OUTBOUND';
  page: number;
  invoiceIssueDate?: string;
  useTestEnvironment: boolean;
};

export type NavInvoiceDigest = {
  invoiceNumber: string;
  supplierTaxNumber: string;
  customerTaxNumber: string;
  invoiceOperation: string;
  insDate: string;
};

const NavIntegration = () => {
  const [credentials, setCredentials] = useState<NavCredentials | null>(null);
  const [queryParams, setQueryParams] = useState<NavQueryParams>({
    direction: 'INBOUND',
    page: 1,
    invoiceIssueDate: new Date().toISOString().split('T')[0], // Initialize with today's date
    useTestEnvironment: true,
  });
  const [invoices, setInvoices] = useState<NavInvoiceDigest[]>([]);
  const [pagination, setPagination] = useState({ currentPage: 1, availablePage: 1 });
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);
  const { toast } = useToast();

  const testConnection = async () => {
    if (!credentials) return;
    
    setIsLoading(true);
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      
      const payload = {
        ...credentials,
        action: 'list',
        test: queryParams.useTestEnvironment,
        direction: 'INBOUND',
        page: 1,
        issueDateFrom: new Date().toISOString().split('T')[0],
        issueDateTo: new Date().toISOString().split('T')[0],
      };

      const { data, error } = await supabase.functions.invoke('nav', {
        body: payload,
      });

      if (error) {
        throw new Error(`Supabase function error: ${error.message}`);
      }

      if (data?.success) {
        setIsConnected(true);
        toast({
          title: "Sikeres kapcsolódás",
          description: "NAV API kapcsolat sikeresen létrejött",
        });
      } else {
        throw new Error(data?.error || data?.errorCode || 'Kapcsolódási hiba');
      }
    } catch (error) {
      console.error('NAV connection test failed:', error);
      toast({
        title: "Kapcsolódási hiba",
        description: error instanceof Error ? error.message : "Nem sikerült kapcsolódni a NAV API-hoz",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const queryInvoices = async () => {
    if (!credentials || !queryParams.invoiceIssueDate) {
      toast({
        title: "Hiányzó adatok",
        description: "Kérjük, töltse ki az összes kötelező mezőt",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      
      const payload = {
        ...credentials,
        ...queryParams,
        action: 'list',
        test: queryParams.useTestEnvironment,
        store_data: false,
        // Map invoiceIssueDate to date range for backend compatibility
        issueDateFrom: queryParams.invoiceIssueDate,
        issueDateTo: queryParams.invoiceIssueDate,
      };

      const { data, error } = await supabase.functions.invoke('nav', {
        body: payload,
      });

      if (error) {
        throw new Error(`Supabase function error: ${error.message}`);
      }

      if (data?.success) {
        setInvoices(data.invoices || []);
        setPagination({
          currentPage: data.currentPage || 1,
          availablePage: data.availablePage || 1,
        });

        toast({
          title: "Sikeres lekérdezés",
          description: `${data.invoices?.length || 0} számla található`,
        });
      } else {
        throw new Error(data?.error || 'Lekérdezési hiba');
      }
    } catch (error) {
      console.error('NAV query failed:', error);
      toast({
        title: "Lekérdezési hiba",
        description: error instanceof Error ? error.message : "Nem sikerült lekérdezni a számlákat",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Building className="h-6 w-6 text-primary" />
          </div>
          <div>
            <CardTitle className="text-xl">NAV Online Számla Integráció</CardTitle>
            <CardDescription>
              Közvetlen kapcsolat a NAV Online Számla rendszerrel
            </CardDescription>
          </div>
          {isConnected && (
            <Badge variant="secondary" className="ml-auto flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Csatlakoztatva
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Features */}
        <div className="grid md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <Shield className="h-5 w-5 text-green-600" />
            <div>
              <p className="font-medium text-sm">Biztonságos</p>
              <p className="text-xs text-muted-foreground">Server-side aláírás</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <FileText className="h-5 w-5 text-blue-600" />
            <div>
              <p className="font-medium text-sm">Valós idejű</p>
              <p className="text-xs text-muted-foreground">NAV API v3.0</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <Download className="h-5 w-5 text-purple-600" />
            <div>
              <p className="font-medium text-sm">XML Export</p>
              <p className="text-xs text-muted-foreground">Teljes számla adatok</p>
            </div>
          </div>
        </div>

        {/* Credentials Form */}
        <NavCredentialsForm
          onCredentialsChange={setCredentials}
          onTestConnection={testConnection}
          isLoading={isLoading}
          isConnected={isConnected}
        />

        {/* Query Section */}
        {isConnected && (
          <>
            <NavInvoiceQuery
              queryParams={queryParams}
              onQueryParamsChange={setQueryParams}
              onQuery={queryInvoices}
              isLoading={isLoading}
            />

            {/* Results */}
            {invoices.length > 0 && (
              <NavInvoicesTable
                invoices={invoices}
                pagination={pagination}
                onPageChange={(page) => setQueryParams(prev => ({ ...prev, page }))}
                onViewInvoice={setSelectedInvoice}
                isLoading={isLoading}
              />
            )}
          </>
        )}

        {/* Invoice Viewer Modal */}
        {selectedInvoice && (
          <NavInvoiceViewer
            invoiceNumber={selectedInvoice}
            credentials={credentials}
            queryParams={queryParams}
            onClose={() => setSelectedInvoice(null)}
          />
        )}
      </CardContent>
    </Card>
  );
};

export default NavIntegration;