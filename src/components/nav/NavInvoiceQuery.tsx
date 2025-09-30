import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Search } from 'lucide-react';
import type { NavQueryParams } from './NavIntegration';

interface NavInvoiceQueryProps {
  queryParams: NavQueryParams;
  onQueryParamsChange: (params: NavQueryParams) => void;
  onQuery: () => void;
  isLoading: boolean;
}

export const NavInvoiceQuery = ({
  queryParams,
  onQueryParamsChange,
  onQuery,
  isLoading,
}: NavInvoiceQueryProps) => {
  const handleChange = (field: keyof NavQueryParams, value: any) => {
    onQueryParamsChange({ ...queryParams, [field]: value });
  };

  const isFormValid = queryParams.invoiceIssueDate;

  // Set default date if not set (today)
  if (!queryParams.invoiceIssueDate) {
    const today = new Date();
    handleChange('invoiceIssueDate', today.toISOString().split('T')[0]);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          <CardTitle className="text-lg">Számla Lekérdezés</CardTitle>
        </div>
        <CardDescription>
          Állítsa be a lekérdezés paramétereit és dátumhatárokat
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="direction">Irány</Label>
            <Select
              value={queryParams.direction}
              onValueChange={(value: 'INBOUND' | 'OUTBOUND') => handleChange('direction', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INBOUND">Bejövő (INBOUND)</SelectItem>
                <SelectItem value="OUTBOUND">Kimenő (OUTBOUND)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="invoice-date">Számla dátuma</Label>
            <Input
              id="invoice-date"
              type="date"
              value={queryParams.invoiceIssueDate || ''}
              onChange={(e) => handleChange('invoiceIssueDate', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground">Környezet</Label>
            <p className="text-sm text-muted-foreground">
              {queryParams.useTestEnvironment ? 'Teszt környezet' : 'Éles környezet'}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Oldal: {queryParams.page} (maximum 100 tétel oldalanként)
          </p>
          
          <Button
            onClick={onQuery}
            disabled={!isFormValid || isLoading}
            className="flex items-center gap-2"
          >
            <Search className="h-4 w-4" />
            {isLoading ? "Keresés..." : "Frissítés"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};