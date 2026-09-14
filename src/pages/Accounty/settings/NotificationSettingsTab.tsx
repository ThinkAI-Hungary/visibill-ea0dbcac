import React from 'react';
import { Mail, Phone } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

interface NotificationSettingsTabProps {
  defaultChannels: { email: boolean; viber: boolean; sms: boolean; phone: boolean };
  setDefaultChannels: React.Dispatch<React.SetStateAction<{ email: boolean; viber: boolean; sms: boolean; phone: boolean }>>;
  reminderFrequency: string;
  setReminderFrequency: (v: string) => void;
  autoReminder: boolean;
  setAutoReminder: (v: boolean) => void;
}

export default function NotificationSettingsTab({
  defaultChannels, setDefaultChannels,
  reminderFrequency, setReminderFrequency,
  autoReminder, setAutoReminder,
}: NotificationSettingsTabProps) {
  return (
    <div key="notifications" className="p-6 space-y-6 tab-content-enter">
      <div className="border-b border-border pb-4">
        <h2 className="text-lg font-bold text-foreground">Értesítési beállítások</h2>
        <p className="text-sm text-muted-foreground mt-1">Alapértelmezett értesítési csatornák és gyakoriság új ügyfelekhez</p>
      </div>

      <div>
        <h3 className="text-sm font-bold text-foreground mb-3">Csatornák</h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: 'email', label: 'E-mail', icon: Mail, desc: 'Automatikus email értesítések' },
            { key: 'viber', label: 'Viber', icon: Phone, desc: 'Viber üzenetek küldése' },
            { key: 'sms', label: 'SMS', icon: Phone, desc: 'SMS értesítések' },
            { key: 'phone', label: 'AI Telefonhívás', icon: Phone, desc: 'Automatikus AI hívások' },
          ].map(ch => (
            <button
              key={ch.key}
              onClick={() => setDefaultChannels(prev => ({ ...prev, [ch.key]: !prev[ch.key as keyof typeof prev] }))}
              className={cn(
                "flex items-center gap-3 p-4 rounded-lg border-2 transition-all text-left",
                defaultChannels[ch.key as keyof typeof defaultChannels]
                  ? "border-primary/30 dark:border-primary/40 bg-accent-subtle/50 dark:bg-accent"
                  : "border-border hover:border-border"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center",
                defaultChannels[ch.key as keyof typeof defaultChannels]
                  ? "bg-accent dark:bg-accent"
                  : "bg-muted"
              )}>
                <ch.icon className={cn("w-4 h-4", defaultChannels[ch.key as keyof typeof defaultChannels] ? "text-primary" : "text-muted-foreground")} />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{ch.label}</p>
                <p className="text-xs text-muted-foreground">{ch.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold text-foreground mb-3">Emlékeztető gyakoriság</h3>
        <div className="flex gap-3">
          {[
            { value: 'low', label: 'Alacsony', desc: 'Hetente 1x' },
            { value: 'normal', label: 'Normál', desc: '3 naponta' },
            { value: 'high', label: 'Magas', desc: 'Naponta' },
          ].map(freq => (
            <button
              key={freq.value}
              onClick={() => setReminderFrequency(freq.value)}
              className={cn(
                "flex-1 p-4 rounded-lg border-2 transition-all text-center",
                reminderFrequency === freq.value
                  ? "border-primary/40 dark:border-indigo-700 bg-primary/10/50 dark:bg-indigo-900/20"
                  : "border-border hover:border-border"
              )}
            >
              <p className="text-sm font-bold text-foreground">{freq.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{freq.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg cursor-pointer select-none">
        <Checkbox
          checked={autoReminder}
          onCheckedChange={checked => setAutoReminder(!!checked)}
        />
        <div>
          <p className="text-sm font-medium text-foreground">Automatikus emlékeztetők</p>
          <p className="text-xs text-muted-foreground">A rendszer automatikusan küld emlékeztetőket a beállított gyakoriságnak megfelelően</p>
        </div>
      </label>
    </div>
  );
}
