import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, EyeOff, TestTube } from 'lucide-react';
import type { NavCredentials } from './NavIntegration';

interface NavCredentialsFormProps {
  onCredentialsChange: (credentials: NavCredentials | null) => void;
  onTestConnection: () => void;
  isLoading: boolean;
  isConnected: boolean;
}

export const NavCredentialsForm = ({
  onCredentialsChange,
  onTestConnection,
  isLoading,
  isConnected,
}: NavCredentialsFormProps) => {
  const [formData, setFormData] = useState<NavCredentials>({
    login: '',
    password: '',
    signatureKey: '',
    taxNumber: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showSignatureKey, setShowSignatureKey] = useState(false);
  const [useTestEnvironment, setUseTestEnvironment] = useState(true);

  const handleInputChange = (field: keyof NavCredentials, value: string) => {
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);
    
    // Check if all fields are filled
    const isComplete = Object.values(newFormData).every(v => v.trim() !== '');
    onCredentialsChange(isComplete ? newFormData : null);
  };

  const isFormComplete = Object.values(formData).every(v => v.trim() !== '');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">NAV Hitelesítési Adatok</CardTitle>
        <CardDescription>
          Adja meg NAV technikai felhasználó adatait az integráció használatához
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="nav-login">Login (15 karakter)</Label>
            <Input
              id="nav-login"
              type="text"
              placeholder="pl.: ABC123DEF456GHI"
              value={formData.login}
              onChange={(e) => handleInputChange('login', e.target.value)}
              maxLength={15}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="nav-tax-number">Adószám (8 számjegy)</Label>
            <Input
              id="nav-tax-number"
              type="text"
              placeholder="pl.: 12345678"
              value={formData.taxNumber}
              onChange={(e) => handleInputChange('taxNumber', e.target.value)}
              maxLength={8}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="nav-password">Jelszó</Label>
          <div className="relative">
            <Input
              id="nav-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="NAV technikai felhasználó jelszava"
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full px-3"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="nav-signature-key">Aláírókulcs</Label>
          <div className="relative">
            <Input
              id="nav-signature-key"
              type={showSignatureKey ? 'text' : 'password'}
              placeholder="NAV aláírókulcs"
              value={formData.signatureKey}
              onChange={(e) => handleInputChange('signatureKey', e.target.value)}
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full px-3"
              onClick={() => setShowSignatureKey(!showSignatureKey)}
            >
              {showSignatureKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <TestTube className="h-4 w-4" />
              <Label htmlFor="test-environment">Teszt környezet használata</Label>
            </div>
            <p className="text-sm text-muted-foreground">
              Fejlesztéshez és teszteléshez ajánlott
            </p>
          </div>
          <Switch
            id="test-environment"
            checked={useTestEnvironment}
            onCheckedChange={setUseTestEnvironment}
          />
        </div>

        <Button
          onClick={onTestConnection}
          disabled={!isFormComplete || isLoading}
          className="w-full"
          variant={isConnected ? "secondary" : "default"}
        >
          {isLoading ? "Kapcsolódás..." : isConnected ? "Újra tesztelés" : "Kapcsolat tesztelése"}
        </Button>
      </CardContent>
    </Card>
  );
};