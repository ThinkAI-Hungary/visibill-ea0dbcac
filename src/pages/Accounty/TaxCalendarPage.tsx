import React, { useState, useMemo } from 'react';
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
  Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { mockKpis } from './mockData';

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
  deadlineId: string;
  clientName: string;
  assignedToMe: boolean;
  status: 'Rendben' | 'Feldolgozandó' | 'Kritikus';
  ownerInitial: string;
}

// --- MOCK ADATOK ---
const mockDeadlineGroups: DeadlineGroup[] = [
  { id: '1', title: 'Bér', date: 2, countMine: 45, countAll: 110, status: 'Zöld' },
  { id: '2', title: 'Bér', date: 7, countMine: 45, countAll: 110, status: 'Zöld' },
  { id: '3', title: 'Kata', date: 7, countMine: 8, countAll: 25, status: 'Sárga' },
  { id: '4', title: 'Bér', date: 10, countMine: 45, countAll: 110, status: 'Zöld' },
  { id: '5', title: 'Bér', date: 11, countMine: 45, countAll: 110, status: 'Zöld' },
  { id: '6', title: 'Kata', date: 11, countMine: 8, countAll: 25, status: 'Sárga' },
  { id: '7', title: 'Bér', date: 12, countMine: 45, countAll: 110, status: 'Zöld' },
  { id: '8', title: 'Kata', date: 12, countMine: 8, countAll: 25, status: 'Sárga' },
  { id: '9', title: 'Bér', date: 16, countMine: 45, countAll: 110, status: 'Zöld' },
  { id: '10', title: 'ÁFA', date: 16, countMine: 12, countAll: 40, status: 'Piros' },
  { id: '11', title: 'Bér', date: 17, countMine: 45, countAll: 110, status: 'Zöld' },
  { id: '12', title: 'Bér', date: 18, countMine: 45, countAll: 110, status: 'Zöld' },
  { id: '13', title: 'Kata', date: 18, countMine: 8, countAll: 25, status: 'Sárga' },
  { id: '14', title: 'Bér', date: 19, countMine: 45, countAll: 110, status: 'Zöld' },
  { id: '15', title: 'Kata', date: 19, countMine: 8, countAll: 25, status: 'Sárga' },
  { id: '16', title: 'ÁFA', date: 20, countMine: 12, countAll: 40, status: 'Piros' },
  { id: '17', title: 'Kata', date: 20, countMine: 8, countAll: 25, status: 'Sárga' },
  { id: '18', title: 'Bér', date: 24, countMine: 45, countAll: 110, status: 'Zöld' },
  { id: '19', title: 'Bér', date: 25, countMine: 45, countAll: 110, status: 'Zöld' },
  { id: '20', title: 'Bér', date: 31, countMine: 45, countAll: 110, status: 'Zöld' },
];

const mockClientDeadlines: ClientDeadline[] = mockDeadlineGroups.flatMap((dg) => {
  return [
    { id: `${dg.id}_c1`, deadlineId: dg.id, clientName: 'Tech Solutions Kft.', assignedToMe: true, status: 'Rendben', ownerInitial: 'A' },
    { id: `${dg.id}_c2`, deadlineId: dg.id, clientName: 'Webshop Hungary Zrt.', assignedToMe: true, status: 'Feldolgozandó', ownerInitial: 'A' },
    { id: `${dg.id}_c3`, deadlineId: dg.id, clientName: 'Gastro Delight Kft.', assignedToMe: true, status: 'Kritikus', ownerInitial: 'A' },
    { id: `${dg.id}_c4`, deadlineId: dg.id, clientName: 'Global Trade Kft.', assignedToMe: false, status: 'Feldolgozandó', ownerInitial: 'B' },
    { id: `${dg.id}_c5`, deadlineId: dg.id, clientName: 'Smart Office Bt.', assignedToMe: false, status: 'Rendben', ownerInitial: 'C' },
  ];
});

