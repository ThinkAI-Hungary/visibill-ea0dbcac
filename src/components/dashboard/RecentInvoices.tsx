import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, FileText } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface Invoice {
  id: string;
  szamlaszam: string;
  elado_nev: string;
  vevo_nev: string;
  brutto_vegosszeg: number;
  kibocsatas_datuma: string;
  statusz: string;
  project_name?: string;
}

interface RecentInvoicesProps {
  invoices: Invoice[];
  onViewInvoice?: (invoice: Invoice) => void;
}

const RecentInvoices = ({ invoices, onViewInvoice }: RecentInvoicesProps) => {
  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'feldolgozva': return 'success';
      case 'feldolgozas_alatt': return 'warning';
      case 'hiba': return 'destructive';
      default: return 'secondary';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'feldolgozva': return 'Feldolgozva';
      case 'feldolgozas_alatt': return 'Feldolgozás alatt';
      case 'hiba': return 'Hiba';
      default: return status;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Legutóbbi számlák
            </CardTitle>
            <CardDescription>Az utoljára feldolgozott számlák áttekintése</CardDescription>
          </div>
          <Button variant="outline" size="sm">
            Összes megtekintése
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {invoices.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Még nincsenek feldolgozott számlák</p>
          </div>
        ) : (
          <div className="space-y-4">
            {invoices.map((invoice) => (
              <div 
                key={invoice.id} 
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium truncate">{invoice.szamlaszam}</h4>
                    <Badge variant={getStatusVariant(invoice.statusz)}>
                      {getStatusLabel(invoice.statusz)}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {invoice.elado_nev} → {invoice.vevo_nev}
                  </p>
                  {invoice.project_name && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Projekt: {invoice.project_name}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {new Date(invoice.kibocsatas_datuma).toLocaleDateString('hu-HU')}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(invoice.brutto_vegosszeg)}</p>
                  </div>
                  {onViewInvoice && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => onViewInvoice(invoice)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RecentInvoices;