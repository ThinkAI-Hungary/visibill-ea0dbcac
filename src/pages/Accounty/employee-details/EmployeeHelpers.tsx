import React from 'react';
import { cn } from '@/lib/utils';
import { DatePicker } from '@/components/ui/date-picker';

export function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-bold text-foreground/90 mb-3">{title}</h3>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

export function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <span className="text-xs text-muted-foreground shrink-0 w-24">{label}</span>
      <span className="text-sm text-foreground font-medium truncate">{value}</span>
    </div>
  );
}

export function EditField({ label, value, onChange, type = 'text', placeholder, required }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {type === 'date' ? (
        <DatePicker
          value={value}
          onChange={onChange}
          placeholder={placeholder || 'éééé. hh. nn.'}
          clearable
          className="w-full px-3 py-1.5 h-9 rounded-lg border border-border bg-background text-sm"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
        />
      )}
    </div>
  );
}

export function MiniStat({ label, value, color }: { label: string; value: string; color?: 'green' | 'red' }) {
  return (
    <div className="bg-muted/50 rounded-lg p-3 text-center">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={cn(
        'text-lg font-bold mt-0.5',
        color === 'green' ? 'text-green-600 dark:text-green-400' :
        color === 'red' ? 'text-red-600 dark:text-red-400' :
        'text-foreground'
      )}>
        {value}
      </p>
    </div>
  );
}