function KpiCard({ title, value, icon: Icon, valueClass = "text-slate-900" }: { title: string, value: number, icon: React.ElementType, valueClass?: string }) {
  return (
    <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm flex flex-col justify-between h-32 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <h3 className="text-sm font-medium text-slate-500">{title}</h3>
        <Icon className={`w-5 h-5 ${valueClass === 'text-red-600' ? 'text-red-500' : 'text-slate-400'}`} />
      </div>
      <p className={`text-3xl font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}

export default function TaxCalendarPage() {
  const [viewScope, setViewScope] = useState<'mine' | 'all'>('mine');
  const [selectedDeadline, setSelectedDeadline] = useState<DeadlineGroup | null>(null);
  const [selectedClient, setSelectedClient] = useState<string>('all');
  
  const uniqueClients = useMemo(() => {
    const clients = mockClientDeadlines
      .filter(c => viewScope === 'all' || c.assignedToMe)
      .map(c => c.clientName);
    return Array.from(new Set(clients)).sort();
  }, [viewScope]);
  
  const [currentDate, setCurrentDate] = useState<Date>(new Date(2024, 4, 1)); // Május 2024
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
    const baseBadges = mockDeadlineGroups.filter(dg => dg.date === day);
    
    if (selectedClient === 'all') return baseBadges;

    return baseBadges.map(badge => {
      const filteredClients = mockClientDeadlines.filter(c => 
        c.deadlineId === badge.id && 
        c.clientName === selectedClient &&
        (viewScope === 'all' || c.assignedToMe)
      );
      
      if (filteredClients.length === 0) return null;
      
      return {
        ...badge,
        countMine: filteredClients.filter(c => c.assignedToMe).length,
        countAll: filteredClients.length
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
    
    const uniqueDays = Array.from(new Set(mockDeadlineGroups.map(dg => dg.date))).sort((a, b) => a - b);
    
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
    return mockClientDeadlines.filter(c => {
      // Szűrjük az adott deadline-ra
      if (c.deadlineId !== selectedDeadline.id) return false;
      // Szűrjük aszerint, hogy saját vagy összes
      if (viewScope === 'mine' && !c.assignedToMe) return false;
      return true;
    });
  }, [selectedDeadline, viewScope]);

  const handleDeadlineClick = (deadline: DeadlineGroup) => {
    setSelectedDeadline(deadline);
  };

  const getStatusColor = (status: Status) => {
    switch(status) {
      case 'Zöld': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Sárga': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Piros': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getDotColor = (status: Status) => {
    switch(status) {
      case 'Zöld': return 'bg-emerald-500';
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
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Adó naptár</h1>
          <p className="text-slate-500 mt-1">Ügyfelek adózási és bérszámfejtési határidői</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Összes ügyfél" value={mockKpis.totalClients} icon={Users} />
        <KpiCard title="Feldolgozatlan számlák" value={mockKpis.unprocessedInvoices} icon={FileText} />
        <KpiCard title="Hiányzó számlák" value={mockKpis.missingInvoices} icon={AlertTriangle} valueClass="text-red-600" />
        <KpiCard title="Közeledő határidők" value={mockKpis.upcomingDeadlines} icon={Clock} />
      </div>

      {/* Scope Tabs (Mine / All) */}
      <div className="w-full bg-slate-100/80 p-1.5 rounded-xl border border-slate-200/60 shadow-inner flex items-center">
        <button
          onClick={() => { setViewScope('mine'); setSelectedClient('all'); }}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200",
            viewScope === 'mine' 
              ? "bg-white text-slate-900 shadow-sm" 
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
          )}
        >
          <User className="w-4 h-4" />
          Saját ügyfeleim (5)
        </button>
        <button
          onClick={() => { setViewScope('all'); setSelectedClient('all'); }}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200",
            viewScope === 'all' 
              ? "bg-white text-slate-900 shadow-sm" 
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
          )}
        >
          <Building className="w-4 h-4" />
          Összes irodai ügyfél (24)
        </button>
      </div>

      {/* Calendar Area */}
      <div>
        {/* Calendar Toolbar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handlePrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={handleToday} className="px-4 font-semibold text-slate-700">
              Ma
            </Button>
            <Button variant="outline" size="icon" onClick={handleNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">
            {getHeaderText()}
          </h2>
          
          <div className="flex items-center gap-4">
            <Select value={selectedClient} onValueChange={setSelectedClient}>
              <SelectTrigger className="w-64 bg-white border-slate-200 shadow-sm h-10">
                <SelectValue placeholder="Minden ügyfél" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Minden ügyfél</SelectItem>
                {uniqueClients.map(client => (
                  <SelectItem key={client} value={client}>{client}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="bg-slate-100 p-1 rounded-lg border border-slate-200 flex items-center shadow-inner h-10">
            <button
              onClick={() => setCalendarView('month')}
              className={cn("px-4 py-1.5 rounded-md text-sm font-semibold transition-all duration-200", calendarView === 'month' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50")}
            >
              Havi
            </button>
            <button
              onClick={() => setCalendarView('week')}
              className={cn("px-4 py-1.5 rounded-md text-sm font-semibold transition-all duration-200", calendarView === 'week' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50")}
            >
              Heti
            </button>
            <button
              onClick={() => setCalendarView('list')}
              className={cn("px-4 py-1.5 rounded-md text-sm font-semibold transition-all duration-200", calendarView === 'list' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50")}
            >
              Lista
            </button>
          </div>
          </div>
        </div>
      {calendarView === 'list' ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col divide-y divide-slate-100">
          {getListViewItems().map((item, idx) => (
            <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-slate-50 transition-colors gap-4">
              <div className="font-semibold text-slate-800">
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
                        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-bold transition-all shadow-sm hover:shadow",
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
            <div className="p-8 text-center text-slate-500 font-medium">
              Nincs határidő ebben a hónapban.
            </div>
          )}
        </div>
      ) : (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        
        {/* Calendar Grid */}
        <div className="grid grid-cols-7 border-b border-slate-100">
          {['Mon', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat', 'Vasárnap'].map((day, i) => (
            <div key={day} className={`py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider ${i < 6 ? 'border-r border-slate-100' : ''}`}>
              {day}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 bg-slate-100 gap-[1px]">
          {calendarDays.map((cell, index) => {
            const badges = getBadgesForDay(cell.day, cell.isCurrentMonth);
            
            return (
              <div 
                key={index} 
                className={cn(
                  "bg-white min-h-[120px] p-2 hover:bg-slate-50 transition-colors group",
                  !cell.isCurrentMonth && "text-slate-400 bg-slate-50/50"
                )}
              >
                <div className={cn(
                  "text-sm font-medium mb-2",
                  cell.isCurrentMonth ? "text-slate-700" : "text-slate-400"
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
        <SheetContent className="w-[400px] sm:max-w-[400px] p-0 flex flex-col bg-white border-l shadow-2xl">
          {selectedDeadline && (
            <>
              {/* Drawer Header */}
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 relative">
                <div className="flex items-center gap-3 text-slate-800">
                  <div className="p-2 bg-red-100 text-red-600 rounded-lg shrink-0">
                    <CalendarIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">
                      {currentDate.toLocaleString('hu-HU', { month: 'long' }).charAt(0).toUpperCase() + currentDate.toLocaleString('hu-HU', { month: 'long' }).slice(1)} {selectedDeadline.date}.
                    </h3>
                    <p className="text-sm font-medium text-slate-500">Havi {selectedDeadline.title} Bevallás</p>
                  </div>
                </div>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-bold text-slate-900">
                    {viewScope === 'mine' ? 'Saját ügyfelek' : 'Összes ügyfél'}
                  </h4>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Felelős</span>
                </div>

                <div className="space-y-4">
                  {filteredClients.map((client) => (
                    <div key={client.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                      <div>
                        <p className="text-sm font-bold text-slate-800 mb-1">{client.clientName}</p>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1",
                            client.status === 'Rendben' ? "bg-emerald-100 text-emerald-700" :
                            client.status === 'Feldolgozandó' ? "bg-amber-100 text-amber-700" :
                            "bg-red-100 text-red-700"
                          )}>
                            <div className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              client.status === 'Rendben' ? "bg-emerald-500" :
                              client.status === 'Feldolgozandó' ? "bg-amber-500" :
                              "bg-red-500"
                            )}></div>
                            {client.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500 font-medium">
                          <div className="w-5 h-5 rounded-full bg-slate-300 text-slate-700 flex items-center justify-center text-[10px] font-bold">
                            {client.ownerInitial}
                          </div>
                          Anna
                        </div>
                      </div>
                      
                      {client.status !== 'Rendben' && (
                        <Button variant="outline" size="sm" className="h-8 text-xs font-semibold gap-1.5 border-slate-200">
                          <Mail className="w-3.5 h-3.5 text-slate-500" />
                          Értesítés
                        </Button>
                      )}
                    </div>
                  ))}

                  {filteredClients.length === 0 && (
                    <div className="text-center py-8 text-slate-500 text-sm">
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
