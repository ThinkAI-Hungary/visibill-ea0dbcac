import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Shield, Key, Building } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface NavCredentialsFormProps {
  onCredentialsSaved?: () => void;
}

const NavCredentialsForm: React.FC<NavCredentialsFormProps> = ({ onCredentialsSaved }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState<'pending' | 'valid' | 'invalid' | 'error'>('pending');
  
  const [formData, setFormData] = useState({
    nav_username: '',
    nav_password: '',
    nav_tax_number: '',
    nav_sign_key: '',
    nav_exchange_key: '',
    software_dev_name: '',
    software_dev_contact: '',
    is_test_environment: true
  });

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setValidationStatus('pending');
  };

  const validateForm = () => {
    const errors: string[] = [];
    
    if (!formData.nav_username.trim()) errors.push('NAV felhasználónév kötelező');
    if (!formData.nav_password.trim()) errors.push('NAV jelszó kötelező');
    if (!formData.nav_tax_number.match(/^\d{8}$/)) errors.push('Adószám 8 számjegy kell legyen');
    if (!formData.nav_sign_key.trim()) errors.push('Aláíró kulcs kötelező');
    if (!formData.nav_exchange_key.trim()) errors.push('Csere kulcs kötelező');
    
    return errors;
  };

  const handleSave = async () => {
    const errors = validateForm();
    if (errors.length > 0) {
      toast({
        title: 'Hiányos adatok',
        description: errors.join(', '),
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('save-credentials', {
        body: {
          navUsername: formData.nav_username,
          navPassword: formData.nav_password,
          navTaxNumber: formData.nav_tax_number,
          navSignKey: formData.nav_sign_key,
          navExchangeKey: formData.nav_exchange_key,
          softwareDevName: formData.software_dev_name || null,
          softwareDevContact: formData.software_dev_contact || null,
          isTestEnvironment: formData.is_test_environment
        }
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      toast({
        title: 'Sikeres mentés',
        description: 'NAV hitelesítő adatok sikeresen mentve',
      });

      setValidationStatus('pending');
      onCredentialsSaved?.();

    } catch (error: any) {
      console.error('Error saving credentials:', error);
      toast({
        title: 'Mentési hiba',
        description: error.message || 'Nem sikerült menteni az adatokat',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async () => {
    if (validationStatus === 'pending') {
      toast({
        title: 'Előbb mentse az adatokat',
        description: 'A validálás előtt mentse el a hitelesítő adatokat',
        variant: 'destructive'
      });
      return;
    }

    setValidating(true);
    try {
      const { data, error } = await supabase.functions.invoke('nav-token', {
        body: { action: 'validate_credentials' }
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const result = data;
      
      if (result.success) {
        setValidationStatus(result.status);
        toast({
          title: result.status === 'valid' ? 'Sikeres validálás' : 'Validálási hiba',
          description: result.message,
          variant: result.status === 'valid' ? 'default' : 'destructive'
        });
      } else {
        throw new Error(result.error);
      }

    } catch (error: any) {
      console.error('Validation error:', error);
      setValidationStatus('error');
      toast({
        title: 'Validálási hiba',
        description: error.message || 'Nem sikerült validálni a hitelesítő adatokat',
        variant: 'destructive'
      });
    } finally {
      setValidating(false);
    }
  };

  const getStatusBadge = () => {
    switch (validationStatus) {
      case 'valid':
        return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Érvényes</Badge>;
      case 'invalid':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Érvénytelen</Badge>;
      case 'error':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Hiba</Badge>;
      default:
        return <Badge variant="secondary">Validálásra vár</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <CardTitle>NAV API Hitelesítő Adatok</CardTitle>
          </div>
          {getStatusBadge()}
        </div>
        <CardDescription>
          Adja meg a NAV online számla rendszer API hozzáférési adatait
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Environment Toggle */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center gap-2">
            <Building className="w-4 h-4" />
            <Label htmlFor="environment">Teszt környezet</Label>
          </div>
          <Switch
            id="environment"
            checked={formData.is_test_environment}
            onCheckedChange={(checked) => handleInputChange('is_test_environment', checked)}
          />
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {formData.is_test_environment 
              ? 'Teszt környezet: A teszteléshez használja a NAV teszt API adatait'
              : 'Éles környezet: Valós NAV API adatok szükségesek'
            }
          </AlertDescription>
        </Alert>

        {/* Basic Credentials */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="username">NAV Felhasználónév</Label>
            <Input
              id="username"
              type="text"
              value={formData.nav_username}
              onChange={(e) => handleInputChange('nav_username', e.target.value)}
              placeholder="NAV felhasználónév"
            />
          </div>
          
          <div>
            <Label htmlFor="taxNumber">Adószám</Label>
            <Input
              id="taxNumber"
              type="text"
              value={formData.nav_tax_number}
              onChange={(e) => handleInputChange('nav_tax_number', e.target.value)}
              placeholder="12345678"
              maxLength={8}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="password">NAV Jelszó</Label>
          <Input
            id="password"
            type="password"
            value={formData.nav_password}
            onChange={(e) => handleInputChange('nav_password', e.target.value)}
            placeholder="NAV jelszó"
          />
        </div>

        {/* API Keys */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4" />
            <Label className="text-sm font-medium">API Kulcsok</Label>
          </div>
          
          <div>
            <Label htmlFor="signKey">Aláíró Kulcs</Label>
            <Input
              id="signKey"
              type="password"
              value={formData.nav_sign_key}
              onChange={(e) => handleInputChange('nav_sign_key', e.target.value)}
              placeholder="Aláíró kulcs"
            />
          </div>
          
          <div>
            <Label htmlFor="exchangeKey">Csere Kulcs</Label>
            <Input
              id="exchangeKey"
              type="password"
              value={formData.nav_exchange_key}
              onChange={(e) => handleInputChange('nav_exchange_key', e.target.value)}
              placeholder="Csere kulcs"
            />
          </div>
        </div>

        {/* Optional Developer Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="devName">Fejlesztő Név (opcionális)</Label>
            <Input
              id="devName"
              type="text"
              value={formData.software_dev_name}
              onChange={(e) => handleInputChange('software_dev_name', e.target.value)}
              placeholder="Cég/fejlesztő neve"
            />
          </div>
          
          <div>
            <Label htmlFor="devContact">Fejlesztő Elérhetőség (opcionális)</Label>
            <Input
              id="devContact"
              type="email"
              value={formData.software_dev_contact}
              onChange={(e) => handleInputChange('software_dev_contact', e.target.value)}
              placeholder="email@example.com"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <Button
            onClick={handleSave}
            disabled={loading}
            className="flex-1"
          >
            {loading ? 'Mentés...' : 'Adatok Mentése'}
          </Button>
          
          <Button
            variant="outline"
            onClick={handleValidate}
            disabled={validating || validationStatus === 'pending'}
            className="flex-1"
          >
            {validating ? 'Validálás...' : 'Kapcsolat Tesztelése'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default NavCredentialsForm;