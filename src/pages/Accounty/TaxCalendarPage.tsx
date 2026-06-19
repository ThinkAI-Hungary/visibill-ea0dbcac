import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  FileText, 
  AlertTriangle, 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  Mail, 
  X,
  User,
  Building,
  Calendar as CalendarIcon,
  Search,
  Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useAccountyRole } from './AccountyRoleContext';
import { useAccountyDeadlines, useAccountyKpis, useCompleteDeadline } from '@/hooks/useAccountyData';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  addToApprovalQueue,
  type OutgoingMessage,
} from './generateRequestEmail';

type Status = 'Zöld' | 'Sárga' | 'Piros';

interface DeadlineGroup {
  id: string;
  title: string;
  date: number; // Day of the month
  countMine: number;
  countAll: number;
  status: Status;
}

interface ClientDeadline {
  id: string;
  companyId: string;
  deadlineGroupKey: string;
  clientName: string;
  assignedToMe: boolean;
  status: 'Rendben' | 'Feldolgozandó' | 'Kritikus';
  deadlineStatus: string;
  deadlineType: string;
  dueDate: string;
}

// Map deadline_type to display title
const deadlineTypeTitle: Record<string, string> = {
  afa: 'ÁFA',
  jarulek: 'Járulék',
  kata: 'Kata',
  ber: 'Bér',
  tao: 'TAO',
  ipa: 'IPA',
  egyeb: 'Egyéb',
};

