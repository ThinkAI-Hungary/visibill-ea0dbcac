import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Palette } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
  const { t, i18n } = useTranslation(['settings', 'common']);
  const currentLang = i18n.language?.startsWith('hr') ? 'hr' : 'hu';

  const handleLanguageChange = (val: string) => {
    i18n.changeLanguage(val);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          {t('system.title', { defaultValue: 'Rendszer beállítások' })}
        </CardTitle>
        <CardDescription>{t('system.subtitle', { defaultValue: 'Téma és megjelenítési beállítások' })}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="theme">{t('system.theme', { defaultValue: 'Téma' })}</Label>
            <Select value={systemSettings.theme} onValueChange={onThemeChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="light">{t('system.theme_light', { defaultValue: 'Világos' })}</SelectItem>
                <SelectItem value="dark">{t('system.theme_dark', { defaultValue: 'Sötét' })}</SelectItem>
                <SelectItem value="system">{t('system.theme_system', { defaultValue: 'Rendszer' })}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="language">{t('system.language', { defaultValue: 'Nyelv' })}</Label>
            <Select value={currentLang} onValueChange={handleLanguageChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hu">🇭🇺 {t('system.language_hu', { defaultValue: 'Magyar (HU)' })}</SelectItem>
                <SelectItem value="hr">🇭🇷 {t('system.language_hr', { defaultValue: 'Hrvatski (HR)' })}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="date_format">{t('system.date_format', { defaultValue: 'Dátum formátum' })}</Label>
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
            <Label htmlFor="number_format">{t('system.number_format', { defaultValue: 'Szám formátum' })}</Label>
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
        <Button onClick={onSave} disabled={loading}>{t('system.save_button', { defaultValue: 'Rendszer beállítások mentése' })}</Button>
      </CardContent>
    </Card>
  );
}
