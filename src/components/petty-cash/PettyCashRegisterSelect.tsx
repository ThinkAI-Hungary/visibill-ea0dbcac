import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Wallet, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PettyCashRegister } from './types';

export interface PettyCashRegisterSelectProps {
  companyId: string;
  value?: string | null;
  onChange: (registerId: string | null, registerName?: string) => void;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
  placeholder?: string;
}

export function PettyCashRegisterSelect({
  companyId,
  value,
  onChange,
  disabled = false,
  className,
  compact = false,
  placeholder,
}: PettyCashRegisterSelectProps) {
  const { t } = useTranslation(['pettyCash', 'common', 'invoices']);

  const { data: registers = [], isLoading } = useQuery({
    queryKey: queryKeys.pettyCashRegisters(companyId),
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('petty_cash_registers')
        .select('*')
        .eq('company_id', companyId)
        .order('is_default', { ascending: false })
        .order('name', { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as PettyCashRegister[];
    },
    enabled: !!companyId,
    staleTime: 60_000,
  });

  const selectedRegister = useMemo(() => {
    if (!value) return null;
    return registers.find((r) => r.id === value) || null;
  }, [registers, value]);

  const handleValueChange = (newVal: string) => {
    if (newVal === '__none__') {
      onChange(null);
    } else {
      const reg = registers.find((r) => r.id === newVal);
      onChange(newVal, reg?.name);
    }
  };

  const selectValue = value || '__none__';

  return (
    <div className={cn('relative inline-flex items-center', className)}>
      <Select
        value={selectValue}
        onValueChange={handleValueChange}
        disabled={disabled || isLoading || registers.length === 0}
      >
        <SelectTrigger
          className={cn(
            'bg-background hover:bg-muted/50 border-input transition-colors',
            compact ? 'h-7 text-xs px-2 min-w-[140px]' : 'h-8 text-xs min-w-[170px]',
            !value && 'text-muted-foreground'
          )}
        >
          <div className="flex items-center gap-1.5 truncate">
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
            ) : (
              <Wallet className={cn('w-3.5 h-3.5 shrink-0', value ? 'text-amber-500' : 'text-muted-foreground')} />
            )}
            <SelectValue
              placeholder={
                placeholder ||
                (isLoading
                  ? t('common:loading', 'Betöltés...')
                  : t('invoices:expanded.select_petty_cash', 'Pénztár kiválasztása...'))
              }
            >
              {selectedRegister ? (
                <span className="truncate font-medium text-foreground">
                  {selectedRegister.name}
                  {selectedRegister.is_default && (
                    <span className="ml-1 text-[10px] text-muted-foreground font-normal">
                      ({t('pettyCash:registers.default_badge', 'Alapértelmezett')})
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-muted-foreground italic">
                  {placeholder || t('invoices:expanded.no_register_assigned', 'Nincs pénztár rendelve')}
                </span>
              )}
            </SelectValue>
          </div>
        </SelectTrigger>
        <SelectContent align="start" className="max-h-60">
          <SelectItem value="__none__" className="text-xs text-muted-foreground italic">
            {t('invoices:expanded.no_register_assigned', 'Nincs pénztár rendelve')}
          </SelectItem>
          {registers.map((register) => (
            <SelectItem key={register.id} value={register.id} className="text-xs">
              <div className="flex items-center justify-between w-full gap-2">
                <span className="font-medium">{register.name}</span>
                {register.is_default && (
                  <span className="text-[10px] px-1 py-0.2 bg-muted text-muted-foreground rounded">
                    {t('pettyCash:registers.default_badge', 'Fő')}
                  </span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
