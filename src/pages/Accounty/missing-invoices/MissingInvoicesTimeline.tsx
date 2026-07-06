import { Mail, MessageSquare } from 'lucide-react';

const TIMELINE_ITEMS = [
  { id: 1, title: 'Felszólítás küldve', date: '2024-01-14 10:30', icon: Mail, status: 'Elküldve', color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/40 border-blue-200 dark:border-blue-800', iconColor: 'text-slate-400' },
  { id: 2, title: 'Üzenet kézbesítve', date: '2024-01-12 14:15', icon: MessageSquare, status: 'Kézbesítve', color: 'text-primary dark:text-primary bg-accent-subtle dark:bg-accent border-accent dark:border-accent', iconColor: 'text-slate-400' },
  { id: 3, title: 'Email megnyitva', date: '2024-01-10 09:00', icon: Mail, status: 'Megnyitva', color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/40 border-amber-200 dark:border-amber-800', iconColor: 'text-slate-400' },
];

export function MissingInvoicesTimeline() {
  return (
    <div className="bg-card border border-border rounded-xl shadow-soft overflow-hidden mt-8">
      <div className="px-6 py-5 border-b border-border">
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Felszólítás előzmények</h2>
      </div>
      <div className="p-6 space-y-0 relative">
        <div className="absolute top-8 bottom-8 left-[43px] w-[2px] bg-slate-100 dark:bg-slate-800 z-0"></div>
        {TIMELINE_ITEMS.map((item) => (
          <div key={item.id} className="relative z-10 flex items-center justify-between p-4 group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors rounded-xl -ml-2 -mr-2">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center shadow-soft">
                <item.icon className={`w-4 h-4 ${item.iconColor}`} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{item.title}</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{item.date}</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${item.color}`}>
                {item.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
