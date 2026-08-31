import React from 'react';
import { Calculator, Settings2, AlertTriangle } from 'lucide-react';
import { useCompany } from '@/contexts/CompanyContext';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { VatCodeConfigTab } from '@/components/vat/VatCodeConfigTab';
import { VatReturnViewTab } from './VatReturnViewTab';

class VatReturnErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <Card className="border-destructive/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-destructive mb-2">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-medium">Hiba történt a renderelés során</span>
            </div>
            <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-40">
              {this.state.error.message}
              {'\n'}
              {this.state.error.stack}
            </pre>
            <Button
              className="mt-3"
              variant="outline"
              size="sm"
              onClick={() => this.setState({ error: null })}
            >
              Újrapróbálás
            </Button>
          </CardContent>
        </Card>
      );
    }
    return this.props.children;
  }
}

export function VatReturnContainer() {
  const { selectedCompany } = useCompany();

  if (!selectedCompany) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Válassz céget a folytatáshoz</p>
      </div>
    );
  }

  return (
    <div className="container max-w-7xl py-6 space-y-6 print:py-0 page-animate">
      <PageHeader
        companyName={selectedCompany?.name}
        breadcrumb="ÁFA Bevallás (2665)"
        title="ÁFA Bevallás"
        description="2665-ös nyomtatvány — havi, negyedéves és éves ÁFA bevallás generálás"
      />

      <Tabs defaultValue="return" className="space-y-4">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger
            value="return"
            className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Calculator className="w-4 h-4" /> Bevallás
          </TabsTrigger>
          <TabsTrigger
            value="config"
            className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Settings2 className="w-4 h-4" /> Beállítás
          </TabsTrigger>
        </TabsList>
        <TabsContent value="return">
          <VatReturnErrorBoundary>
            <VatReturnViewTab />
          </VatReturnErrorBoundary>
        </TabsContent>
        <TabsContent value="config">
          <VatCodeConfigTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
