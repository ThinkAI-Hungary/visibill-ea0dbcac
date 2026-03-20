import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Building2, AlertCircle, Info } from 'lucide-react';

interface Company {
  id: string;
  name: string;
  owner_id: string;
  tax_number: string | null;
  address: string | null;
  created_at: string;
}

interface Props {
  selectedCompany: Company | null;
  userId: string | undefined;
  companyName: string;
  setCompanyName: (v: string) => void;
  companyTaxNumber: string;
  setCompanyTaxNumber: (v: string) => void;
  companyAddress: string;
  setCompanyAddress: (v: string) => void;
  savingCompany: boolean;
  onSave: () => void;
  companies: Company[];
  setSelectedCompany: (c: Company) => void;
  children?: React.ReactNode; // CompanyAccessCard + CompanyMembersCard
}

export function BusinessSection({
  selectedCompany, userId, companyName, setCompanyName,
  companyTaxNumber, setCompanyTaxNumber, companyAddress, setCompanyAddress,
  savingCompany, onSave, companies, setSelectedCompany, children,
}: Props) {
  const isOwner = selectedCompany?.owner_id === userId;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Kiválasztott cég adatai
          </CardTitle>
          <CardDescription>
            {selectedCompany ? (
              <>Az aktuálisan kiválasztott cég: <strong>{selectedCompany.name}</strong></>
            ) : 'Válassz céget a felső menüből'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!selectedCompany ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Nincs kiválasztott cég. A cég adatainak szerkesztéséhez válassz egy céget a felső menüből.</AlertDescription>
            </Alert>
          ) : (
            <>
              {!isOwner && (
                <Alert className="mb-4">
                  <Info className="h-4 w-4" />
                  <AlertDescription>Csak a tulajdonos szerkesztheti a cég adatait.</AlertDescription>
                </Alert>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company_name">Cég neve *</Label>
                  <Input id="company_name" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Pl. Példa Kft." disabled={!isOwner} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tax_number">Adószám</Label>
                  <Input id="tax_number" value={companyTaxNumber} onChange={e => setCompanyTaxNumber(e.target.value)} placeholder="Pl. 12345678-2-42" disabled={!isOwner} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_address">Cím</Label>
                <Textarea id="company_address" value={companyAddress} onChange={e => setCompanyAddress(e.target.value)} placeholder="Pl. 1234 Budapest, Példa utca 1." rows={3} disabled={!isOwner} />
              </div>
              <div className="flex items-center gap-4 pt-2">
                {isOwner && (
                  <Button onClick={onSave} disabled={!companyName.trim() || savingCompany}>
                    {savingCompany ? 'Mentés...' : 'Cég adatainak mentése'}
                  </Button>
                )}
                <p className="text-sm text-muted-foreground">
                  Létrehozva: {new Date(selectedCompany.created_at).toLocaleDateString('hu-HU')}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {children}

      {companies.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Összes cég áttekintése</CardTitle>
            <CardDescription>A fiókodhoz tartozó összes cég</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {companies.map(company => (
                <div
                  key={company.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    selectedCompany?.id === company.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <div>
                    <p className="font-medium">{company.name}</p>
                    <p className="text-sm text-muted-foreground">{company.tax_number || 'Nincs adószám megadva'}</p>
                  </div>
                  {selectedCompany?.id !== company.id ? (
                    <Button variant="outline" size="sm" onClick={() => setSelectedCompany(company)}>Kiválasztás</Button>
                  ) : (
                    <span className="text-sm text-primary font-medium">Aktív</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
