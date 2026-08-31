import React from 'react';
import { Landmark } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BANK_HINT_OPTIONS } from '../../config/channelConfigs';

interface BankHintSelectorProps {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}

export function BankHintSelector({ value, onChange, disabled }: BankHintSelectorProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 border rounded-lg bg-muted/20">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Landmark className="h-4 w-4 text-muted-foreground" />
        <span>Bank formátum:</span>
      </div>
      <Select
        value={value}
        onValueChange={onChange}
        disabled={disabled}
      >
        <SelectTrigger className="w-full sm:w-[260px] h-9 bg-background">
          <SelectValue placeholder="Válassz bankot..." />
        </SelectTrigger>
        <SelectContent>
          {BANK_HINT_OPTIONS.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-xs text-muted-foreground hidden sm:inline">
        (Ha nem választasz, az AI automatikusan felismeri a formátumot)
      </span>
    </div>
  );
}
