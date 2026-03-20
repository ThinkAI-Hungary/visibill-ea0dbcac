import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Palette } from 'lucide-react';

interface SystemSettings {
  theme: string;
  language: string;
  date_format: string;
  number_format: string;
  timezone: string;
}

interface Props {
  systemSettings: SystemSettings;
  onThemeChange: (value: string) => void;
  onSave: () => void;
  loading: boolean;
}

export function SystemSection({ systemSettings, onThemeChange, onSave, loading }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          Rendszer beállítások
        </CardTitle>
        <CardDescription>Téma és megjelenítési beállítások</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="theme">Téma</Label>
            <Select value={systemSettings.theme} onValueChange={onThemeChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Világos</SelectItem>
                <SelectItem value="dark">Sötét</SelectItem>
                <SelectItem value="system">Rendszer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="language">Nyelv</Label>
            <Select disabled value={systemSettings.language}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hu">Magyar</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="date_format">Dátum formátum</Label>
            <Select disabled value={systemSettings.date_format}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="number_format">Szám formátum</Label>
            <Select disabled value={systemSettings.number_format}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1 234 567,89">1 234 567,89</SelectItem>
                <SelectItem value="1,234,567.89">1,234,567.89</SelectItem>
                <SelectItem value="1.234.567,89">1.234.567,89</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={onSave} disabled={loading}>Rendszer beállítások mentése</Button>
      </CardContent>
    </Card>
  );
}
