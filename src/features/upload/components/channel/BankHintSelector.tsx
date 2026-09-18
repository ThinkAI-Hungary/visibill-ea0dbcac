import React from 'react';
import { Landmark } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BANK_HINT_OPTIONS } from '../../config/channelConfigs';
import { useTranslation } from 'react-i18next';
import { BankBadge } from './BankBadge';

interface BankHintSelectorProps {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}

export function BankHintSelector({ value, onChange, disabled }: BankHintSelectorProps) {
  const { t } = useTranslation(['upload']);

  const selectedOption = BANK_HINT_OPTIONS.find(opt => opt.value === (value || 'auto'));

  const autoOption = BANK_HINT_OPTIONS.find(opt => opt.group === 'auto');
  const hungarianBanks = BANK_HINT_OPTIONS.filter(opt => opt.group === 'hungary');
  const fintechBanks = BANK_HINT_OPTIONS.filter(opt => opt.group === 'fintech');
  const otherBanks = BANK_HINT_OPTIONS.filter(opt => opt.group === 'other');

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 border rounded-lg bg-muted/20">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Landmark className="h-4 w-4 text-muted-foreground" />
        <span>{t('upload:selectors.bank_format', 'Bank formátum:')}</span>
      </div>
      <Select
        value={value || 'auto'}
        onValueChange={onChange}
        disabled={disabled}
      >
        <SelectTrigger className="w-full sm:w-[280px] h-9 bg-background">
          <SelectValue placeholder={t('upload:selectors.choose_bank', 'Válassz bankot...')}>
            {selectedOption && (
              <span className="flex items-center gap-2 text-left">
                <BankBadge bank={selectedOption.value} />
                <span className="truncate">
                  {selectedOption.value === 'auto'
                    ? t('upload:selectors.auto_detect', selectedOption.label)
                    : selectedOption.label}
                </span>
              </span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-[320px]">
          {autoOption && (
            <SelectItem value={autoOption.value} textValue={autoOption.label}>
              <span className="flex items-center gap-2.5">
                <BankBadge bank={autoOption.value} />
                <span className="font-medium">
                  {t('upload:selectors.auto_detect', autoOption.label)}
                </span>
                {autoOption.hint && (
                  <span className="text-[10px] text-muted-foreground ml-1">
                    {autoOption.hint}
                  </span>
                )}
              </span>
            </SelectItem>
          )}

          {hungarianBanks.length > 0 && (
            <>
              <div className="px-2 py-1.5 mt-1 border-t border-border/40">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                  {t('upload:selectors.group_hungarian_banks', 'Magyar bankok')}
                </span>
              </div>
              {hungarianBanks.map(opt => (
                <SelectItem key={opt.value} value={opt.value} textValue={opt.label}>
                  <span className="flex items-center gap-2.5">
                    <BankBadge bank={opt.value} />
                    <span>{opt.label}</span>
                  </span>
                </SelectItem>
              ))}
            </>
          )}

          {fintechBanks.length > 0 && (
            <>
              <div className="px-2 py-1.5 mt-1 border-t border-border/40">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                  {t('upload:selectors.group_fintech', 'Fintech')}
                </span>
              </div>
              {fintechBanks.map(opt => (
                <SelectItem key={opt.value} value={opt.value} textValue={opt.label}>
                  <span className="flex items-center gap-2.5">
                    <BankBadge bank={opt.value} />
                    <span>{opt.label}</span>
                  </span>
                </SelectItem>
              ))}
            </>
          )}

          {otherBanks.length > 0 && (
            <>
              <div className="px-2 py-1.5 mt-1 border-t border-border/40">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                  {t('upload:selectors.group_other', 'Kártya / Egyéb')}
                </span>
              </div>
              {otherBanks.map(opt => (
                <SelectItem key={opt.value} value={opt.value} textValue={opt.label}>
                  <span className="flex items-center gap-2.5">
                    <BankBadge bank={opt.value} />
                    <span>{opt.label}</span>
                    {opt.hint && (
                      <span className="text-[10px] text-muted-foreground ml-1">
                        {opt.hint}
                      </span>
                    )}
                  </span>
                </SelectItem>
              ))}
            </>
          )}
        </SelectContent>
      </Select>
      <span className="text-xs text-muted-foreground hidden sm:inline">
        {t('upload:selectors.ai_auto_hint', '(Ha nem választasz, az AI automatikusan felismeri a formátumot)')}
      </span>
    </div>
  );
}
