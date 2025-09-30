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
  issueDateFrom?: string;
  issueDateTo?: string;
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
      
      const searchParams = new URLSearchParams({
        action: 'list',
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
          direction: 'INBOUND',
          page: 1,
          issueDateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          issueDateTo: new Date().toISOString().split('T')[0],
        }),
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Network error');

      if (!data?.ok) throw new Error(data?.error || 'Kapcsolódási hiba');

      setIsConnected(true);
      toast({
        title: "Sikeres kapcsolódás",
        description: "NAV API kapcsolat sikeresen létrejött",
      });
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
    if (!credentials || !queryParams.issueDateFrom || !queryParams.issueDateTo) {
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
      
      const searchParams = new URLSearchParams({
        action: 'list',
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
          ...queryParams,
        }),
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Network error');

      if (!data?.ok) throw new Error(data?.error || 'Lekérdezési hiba');

      setInvoices(data.items || []);
      setPagination({
        currentPage: data.currentPage || 1,
        availablePage: data.availablePage || 1,
      });

      toast({
        title: "Sikeres lekérdezés",
        description: `${data.items?.length || 0} számla található`,
      });
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