function KpiCard({ title, value, icon: Icon, valueClass = "text-slate-900 dark:text-slate-100" }: { title: string, value: number, icon: React.ElementType, valueClass?: string }) {
  return (
    <div className="bg-card rounded-xl p-5 border border-border shadow-soft flex flex-col justify-between h-32 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</h3>
        <Icon className={`w-5 h-5 ${valueClass === 'text-red-600' ? 'text-red-500' : 'text-slate-400'}`} />
      </div>
      <p className={`text-3xl font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}

export default function TaxCalendarPage() {
  const { isAdmin } = useAccountyRole();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [viewScope, setViewScope] = useState<'mine' | 'all'>('mine');
  const [selectedDeadline, setSelectedDeadline] = useState<DeadlineGroup | null>(null);
  const [selectedClient, setSelectedClient] = useState<string>('all');

  // Supabase data
  const { data: deadlinesData } = useAccountyDeadlines();
  const { data: kpisData } = useAccountyKpis();
  const completeDeadlineMutation = useCompleteDeadline();

  // ── Handler: send deadline notification to approval queue ──
  const handleNotify = async (client: ClientDeadline) => {
    try {
      // Fetch contact email for this company
      const { data: commPrefs } = await supabase
        .from('accounty_communication_preferences')
        .select('contact_email, contact_name')
        .eq('company_id', client.companyId)
        .maybeSingle();

      const contactEmail = (commPrefs as any)?.contact_email || 'nincs-megadva@example.com';
      const contactName = (commPrefs as any)?.contact_name || null;

      const deadlineTitle = deadlineTypeTitle[client.deadlineType] || client.deadlineType;
      const dueDateFormatted = new Date(client.dueDate).toLocaleDateString('hu-HU', {
        year: 'numeric', month: 'long', day: 'numeric',
      });

      const greeting = contactName
        ? `Kedves ${contactName}!`
        : `Tisztelt ${client.clientName}!`;

      const subject = `Határidő emlékeztető – ${deadlineTitle} – ${client.clientName}`;

      const body = `${greeting}

Szeretnénk emlékeztetni, hogy az alábbi könyvelési határidő közeledik:

• Típus: ${deadlineTitle} bevallás
• Határidő: ${dueDateFormatted}
• Cég: ${client.clientName}

Kérjük, gondoskodjon a szükséges dokumentumok mielőbbi eljuttatásáról, hogy a bevallást határidőre el tudjuk készíteni.

Amennyiben a dokumentumokat már eljuttatta hozzánk, kérjük tekintse tárgytalannak ezt az üzenetet.

Üdvözlettel,
ThinkAI`;

      const htmlPreview = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: #111827; padding: 24px 28px; border-radius: 8px 8px 0 0;">
    <div style="color: #ffffff; font-size: 20px; font-weight: 700;">eaisybooks</div>
    <div style="color: #9ca3af; font-size: 12px; margin-top: 2px;">Határidő emlékeztető</div>
  </div>
  <div style="padding: 28px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none;">
    <p style="font-size: 15px; color: #374151; margin-bottom: 16px;">${greeting}</p>
    <p style="font-size: 14px; color: #374151; line-height: 1.6;">Szeretnénk emlékeztetni, hogy az alábbi könyvelési határidő közeledik:</p>
    <div style="margin: 20px 0; border-radius: 6px; overflow: hidden; border: 1px solid #e5e7eb;">
      <table style="width: 100%; border-collapse: collapse;">
        <tbody>
          <tr style="background: #f3f4f6;">
            <td style="padding: 10px 12px; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase;">Típus</td>
            <td style="padding: 10px 12px; font-size: 14px; color: #111827; font-weight: 500;">${deadlineTitle} bevallás</td>
          </tr>
          <tr>
            <td style="padding: 10px 12px; border-top: 1px solid #e5e7eb; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase;">Határidő</td>
            <td style="padding: 10px 12px; border-top: 1px solid #e5e7eb; font-size: 14px; color: #111827; font-weight: 500;">${dueDateFormatted}</td>
          </tr>
          <tr>
            <td style="padding: 10px 12px; border-top: 1px solid #e5e7eb; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase;">Cég</td>
            <td style="padding: 10px 12px; border-top: 1px solid #e5e7eb; font-size: 14px; color: #111827; font-weight: 500;">${client.clientName}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p style="font-size: 13px; color: #9ca3af; margin-top: 20px;">Amennyiben a dokumentumokat már eljuttatta hozzánk, kérjük tekintse tárgytalannak ezt az üzenetet.</p>
    <p style="font-size: 14px; color: #374151; margin-top: 20px;">Üdvözlettel,<br/><strong>ThinkAI</strong></p>
  </div>
  <div style="background: #f3f4f6; padding: 14px 28px; text-align: center; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
    <p style="font-size: 11px; color: #9ca3af; margin: 0;">Ez a levél automatikusan készült az eaisybooks rendszerből.</p>
  </div>
</div>`;

      const message: OutgoingMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        companyId: client.companyId,
        companyName: client.clientName,
        contactEmail,
        channel: 'email',
        category: client.status === 'Kritikus' ? 'urgent' : 'normal',
        subject,
        originalContext: `${deadlineTitle} bevallás – Határidő: ${dueDateFormatted}`,
        aiGeneratedBody: body,
        htmlPreview,
        portalLink: '',
        status: 'pending',
        createdAt: new Date().toISOString(),
        missingItemIds: [],
      };

      addToApprovalQueue(message);
      toast({
        title: '✉ Értesítés a jóváhagyó sorba került',
        description: `${deadlineTitle} – ${client.clientName}`,
      });
    } catch (err) {
      console.error('Notify error:', err);
      toast({
        variant: 'destructive',
        title: 'Hiba',
        description: 'Nem sikerült az értesítés létrehozása.',
      });
    }
  };

  // Ha nem admin, mindig saját nézet
  React.useEffect(() => {
    if (!isAdmin) {
      setViewScope('mine');
    }
  }, [isAdmin]);

  // Build DeadlineGroups from Supabase data, grouped by (due_date day + deadline_type)
  const { deadlineGroups, clientDeadlines } = useMemo(() => {
    if (!deadlinesData || deadlinesData.length === 0) return { deadlineGroups: [] as DeadlineGroup[], clientDeadlines: [] as ClientDeadline[] };

    // Group by "day-type" key
    const groupMap: Record<string, { deadlines: typeof deadlinesData }> = {};
    deadlinesData.forEach(d => {
      const dayOfMonth = new Date(d.dueDate).getDate();
      const key = `${dayOfMonth}-${d.deadlineType}`;
      if (!groupMap[key]) groupMap[key] = { deadlines: [] };
      groupMap[key].deadlines.push(d);
    });

    const groups: DeadlineGroup[] = [];
    const clients: ClientDeadline[] = [];

    Object.entries(groupMap).forEach(([key, { deadlines }]) => {
      const dayOfMonth = parseInt(key.split('-')[0]);
      const type = key.split('-').slice(1).join('-');
      const count = deadlines.length;
      const overdueCount = deadlines.filter(d => d.status === 'overdue').length;
      const pendingCount = deadlines.filter(d => d.status === 'pending' || d.status === 'in_progress').length;

      let status: Status = 'Zöld';
      if (overdueCount > 0) status = 'Piros';
      else if (pendingCount > count * 0.3) status = 'Sárga';

      const group: DeadlineGroup = {
        id: key,
        title: deadlineTypeTitle[type] || type,
        date: dayOfMonth,
        countMine: count, // All are "mine" since we only fetch assigned companies
        countAll: count,
        status,
      };
      groups.push(group);

      // Build client deadlines for the drawer
      deadlines.forEach(d => {
        const dlStatus = d.status === 'completed' ? 'Rendben'
          : d.status === 'overdue' ? 'Kritikus'
          : 'Feldolgozandó';
        clients.push({
          id: d.id,
          companyId: d.companyId,
          deadlineGroupKey: key,
          clientName: d.companyName || 'Ismeretlen',
          assignedToMe: true,
          status: dlStatus as any,
          deadlineStatus: d.status,
          deadlineType: d.deadlineType,
          dueDate: d.dueDate,
        });
      });
    });

    return { deadlineGroups: groups, clientDeadlines: clients };
  }, [deadlinesData]);

  const uniqueClients = useMemo(() => {
    const clients = clientDeadlines
      .filter(c => viewScope === 'all' || c.assignedToMe)
      .map(c => c.clientName);
    return Array.from(new Set(clients)).sort();
  }, [viewScope, clientDeadlines]);
  
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [calendarView, setCalendarView] = useState<'month' | 'week' | 'list'>('month');

  const handlePrev = () => {
    const newDate = new Date(currentDate);
    if (calendarView === 'month') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else if (calendarView === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    }
    setCurrentDate(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (calendarView === 'month') {
      newDate.setMonth(newDate.getMonth() + 1);
    } else if (calendarView === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    }
    setCurrentDate(newDate);
  };

  const handleToday = () => {
    setCurrentDate(new Date()); 
  };

  const formatMonthYear = (date: Date) => {
    const months = ['Január', 'Február', 'Március', 'Április', 'Május', 'Június', 'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December'];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  const formatWeekInterval = (date: Date) => {
    const start = new Date(date);
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day + 1);
    
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    
    const months = ['Jan', 'Feb', 'Már', 'Ápr', 'Máj', 'Jún', 'Júl', 'Aug', 'Szep', 'Okt', 'Nov', 'Dec'];
    return `${months[start.getMonth()]} ${start.getDate()}. - ${months[end.getMonth()]} ${end.getDate()}.`;
  };

  const getHeaderText = () => {
    if (calendarView === 'month') return formatMonthYear(currentDate);
    if (calendarView === 'week') return formatWeekInterval(currentDate);
    return 'Lista nézet';
  };

  const calendarDays = useMemo(() => {
    if (calendarView === 'week') {
      const start = new Date(currentDate);
      const day = start.getDay() || 7;
      start.setDate(start.getDate() - day + 1); // Hétfő
      const weekDays = [];
      for (let i = 0; i < 7; i++) {
        const current = new Date(start);
        current.setDate(start.getDate() + i);
        weekDays.push({ day: current.getDate(), isCurrentMonth: true });
      }
      return weekDays;
    }

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    
    let firstDayOfWeek = firstDayOfMonth.getDay();
    if (firstDayOfWeek === 0) firstDayOfWeek = 7;

    const days = [];
    
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = firstDayOfWeek - 1; i > 0; i--) {
      days.push({ day: prevMonthLastDay - i + 1, isCurrentMonth: false });
    }
    
    for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
      days.push({ day: i, isCurrentMonth: true });
    }
    
    let nextMonthDay = 1;
    const totalSlots = days.length > 35 ? 42 : 35;
    while (days.length < totalSlots) {
      days.push({ day: nextMonthDay++, isCurrentMonth: false });
    }
    
    return days;
  }, [currentDate, calendarView]);

  const getBadgesForDay = (day: number, isCurrentMonth: boolean) => {
    if (!isCurrentMonth) return [];
    const baseBadges = deadlineGroups.filter(dg => dg.date === day);
    
    if (selectedClient === 'all') return baseBadges;

    return baseBadges.map(badge => {
      const filteredClts = clientDeadlines.filter(c => 
        c.deadlineGroupKey === badge.id && 
        c.clientName === selectedClient &&
        (viewScope === 'all' || c.assignedToMe)
      );
      
      if (filteredClts.length === 0) return null;
      
      return {
        ...badge,
        countMine: filteredClts.filter(c => c.assignedToMe).length,
        countAll: filteredClts.length
      };
    }).filter(Boolean) as DeadlineGroup[];
  };

  const getDayOfWeekName = (date: Date) => {
    const days = ['Vasárnap', 'Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat'];
    return days[date.getDay()];
  };

  const getListViewItems = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const months = ['Január', 'Február', 'Március', 'Április', 'Május', 'Június', 'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December'];
    
    const uniqueDays = Array.from(new Set(deadlineGroups.map(dg => dg.date))).sort((a, b) => a - b);
    
    return uniqueDays.map(dayNum => {
      const fullDate = new Date(year, month, dayNum);
      const badges = getBadgesForDay(dayNum, true).filter(badge => {
        const count = viewScope === 'mine' ? badge.countMine : badge.countAll;
        return count > 0;
      });
      
      return {
        dayNum,
        dateString: `${year}. ${months[month]} ${dayNum}. - ${getDayOfWeekName(fullDate)}`,
        badges
      };
    }).filter(item => item.badges.length > 0);
  };

  const filteredClients = useMemo(() => {
    if (!selectedDeadline) return [];
    return clientDeadlines.filter(c => {
      if (c.deadlineGroupKey !== selectedDeadline.id) return false;
      if (viewScope === 'mine' && !c.assignedToMe) return false;
      return true;
    });
  }, [selectedDeadline, viewScope, clientDeadlines]);

  const handleDeadlineClick = (deadline: DeadlineGroup) => {
    setSelectedDeadline(deadline);
  };

  const getStatusColor = (status: Status) => {
    switch(status) {
      case 'Zöld': return 'bg-accent text-accent-foreground border-accent dark:bg-accent dark:text-primary dark:border-accent';
      case 'Sárga': return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-800';
      case 'Piros': return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-400 dark:border-red-800';
      default: return 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-border';
    }
  };

  const getDotColor = (status: Status) => {
    switch(status) {
      case 'Zöld': return 'bg-primary';
      case 'Sárga': return 'bg-amber-500';
      case 'Piros': return 'bg-red-500';
      default: return 'bg-slate-500';
    }
  };

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500 pb-20">
      
      {/* Header section */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Adó naptár</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Ügyfelek adózási és bérszámfejtési határidői</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title={viewScope === 'mine' ? 'Saját ügyfeleim' : 'Összes ügyfél'} value={kpisData?.totalClients || 0} icon={Users} />
        <KpiCard title="Feldolgozatlan számlák" value={kpisData?.unprocessedInvoices || 0} icon={FileText} />
        <KpiCard title="Hiányzó számlák" value={kpisData?.missingItems || 0} icon={AlertTriangle} valueClass="text-red-600" />
        <KpiCard title="Közeledő határidők" value={kpisData?.upcomingDeadlines || 0} icon={Clock} />
      </div>

      {/* Scope Tabs (Mine / All) */}
      <div className="w-full bg-slate-100/80 dark:bg-slate-900/80 p-1.5 rounded-xl border border-border/60 shadow-inner flex items-center">
        <button
          onClick={() => { setViewScope('mine'); setSelectedClient('all'); }}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200",
            viewScope === 'mine' 
              ? "bg-card text-slate-900 dark:text-slate-100 shadow-soft" 
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 dark:text-slate-300 hover:bg-slate-200/50"
          )}
        >
          <User className="w-4 h-4" />
          Saját ügyfeleim ({kpisData?.totalClients || 0})
        </button>
        {isAdmin && (
          <button
            onClick={() => { setViewScope('all'); setSelectedClient('all'); }}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200",
              viewScope === 'all' 
                ? "bg-card text-slate-900 dark:text-slate-100 shadow-soft" 
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 dark:text-slate-300 hover:bg-slate-200/50"
            )}
          >
            <Building className="w-4 h-4" />
            Összes irodai ügyfél ({kpisData?.totalClients || 0})
          </button>
        )}
      </div>

      {/* Calendar Area */}
      <div>
        {/* Calendar Toolbar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handlePrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={handleToday} className="px-4 font-semibold text-slate-700 dark:text-slate-300">
              Ma
            </Button>
            <Button variant="outline" size="icon" onClick={handleNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 tracking-tight">
            {getHeaderText()}
          </h2>
          
          <div className="flex items-center gap-4">
            <Select value={selectedClient} onValueChange={setSelectedClient}>
              <SelectTrigger className="w-64 bg-card border-border shadow-soft h-10">
                <SelectValue placeholder="Minden ügyfél" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Minden ügyfél</SelectItem>
                {uniqueClients.map(client => (
                  <SelectItem key={client} value={client}>{client}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-border flex items-center shadow-inner h-10">
            <button
              onClick={() => setCalendarView('month')}
              className={cn("px-4 py-1.5 rounded-md text-sm font-semibold transition-all duration-200", calendarView === 'month' ? "bg-card text-slate-900 dark:text-slate-100 shadow-soft" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 dark:text-slate-300 hover:bg-slate-200/50")}
            >
              Havi
            </button>
            <button
              onClick={() => setCalendarView('week')}
              className={cn("px-4 py-1.5 rounded-md text-sm font-semibold transition-all duration-200", calendarView === 'week' ? "bg-card text-slate-900 dark:text-slate-100 shadow-soft" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 dark:text-slate-300 hover:bg-slate-200/50")}
            >
              Heti
            </button>
            <button
              onClick={() => setCalendarView('list')}
              className={cn("px-4 py-1.5 rounded-md text-sm font-semibold transition-all duration-200", calendarView === 'list' ? "bg-card text-slate-900 dark:text-slate-100 shadow-soft" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 dark:text-slate-300 hover:bg-slate-200/50")}
            >
              Lista
            </button>
          </div>
          </div>
        </div>
      {calendarView === 'list' ? (
        <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
          {getListViewItems().map((item, idx) => (
            <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors gap-4">
              <div className="font-semibold text-slate-800 dark:text-slate-200">
                {item.dateString}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {item.badges.map((badge, bIdx) => {
                  const count = viewScope === 'mine' ? badge.countMine : badge.countAll;
                  return (
                    <button
                      key={bIdx}
                      onClick={() => handleDeadlineClick(badge)}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-bold transition-all shadow-soft hover:shadow",
                        getStatusColor(badge.status)
                      )}
                    >
                      <div className={cn("w-1.5 h-1.5 rounded-full", getDotColor(badge.status))} />
                      {badge.title} ({count})
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {getListViewItems().length === 0 && (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400 font-medium">
              Nincs határidő ebben a hónapban.
            </div>
          )}
        </div>
      ) : (
      <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
        
        {/* Calendar Grid */}
        <div className="grid grid-cols-7 border-b border-border">
          {['Mon', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat', 'Vasárnap'].map((day, i) => (
            <div key={day} className={`py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider ${i < 6 ? 'border-r border-border' : ''}`}>
              {day}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 bg-slate-100 dark:bg-slate-800 gap-[1px]">
          {calendarDays.map((cell, index) => {
            const badges = getBadgesForDay(cell.day, cell.isCurrentMonth);
            
            return (
              <div 
                key={index} 
                className={cn(
                  "bg-card min-h-[120px] p-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group",
                  !cell.isCurrentMonth && "text-slate-400 dark:bg-slate-950/50"
                )}
              >
                <div className={cn(
                  "text-sm font-medium mb-2",
                  cell.isCurrentMonth ? "text-slate-700 dark:text-slate-300" : "text-slate-400"
                )}>
                  {cell.day}
                </div>
                
                <div className="flex flex-col gap-1.5">
                  {badges.map((badge, bIdx) => {
                    const count = viewScope === 'mine' ? badge.countMine : badge.countAll;
                    if (count === 0) return null; // Ne mutassa ha 0

                    return (
                      <button
                        key={bIdx}
                        onClick={() => handleDeadlineClick(badge)}
                        className={cn(
                          "flex items-center gap-1.5 px-2 py-1 rounded border text-xs font-semibold w-fit hover:brightness-95 transition-all",
                          getStatusColor(badge.status)
                        )}
                      >
                        <div className={cn("w-1.5 h-1.5 rounded-full", getDotColor(badge.status))} />
                        {badge.title} ({count})
                      </button>
                    )
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      )}
      </div>

      {/* Side Drawer for Details */}
      <Sheet open={!!selectedDeadline} onOpenChange={(open) => !open && setSelectedDeadline(null)}>
        <SheetContent className="w-[400px] sm:max-w-[400px] p-0 flex flex-col bg-card border-l border-border shadow-2xl">
          {selectedDeadline && (
            <>
              {/* Drawer Header */}
              <div className="p-6 border-b border-border dark:bg-slate-900/50 relative">
                <div className="flex items-center gap-3 text-slate-800 dark:text-slate-200">
                  <div className="p-2 bg-red-100 text-red-600 rounded-lg shrink-0">
                    <CalendarIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">
                      {currentDate.toLocaleString('hu-HU', { month: 'long' }).charAt(0).toUpperCase() + currentDate.toLocaleString('hu-HU', { month: 'long' }).slice(1)} {selectedDeadline.date}.
                    </h3>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Havi {selectedDeadline.title} Bevallás</p>
                  </div>
                </div>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {viewScope === 'mine' ? 'Saját ügyfelek' : 'Összes ügyfél'}
                  </h4>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Felelős</span>
                </div>

                <div className="space-y-4">
                  {filteredClients.map((client) => (
                    <div key={client.id} className="flex items-center justify-between py-2 border-b border-slate-50 dark:border-slate-800 last:border-0">
                      <div>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">{client.clientName}</p>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1",
                            client.status === 'Rendben' ? "bg-accent text-accent-foreground" :
                            client.status === 'Feldolgozandó' ? "bg-amber-100 text-amber-700" :
                            "bg-red-100 text-red-700"
                          )}>
                            <div className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              client.status === 'Rendben' ? "bg-primary" :
                              client.status === 'Feldolgozandó' ? "bg-amber-500" :
                              "bg-red-500"
                            )}></div>
                            {client.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                          <div className="w-5 h-5 rounded-full bg-slate-300 text-slate-700 dark:text-slate-300 flex items-center justify-center text-[10px] font-bold">
                            {client.clientName.charAt(0)}
                          </div>
                          {client.clientName.split(' ')[0]}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {client.status !== 'Rendben' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs font-semibold gap-1.5 border-border"
                            onClick={() => handleNotify(client)}
                          >
                            <Mail className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                            Értesítés
                          </Button>
                        )}
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => completeDeadlineMutation.mutate(client.id)}
                          className="h-8 text-xs font-semibold gap-1.5 border-accent dark:border-accent text-accent-foreground dark:text-primary hover:bg-accent-subtle dark:hover:bg-accent"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Kész
                        </Button>
                      </div>
                    </div>
                  ))}

                  {filteredClients.length === 0 && (
                    <div className="text-center py-8 text-slate-500 dark:text-slate-400 text-sm">
                      Nincs megjeleníthető ügyfél ebben a nézetben.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

    </div>
  );
}
