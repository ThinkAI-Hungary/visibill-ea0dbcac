import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock, MoreVertical, FileText, Settings, Search, ChevronRight, Mail, Phone, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

// Mock data based on screenshot
const missingInvoicesData = [
  { id: 1, name: 'Tech Solutions Kft.', missing: 5, critical: 2, lastNotice: '2024. 01. 14. (1x)', status: 'Felszólítva', statusType: 'warning' },
  { id: 2, name: 'Digital Partners Zrt.', missing: 8, critical: 3, lastNotice: '-', status: 'Kritikus', statusType: 'danger' },
  { id: 3, name: 'Innovation Labs Kft.', missing: 8, critical: 1, lastNotice: '2024. 01. 10. (2x)', status: 'Felszólítva', statusType: 'warning' },
  { id: 4, name: 'Smart Office Bt.', missing: 2, critical: 0, lastNotice: '-', status: 'Nincs felszólítva', statusType: 'neutral' },
  { id: 5, name: 'Global Trade Kft.', missing: 6, critical: 4, lastNotice: '2024. 01. 08. (3x)', status: 'Kritikus', statusType: 'danger' },
];

export default function MissingInvoicesPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredData = React.useMemo(() => {
    return missingInvoicesData.filter(row => {
      const matchesSearch = row.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || row.statusType === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [searchQuery, statusFilter]);

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
       {/* Header */}
       <div className="flex justify-between items-start">
         <div>
           <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Hiányzó számlák</h1>
           <p className="text-sm text-slate-500 mt-1">Hiányzó számlák bekérése</p>
         </div>
         <div className="flex gap-3">
           <Button 
             variant="outline" 
             size="sm" 
             className="gap-2 bg-white border-slate-200 text-slate-700 hover:bg-slate-50 h-9 px-4"
             onClick={() => navigate('/accounty/reports/missing-invoices')}
           >
             <FileText className="w-4 h-4"/> Riportok
           </Button>
           <Button variant="outline" size="sm" className="gap-2 bg-white border-slate-200 text-slate-700 hover:bg-slate-50 h-9 px-4">
             <Settings className="w-4 h-4"/> Beállítások
           </Button>
         </div>
       </div>

       {/* Alert Banner */}
       <div className="border border-red-200 bg-red-50/50 rounded-xl p-4 flex gap-3 text-red-600 shadow-sm">
         <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
         <div>
           <h3 className="font-semibold text-sm">Bevallási határidő közeleg!</h3>
           <p className="text-sm text-red-600/80 mt-0.5">5 nap múlva lejár a bevallási határidő. 10 kritikus számla még hiányzik.</p>
         </div>
       </div>

       {/* KPI Cards */}
       <div className="grid grid-cols-4 gap-4">
         <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
           <h3 className="text-sm font-medium text-slate-500">Összes hiányzó</h3>
           <div className="mt-4">
             <div className="text-2xl font-bold text-slate-900">24</div>
             <p className="text-xs text-slate-500 mt-1">5 ügyféltől</p>
           </div>
         </div>
         <div className="bg-white rounded-xl border border-red-200 p-5 shadow-sm flex flex-col justify-between">
           <h3 className="text-sm font-medium text-red-500">Kritikus</h3>
           <div className="mt-4">
             <div className="text-2xl font-bold text-red-600">10</div>
             <p className="text-xs text-red-500 mt-1">Sürgős bekérés</p>
           </div>
         </div>
         <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
           <h3 className="text-sm font-medium text-slate-500">Küldött felszólítások</h3>
           <div className="mt-4">
             <div className="text-2xl font-bold text-slate-900">15</div>
             <p className="text-xs text-slate-500 mt-1">ez a hónap</p>
           </div>
         </div>
         <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
           <h3 className="text-sm font-medium text-slate-500 mb-4">Válaszadási arány</h3>
           <div>
             <div className="text-2xl font-bold text-slate-900 mb-2">67%</div>
             <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
               <div className="h-full bg-slate-800 rounded-full" style={{ width: '67%' }}></div>
             </div>
           </div>
         </div>
       </div>

       {/* Toolbar */}
       <div className="flex justify-between items-center py-2">
         <div className="w-72 relative">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
           <Input 
             placeholder="Keresés ügyfél..." 
             className="pl-9 bg-white border-slate-200" 
             value={searchQuery}
             onChange={(e) => setSearchQuery(e.target.value)}
           />
         </div>
         <div className="w-48">
           <Select value={statusFilter} onValueChange={setStatusFilter}>
             <SelectTrigger className="bg-white border-slate-200">
               <SelectValue placeholder="Minden státusz" />
             </SelectTrigger>
             <SelectContent>
               <SelectItem value="all">Minden státusz</SelectItem>
               <SelectItem value="critical">Kritikus</SelectItem>
               <SelectItem value="warning">Felszólítva</SelectItem>
               <SelectItem value="neutral">Nincs felszólítva</SelectItem>
             </SelectContent>
           </Select>
         </div>
       </div>

       {/* Table */}
       <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
         <table className="w-full text-sm text-left">
           <thead className="bg-slate-50/50 border-b border-slate-200 text-slate-500 font-medium text-xs uppercase tracking-wider">
             <tr>
               <th className="px-6 py-4 w-12 text-center"><input type="checkbox" className="rounded border-slate-300 w-4 h-4 accent-slate-900" /></th>
               <th className="px-6 py-4">Ügyfél</th>
               <th className="px-6 py-4 text-center">Hiányzó</th>
               <th className="px-6 py-4 text-center">Kritikus</th>
               <th className="px-6 py-4">Utolsó felszólítás</th>
               <th className="px-6 py-4">Státusz</th>
               <th className="px-6 py-4 w-12 text-center"></th>
             </tr>
           </thead>
           <tbody className="divide-y divide-slate-100">
             {filteredData.length > 0 ? (
               filteredData.map((row) => (
               <tr 
                 key={row.id} 
                 onClick={() => navigate(`/accounty/missing-invoices/${row.id}`)}
                 className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
               >
                 <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}><input type="checkbox" className="rounded border-slate-300 w-4 h-4 accent-slate-900" /></td>
                 <td className="px-6 py-4 font-semibold text-slate-900 hover:text-emerald-600 transition-colors">{row.name}</td>
                 <td className="px-6 py-4 text-center">
                   <span className="w-7 h-7 rounded-full border border-slate-200 bg-white shadow-sm flex items-center justify-center mx-auto text-xs font-semibold text-slate-700">{row.missing}</span>
                 </td>
                 <td className="px-6 py-4 text-center">
                   {row.critical > 0 ? (
                     <span className="w-7 h-7 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto text-xs font-semibold">{row.critical}</span>
                   ) : <span className="text-slate-300">-</span>}
                 </td>
                 <td className="px-6 py-4 text-slate-500">
                   {row.lastNotice !== '-' ? (
                     <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {row.lastNotice}</div>
                   ) : '-'}
                 </td>
                 <td className="px-6 py-4">
                   <span className={cn(
                     "px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider",
                     row.statusType === 'danger' && "bg-red-50 text-red-600",
                     row.statusType === 'warning' && "bg-amber-50 text-amber-600",
                     row.statusType === 'neutral' && "bg-slate-100 text-slate-500"
                   )}>
                     {row.status}
                   </span>
                 </td>
                 <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                   <DropdownMenu>
                     <DropdownMenuTrigger asChild>
                       <button className="text-slate-400 hover:text-slate-600 p-1 transition-colors">
                         <MoreVertical className="w-4 h-4" />
                       </button>
                     </DropdownMenuTrigger>
                     <DropdownMenuContent align="end" className="w-48">
                       <DropdownMenuItem onClick={() => navigate(`/accounty/missing-invoices/${row.id}`)} className="cursor-pointer">
                         <ChevronRight className="w-4 h-4 mr-2" />
                         Részletek
                       </DropdownMenuItem>
                       <DropdownMenuItem className="cursor-pointer">
                         <Mail className="w-4 h-4 mr-2" />
                         Email küldés
                       </DropdownMenuItem>
                       <DropdownMenuItem className="cursor-pointer">
                         <Phone className="w-4 h-4 mr-2" />
                         AI telefonhívás
                       </DropdownMenuItem>
                       <DropdownMenuItem className="cursor-pointer text-emerald-600 focus:text-emerald-600 focus:bg-emerald-50">
                         <CheckCircle2 className="w-4 h-4 mr-2" />
                         Megérkezettnek jelöl
                       </DropdownMenuItem>
                     </DropdownMenuContent>
                   </DropdownMenu>
                 </td>
               </tr>
             ))
           ) : (
             <tr>
               <td colSpan={7} className="text-center py-12 text-slate-500">
                 Nincs találat a keresésre.
               </td>
             </tr>
           )}
           </tbody>
         </table>
       </div>
    </div>
  );
}
