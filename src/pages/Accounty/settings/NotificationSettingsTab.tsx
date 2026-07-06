import React from 'react';
import { Mail, Phone } from 'lucide-react';
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
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Értesítési beállítások</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Alapértelmezett értesítési csatornák és gyakoriság új ügyfelekhez</p>
      </div>

      <div>
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">Csatornák</h3>
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
                "flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left",
                defaultChannels[ch.key as keyof typeof defaultChannels]
                  ? "border-primary/30 dark:border-primary/40 bg-accent-subtle/50 dark:bg-accent"
                  : "border-border hover:border-slate-300"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center",
                defaultChannels[ch.key as keyof typeof defaultChannels]
                  ? "bg-accent dark:bg-accent"
                  : "bg-slate-100 dark:bg-slate-800"
              )}>
                <ch.icon className={cn("w-4 h-4", defaultChannels[ch.key as keyof typeof defaultChannels] ? "text-primary" : "text-slate-400")} />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{ch.label}</p>
                <p className="text-xs text-slate-500">{ch.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">Emlékeztető gyakoriság</h3>
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
                "flex-1 p-4 rounded-xl border-2 transition-all text-center",
                reminderFrequency === freq.value
                  ? "border-indigo-300 dark:border-indigo-700 bg-indigo-50/50 dark:bg-indigo-900/20"
                  : "border-border hover:border-slate-300"
              )}
            >
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{freq.label}</p>
              <p className="text-xs text-slate-500 mt-0.5">{freq.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl cursor-pointer">
        <input
          type="checkbox"
          checked={autoReminder}
          onChange={e => setAutoReminder(e.target.checked)}
          className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
        />
        <div>
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Automatikus emlékeztetők</p>
          <p className="text-xs text-slate-500">A rendszer automatikusan küld emlékeztetőket a beállított gyakoriságnak megfelelően</p>
        </div>
      </label>
    </div>
  );
}
