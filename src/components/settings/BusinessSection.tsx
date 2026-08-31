import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Building2, AlertCircle, Info, MapPin, Plus, X, Sparkles } from 'lucide-react';
import { useCompanyLocations } from '@/hooks/useCompanyLocations';
import { useToast } from '@/hooks/use-toast';

interface Company {
  id: string;
  name: string;
  owner_id: string;
  tax_number: string | null;
  address: string | null;
  description?: string | null;
  primary_teaor?: string | null;
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
  companyDescription: string;
  setCompanyDescription: (v: string) => void;
  companyPrimaryTeaor: string;
  setCompanyPrimaryTeaor: (v: string) => void;
  isGeneratingDescription: boolean;
  onGenerateDescription: () => void;
  savingCompany: boolean;
  onSave: () => void;
  companies: Company[];
  setSelectedCompany: (c: Company) => void;
  children?: React.ReactNode; // CompanyAccessCard + CompanyMembersCard
}

export function BusinessSection({
  selectedCompany, userId, companyName, setCompanyName,
  companyTaxNumber, setCompanyTaxNumber, companyAddress, setCompanyAddress,
  companyDescription, setCompanyDescription, companyPrimaryTeaor, setCompanyPrimaryTeaor,
  isGeneratingDescription, onGenerateDescription,
  savingCompany, onSave, companies, setSelectedCompany, children,
}: Props) {
  const isOwner = selectedCompany?.owner_id === userId;
  const { toast } = useToast();
  const { locations, isLoading: locationsLoading, addLocation, deleteLocation } = useCompanyLocations(selectedCompany?.id);

  // New location form state
  const [showNewLocation, setShowNewLocation] = useState(false);
  const [newLocationName, setNewLocationName] = useState('');
  const [newLocationAddress, setNewLocationAddress] = useState('');
  const [addingLocation, setAddingLocation] = useState(false);

  const handleAddLocation = async () => {
    if (!newLocationName.trim() || !newLocationAddress.trim()) return;
    setAddingLocation(true);
    try {
      await addLocation.mutateAsync({
        name: newLocationName.trim(),
        address: newLocationAddress.trim(),
        location_type: 'branch',
      });
      toast({ title: 'Siker', description: 'Telephely sikeresen hozzáadva.' });
      setNewLocationName('');
      setNewLocationAddress('');
      setShowNewLocation(false);
    } catch {
      toast({ title: 'Hiba', description: 'Nem sikerült a telephely hozzáadása.', variant: 'destructive' });
    } finally {
      setAddingLocation(false);
    }
  };

  const handleDeleteLocation = async (locationId: string) => {
    try {
      await deleteLocation.mutateAsync(locationId);
      toast({ title: 'Siker', description: 'Telephely eltávolítva.' });
    } catch {
      toast({ title: 'Hiba', description: 'Nem sikerült a telephely törlése.', variant: 'destructive' });
    }
  };

  // Filter locations for display (branches only — headquarters shown as the main address)
  const branchLocations = locations.filter(l => l.location_type === 'branch');

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
                <Label htmlFor="company_address">Székhely</Label>
                <Textarea id="company_address" value={companyAddress} onChange={e => setCompanyAddress(e.target.value)} placeholder="Pl. 1234 Budapest, Példa utca 1." rows={3} disabled={!isOwner} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company_teaor">Elsődleges TEÁOR kód</Label>
                  <Input id="company_teaor" value={companyPrimaryTeaor} onChange={e => setCompanyPrimaryTeaor(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="Pl. 6201" maxLength={4} disabled={!isOwner} />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="company_description">Cég tevékenységének bemutatása (AI alapú kontírozáshoz)</Label>
                  {isOwner && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-primary hover:text-primary/80 gap-1 px-2"
                      onClick={onGenerateDescription}
                      disabled={isGeneratingDescription || !companyPrimaryTeaor.trim()}
                    >
                      <Sparkles className={`h-3.5 w-3.5 ${isGeneratingDescription ? 'animate-spin' : ''}`} />
                      {isGeneratingDescription ? 'Generálás...' : 'Generálás AI-al'}
                    </Button>
                  )}
                </div>
                <Textarea id="company_description" value={companyDescription} onChange={e => setCompanyDescription(e.target.value)} placeholder="Mutasd be röviden a cég tevékenységét és üzletmenetét a pontosabb automatikus könyvelés érdekében..." rows={3} disabled={!isOwner} />
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

      {/* Telephelyek szekció */}
      {selectedCompany && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Telephelyek
                </CardTitle>
                <CardDescription>A céghez tartozó telephelyek és fióktelepek kezelése</CardDescription>
              </div>
              {isOwner && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setShowNewLocation(!showNewLocation)}
                >
                  <Plus className="h-4 w-4" />
                  Új telephely
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* New location form */}
            {showNewLocation && isOwner && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                <p className="text-sm font-semibold">Új telephely hozzáadása</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="new_location_name" className="text-sm">Telephely neve *</Label>
                    <Input
                      id="new_location_name"
                      value={newLocationName}
                      onChange={e => setNewLocationName(e.target.value)}
                      placeholder="Pl. Debreceni Raktár"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new_location_address" className="text-sm">Cím *</Label>
                    <Input
                      id="new_location_address"
                      value={newLocationAddress}
                      onChange={e => setNewLocationAddress(e.target.value)}
                      placeholder="Pl. 4032 Debrecen, Ipari utca 5."
                      className="h-9"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={!newLocationName.trim() || !newLocationAddress.trim() || addingLocation}
                    onClick={handleAddLocation}
                  >
                    {addingLocation ? 'Hozzáadás...' : 'Hozzáadás'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { setShowNewLocation(false); setNewLocationName(''); setNewLocationAddress(''); }}>
                    Mégse
                  </Button>
                </div>
              </div>
            )}

            {/* Existing locations list */}
            {locationsLoading ? (
              <p className="text-sm text-muted-foreground">Betöltés...</p>
            ) : locations.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nincsenek telephelyek hozzáadva.</p>
            ) : (
              <div className="space-y-2">
                {locations.map(location => (
                  <div
                    key={location.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        location.location_type === 'headquarters'
                          ? 'bg-primary/10 text-primary'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        <MapPin className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {location.name}
                          {location.location_type === 'headquarters' && (
                            <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                              Székhely
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">{location.address}</p>
                      </div>
                    </div>
                    {isOwner && location.location_type !== 'headquarters' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive opacity-50 hover:opacity-100"
                        onClick={() => handleDeleteLocation(location.id)}
                        title="Telephely törlése"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
