import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ActivityLogSheet } from './ActivityLogSheet';
import { cn } from '@/lib/utils';

const CURRENCIES = [
  { code: 'HUF', name: 'Magyar Forint', flag: '🇭🇺' },
  { code: 'EUR', name: 'Euró', flag: '🇪🇺' },
  { code: 'USD', name: 'Amerikai Dollár', flag: '🇺🇸' },
  { code: 'GBP', name: 'Brit Font', flag: '🇬🇧' },
  { code: 'CHF', name: 'Svájci Frank', flag: '🇨🇭' },
  { code: 'PLN', name: 'Lengyel Zloty', flag: '🇵🇱' },
  { code: 'CZK', name: 'Cseh Korona', flag: '🇨🇿' },
  { code: 'RON', name: 'Román Lej', flag: '🇷🇴' },
  { code: 'JPY', name: 'Japán Yen', flag: '🇯🇵' },
  { code: 'CNY', name: 'Kínai Yuan', flag: '🇨🇳' },
] as const;

const getFirstName = (fullName: string | undefined): string => {
  if (!fullName) return '';
  const nameParts = fullName.trim().split(' ');
  return nameParts[nameParts.length - 1];
};

const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Jó reggelt';
  if (hour >= 12 && hour < 18) return 'Szép napot';
  return 'Jó estét';
};

interface DashboardWelcomeProps {
  profileName: string | undefined;
  selectedCurrency: string;
  onCurrencyChange: (currency: string) => void;
  showBrutto: boolean;
  onShowBruttoChange: (v: boolean) => void;
}

const DashboardWelcome = React.memo(function DashboardWelcome({
  profileName,
  selectedCurrency,
  onCurrencyChange,
  showBrutto,
  onShowBruttoChange,
}: DashboardWelcomeProps) {
  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-3xl font-bold">{getGreeting()}, {getFirstName(profileName)}!</h2>
          <p className="text-muted-foreground">Itt van a vállalkozásod teljes áttekintése</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <ActivityLogSheet />
          <div className="w-[200px]">
            <Select value={selectedCurrency} onValueChange={onCurrencyChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((curr) => (
                  <SelectItem key={curr.code} value={curr.code}>
                    {curr.flag} {curr.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onShowBruttoChange(false)}
          className={cn(
            "text-base pb-1 border-b-2 transition-all duration-200 cursor-pointer",
            !showBrutto
              ? "text-slate-900 dark:text-white font-semibold border-primary"
              : "text-slate-400 dark:text-slate-500 font-medium border-transparent hover:text-slate-600 dark:hover:text-slate-400"
          )}
        >
          Nettó
        </button>
        <Switch checked={showBrutto} onCheckedChange={onShowBruttoChange} />
        <button
          type="button"
          onClick={() => onShowBruttoChange(true)}
          className={cn(
            "text-base pb-1 border-b-2 transition-all duration-200 cursor-pointer",
            showBrutto
              ? "text-slate-900 dark:text-white font-semibold border-primary"
              : "text-slate-400 dark:text-slate-500 font-medium border-transparent hover:text-slate-600 dark:hover:text-slate-400"
          )}
        >
          Bruttó
        </button>
      </div>
    </>
  );
});

export default DashboardWelcome;
