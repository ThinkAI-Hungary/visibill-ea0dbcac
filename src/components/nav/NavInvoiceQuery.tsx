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

  const isFormValid = queryParams.issueDateFrom && queryParams.issueDateTo;

  // Set default dates if not set (last 30 days)
  if (!queryParams.issueDateFrom || !queryParams.issueDateTo) {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    if (!queryParams.issueDateFrom) {
      handleChange('issueDateFrom', thirtyDaysAgo.toISOString().split('T')[0]);
    }
    if (!queryParams.issueDateTo) {
      handleChange('issueDateTo', today.toISOString().split('T')[0]);
    }
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
            <Label htmlFor="date-from">Dátum kezdete</Label>
            <Input
              id="date-from"
              type="date"
              value={queryParams.issueDateFrom || ''}
              onChange={(e) => handleChange('issueDateFrom', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date-to">Dátum vége</Label>
            <Input
              id="date-to"
              type="date"
              value={queryParams.issueDateTo || ''}
              onChange={(e) => handleChange('issueDateTo', e.target.value)}
            />
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