import React from 'react';
import { Mail, Loader2, CheckCircle2, Eye, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PayrollStep1Props {
  emailSent: boolean;
  emailSending: boolean;
  emailDialogOpen: boolean;
  setEmailDialogOpen: (v: boolean) => void;
  emailTo: string;
  setEmailTo: (v: string) => void;
  handleSendEmail: () => void;
  handleEmailPreview: () => void;
}

export default function PayrollStep1({
  emailSent,
  emailSending,
  emailDialogOpen,
  setEmailDialogOpen,
  emailTo,
  setEmailTo,
  handleSendEmail,
  handleEmailPreview,
}: PayrollStep1Props) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Küldj adatbekérő üzenetet az ügyfélnek a hiányzó bér-adatokról (jelenléti ív, változások, új belépők/kilépők).
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative">
          <button
            onClick={() => { if (!emailSent) setEmailDialogOpen(!emailDialogOpen); }}
            disabled={emailSending}
            className={cn(
              "flex items-center gap-3 p-4 rounded-lg border transition-all w-full",
              emailSent
                ? "border-green-300 bg-green-50 dark:bg-green-900/20"
                : emailDialogOpen
                ? "border-primary bg-primary/5 shadow-md"
                : "border-border hover:border-primary/30 hover:bg-primary/5",
              emailSending && "opacity-80 cursor-not-allowed"
            )}
          >
            {emailSending ? (
              <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
            ) : emailSent ? (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            ) : (
              <Mail className="w-5 h-5 text-blue-500" />
            )}
            <div className="text-left">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {emailSending ? 'Küldés...' : emailSent ? `Elküldve  → ${emailTo}` : 'E-mail küldése'}
              </p>
              <p className="text-xs text-slate-500">
                {emailSent ? 'Adatbekérő sikeresen kiküldve' : 'Sablon-alapú bekérés'}
              </p>
            </div>
          </button>
          {emailDialogOpen && !emailSent && (
            <div className="absolute top-full left-0 right-0 mt-2 p-4 bg-card border border-border rounded-xl shadow-xl z-20 animate-in fade-in slide-in-from-top-2 duration-200">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Címzett email cím</label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={emailTo}
                  onChange={e => setEmailTo(e.target.value)}
                  placeholder="pelda@ceg.hu"
                  className="flex-1 px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/30 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleSendEmail()}
                />
                <Button
                  onClick={handleSendEmail}
                  disabled={emailSending || !emailTo}
                  size="sm"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-1.5 px-4"
                >
                  {emailSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Küldés
                </Button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5">Az adatbekérő email erre a címre lesz kiküldve.</p>
            </div>
          )}
        </div>
        <button
          onClick={handleEmailPreview}
          className="flex items-center gap-3 p-4 rounded-lg border border-border hover:border-primary/30 hover:bg-primary/5 transition-all"
        >
          <Eye className="w-5 h-5 text-violet-500" />
          <div className="text-left">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Előnézet</p>
            <p className="text-xs text-slate-500">E-mail megtekintése</p>
          </div>
        </button>
        <button className="flex items-center gap-3 p-4 rounded-lg border border-border hover:border-primary/30 hover:bg-primary/5 transition-all">
          <Send className="w-5 h-5 text-teal-500" />
          <div className="text-left">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Portál link</p>
            <p className="text-xs text-slate-500">Ügyfélportál meghívó</p>
          </div>
        </button>
      </div>
    </div>
  );
}
