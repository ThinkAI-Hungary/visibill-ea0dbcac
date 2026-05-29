import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Upload, CheckCircle2, Clock, AlertTriangle,
  FileText, Send, Download, Users, Calendar, MessageCircle,
  Shield, ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { usePayrollCycles, usePayrollEmployees } from '@/hooks/usePayrollData';
import { useAccountyClients } from '@/hooks/useAccountyData';
import { useToast } from '@/hooks/use-toast';

const MONTHS = ['Január', 'Február', 'Március', 'Április', 'Május', 'Június', 'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December'];

interface PortalRequest {
  id: string;
  type: 'attendance' | 'changes' | 'new_employee' | 'termination' | 'documents';
  title: string;
  description: string;
  status: 'pending' | 'submitted' | 'approved' | 'rejected';
  dueDate: string;
  submittedAt?: string;
  files?: string[];
}

export default function ClientPortalPage() {
  const { id: companyId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: clients } = useAccountyClients();
  const { data: cycles = [] } = usePayrollCycles(companyId || '');
  const { data: employees = [] } = usePayrollEmployees(companyId || '');

  const company = useMemo(() => clients?.find(c => c.id === companyId), [clients, companyId]);
  const activeEmployees = useMemo(() => employees.filter(e => e.status === 'active'), [employees]);

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const [requests] = useState<PortalRequest[]>([
    {
      id: '1', type: 'attendance', title: 'Jelenléti ív',
      description: `${currentYear}. ${MONTHS[currentMonth - 1]} havi munkaidő-nyilvántartás`,
      status: 'pending', dueDate: new Date(currentYear, currentMonth - 1, 5).toISOString(),
    },
    {
      id: '2', type: 'changes', title: 'Bérmódosítások',
      description: 'Béremelések, státuszváltozások a hónapban',
      status: 'pending', dueDate: new Date(currentYear, currentMonth - 1, 5).toISOString(),
    },
    {
      id: '3', type: 'new_employee', title: 'Új belépők',
      description: 'Új foglalkoztatottak adatai (TAJ, adóazonosító, bankszámla)',
      status: 'pending', dueDate: new Date(currentYear, currentMonth - 1, 3).toISOString(),
    },
    {
      id: '4', type: 'documents', title: 'Cafeteria igények',
      description: 'SZÉP kártya, rekreáció, egyéb juttatás igénylések',
      status: 'pending', dueDate: new Date(currentYear, currentMonth - 1, 10).toISOString(),
    },
  ]);

  const statusColors: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', label: 'Várakozik' },
    submitted: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', label: 'Beküldve' },
    approved: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', label: 'Elfogadva' },
    rejected: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', label: 'Elutasítva' },
  };

  const typeIcons: Record<string, React.ElementType> = {
    attendance: Clock, changes: FileText, new_employee: Users, termination: AlertTriangle, documents: Upload,
  };

  const handleGeneratePortalLink = () => {
    const link = `${window.location.origin}/portal/${companyId}/${Date.now().toString(36)}`;
    navigator.clipboard.writeText(link);
    toast({ title: 'Portál link generálva', description: 'A link a vágólapra másolva.' });
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/accounty/payroll/${companyId}`)} className="h-9 w-9">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Ügyfélportál</h1>
            <p className="text-sm text-slate-500">{company?.name || '–'} · Adatbekérés és dokumentumkezelés</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleGeneratePortalLink} className="flex items-center gap-2">
            <ExternalLink className="w-4 h-4" /> Portál link
          </Button>
          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2"
            onClick={() => toast({ title: 'Meghívó elküldve', description: 'Az ügyfél megkapta a portál hozzáférést.' })}>
            <Send className="w-4 h-4" /> Meghívó
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { icon: Shield, label: 'Portál státusz', value: 'Aktív', sub: 'Ügyfél hozzáfér', color: 'text-green-600' },
          { icon: Clock, label: 'Függő kérések', value: requests.filter(r => r.status === 'pending').length, sub: 'Válaszra vár', color: 'text-amber-600' },
          { icon: Users, label: 'Foglalkoztatottak', value: activeEmployees.length, sub: 'Aktív', color: 'text-blue-600' },
          { icon: Calendar, label: 'Aktuális ciklus', value: `${currentYear}/${String(currentMonth).padStart(2, '0')}`, sub: MONTHS[currentMonth - 1], color: 'text-violet-600' },
        ].map((card) => (
          <div key={card.label} className="bg-card rounded-xl border border-border shadow-soft p-4">
            <div className="flex items-center gap-2 mb-2">
              <card.icon className={cn('w-4 h-4', card.color)} />
              <span className="text-xs font-medium text-slate-500 uppercase">{card.label}</span>
            </div>
            <p className={cn('text-lg font-bold', card.color)}>{card.value}</p>
            <p className="text-xs text-slate-500 mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Adatbekérések — {currentYear}. {MONTHS[currentMonth - 1]}</h2>
          <span className="text-xs text-slate-500">{requests.length} kérés</span>
        </div>
        <div className="divide-y divide-border/50">
          {requests.map((req) => {
            const StatusIcon = typeIcons[req.type] || FileText;
            const status = statusColors[req.status];
            const isOverdue = new Date(req.dueDate) < new Date() && req.status === 'pending';
            return (
              <div key={req.id} className="px-5 py-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', isOverdue ? 'bg-red-100 dark:bg-red-900/30' : 'bg-slate-100 dark:bg-slate-800')}>
                  <StatusIcon className={cn('w-5 h-5', isOverdue ? 'text-red-600' : 'text-slate-500')} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{req.title}</p>
                    {isOverdue && <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[9px] font-bold rounded-full uppercase">Lejárt!</span>}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{req.description}</p>
                  <p className="text-[10px] text-slate-400 mt-1">Határidő: {new Date(req.dueDate).toLocaleDateString('hu-HU')}</p>
                </div>
                <span className={cn('px-2.5 py-1 rounded-full text-[10px] font-bold uppercase', status.bg, status.text)}>{status.label}</span>
                <label className="cursor-pointer">
                  <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border hover:border-primary/30 hover:bg-primary/5 transition-all">
                    <Upload className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs font-semibold text-primary">Feltöltés</span>
                  </div>
                  <input type="file" className="hidden" multiple onChange={(e) => {
                    if (e.target.files?.length) toast({ title: 'Feltöltve', description: `${e.target.files.length} fájl a(z) "${req.title}" kéréshez.` });
                  }} />
                </label>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
        <div className="p-5 border-b border-border">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Kommunikáció</h2>
        </div>
        <div className="p-5 space-y-4">
          {[
            { date: new Date(Date.now() - 2 * 86400000), sender: 'Könyvelő', message: `Kérem a ${MONTHS[currentMonth - 1]} havi jelenléti íveket legkésőbb 5-éig.`, type: 'sent' },
            { date: new Date(Date.now() - 86400000), sender: company?.name || 'Ügyfél', message: 'Holnap küldöm a jelenléti íveket, volt egy új belépő is.', type: 'received' },
          ].map((msg, i) => (
            <div key={i} className={cn('flex', msg.type === 'sent' ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-md rounded-xl px-4 py-2.5', msg.type === 'sent' ? 'bg-primary/10 border border-primary/20' : 'bg-slate-100 dark:bg-slate-800 border border-border')}>
                <div className="flex items-center gap-2 mb-1">
                  <MessageCircle className="w-3 h-3 text-slate-400" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase">{msg.sender}</span>
                  <span className="text-[10px] text-slate-400">{msg.date.toLocaleDateString('hu-HU')}</span>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300">{msg.message}</p>
              </div>
            </div>
          ))}
          <div className="flex items-center gap-2 pt-2 border-t border-border/50">
            <input type="text" placeholder="Üzenet írása..." className="flex-1 px-4 py-2.5 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.target as HTMLInputElement).value) { toast({ title: 'Elküldve' }); (e.target as HTMLInputElement).value = ''; } }} />
            <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground"><Send className="w-4 h-4" /></Button>
          </div>
        </div>
      </div>
    </div>
  );
}