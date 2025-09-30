import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Eye, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import type { NavInvoiceDigest } from './NavIntegration';

interface NavInvoicesTableProps {
  invoices: NavInvoiceDigest[];
  pagination: { currentPage: number; availablePage: number };
  onPageChange: (page: number) => void;
  onViewInvoice: (invoiceNumber: string) => void;
  isLoading: boolean;
}

export const NavInvoicesTable = ({
  invoices,
  pagination,
  onPageChange,
  onViewInvoice,
  isLoading,
}: NavInvoicesTableProps) => {
  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('hu-HU');
    } catch {
      return dateString;
    }
  };

  const getOperationBadge = (operation: string) => {
    const operationMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
      'CREATE': { label: 'Létrehozás', variant: 'default' },
      'MODIFY': { label: 'Módosítás', variant: 'secondary' },
      'STORNO': { label: 'Stornó', variant: 'destructive' },
    };
    
    const config = operationMap[operation] || { label: operation, variant: 'secondary' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            <CardTitle className="text-lg">Találatok</CardTitle>
          </div>
          <CardDescription>
            {invoices.length} tétel (oldal {pagination.currentPage}/{pagination.availablePage})
          </CardDescription>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Számlaszám</TableHead>
                <TableHead>Eladó adószám</TableHead>
                <TableHead>Vevő adószám</TableHead>
                <TableHead>Művelet</TableHead>
                <TableHead>Rögzítés dátuma</TableHead>
                <TableHead className="text-right">Művelet</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nincsenek találatok a megadott feltételekkel
                  </TableCell>
                </TableRow>
              ) : (
                invoices.map((invoice, index) => (
                  <TableRow key={`${invoice.invoiceNumber}-${index}`}>
                    <TableCell className="font-medium">
                      {invoice.invoiceNumber}
                    </TableCell>
                    <TableCell>{invoice.supplierTaxNumber}</TableCell>
                    <TableCell>{invoice.customerTaxNumber}</TableCell>
                    <TableCell>
                      {getOperationBadge(invoice.invoiceOperation)}
                    </TableCell>
                    <TableCell>{formatDate(invoice.insDate)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onViewInvoice(invoice.invoiceNumber)}
                        className="flex items-center gap-2"
                      >
                        <Eye className="h-4 w-4" />
                        XML megtekintés
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {pagination.availablePage > 1 && (
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Oldal {pagination.currentPage} / {pagination.availablePage}
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(pagination.currentPage - 1)}
                disabled={pagination.currentPage <= 1 || isLoading}
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Előző
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(pagination.currentPage + 1)}
                disabled={pagination.currentPage >= pagination.availablePage || isLoading}
              >
                Következő
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};