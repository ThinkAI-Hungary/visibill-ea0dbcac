import React from 'react';
import { Package } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { COURIER_OPTIONS } from '../../config/channelConfigs';
import type { CourierReportType } from '../../types';

interface CourierTypeSelectorProps {
  value: CourierReportType;
  onChange: (val: CourierReportType) => void;
  disabled?: boolean;
}

export function CourierTypeSelector({ value, onChange, disabled }: CourierTypeSelectorProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 border rounded-lg bg-muted/20">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Package className="h-4 w-4 text-muted-foreground" />
        <span>Futárszolgálat:</span>
      </div>
      <Select
        value={value}
        onValueChange={(val) => onChange(val as CourierReportType)}
        disabled={disabled}
      >
        <SelectTrigger className="w-full sm:w-[220px] h-9 bg-background">
          <SelectValue placeholder="Válassz futárt..." />
        </SelectTrigger>
        <SelectContent>
          {COURIER_OPTIONS.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
