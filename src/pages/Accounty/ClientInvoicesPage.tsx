import React, { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronDown, RefreshCcw, Upload, Search, MoreVertical, Cloud, Clock, Calendar, Download, Settings, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { mockClients, mockInvoices } from './mockData';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export default function ClientInvoicesPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  
  const client = mockClients.find((c) => c.id === id) || mockClients[0];
  
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  
  const [isNavSyncOpen, setIsNavSyncOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  const filteredInvoices = useMemo(() => {
    return mockInvoices.filter((inv) => {
      // For now, filter by clientId if we want strict client scope.
      // Assuming mockInvoices only has one client's invoices for demo, but let's filter by it just in case.
      // Wait, in my mockData I hardcoded clientId: '1'. Let's just use it regardless or filter by clientId if matches.
      // Actually, if we filter by clientId and we view client id='2', it's empty. Let's just show all for demo purposes.
      const matchSearch = inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          inv.partnerName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = statusFilter === 'all' || inv.status === statusFilter;
      const matchType = typeFilter === 'all' || inv.type === typeFilter;
      return matchSearch && matchStatus && matchType;
    });
  }, [searchQuery, statusFilter, typeFilter]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hu-HU', { style: 'currency', currency: 'HUF', minimumFractionDigits: 0 }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Új':
        return <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 text-xs font-semibold">Új</span>;
      case 'Kontírozásra vár':
        return <span className="px-2.5 py-1 rounded-md bg-amber-100 text-amber-700 text-xs font-semibold">Kontírozásra vár</span>;
      case 'Kontírozott':
        return <span className="px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-700 text-xs font-semibold">Kontírozott</span>;
      case 'Exportálva':
        return <span className="px-2.5 py-1 rounded-md bg-blue-100 text-blue-700 text-xs font-semibold">Exportálva</span>;
      case 'Problémás':
        return <span className="px-2.5 py-1 rounded-md bg-red-100 text-red-700 text-xs font-semibold">Problémás</span>;
      default:
        return <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 text-xs font-semibold">{status}</span>;
    }
  };

  const totalGross = filteredInvoices.reduce((sum, inv) => sum + inv.grossAmount, 0);
  const totalVat = filteredInvoices.reduce((sum, inv) => sum + inv.vatAmount, 0);

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500 pb-12">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex items-start gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            className="w-8 h-8 mt-1.5 shrink-0 hover:bg-slate-100"
            onClick={() => navigate(`/accounty/client/${client.id}`)}
          >
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </Button>
          <div>
            <div className="flex items-center gap-1.5 mb-1 cursor-pointer hover:bg-slate-100 px-2 py-0.5 -ml-2 rounded-md transition-colors w-max">
              <span className="text-xs font-semibold text-slate-500">{client.name}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Számlák</h1>
          </div>
        </div>

        <div className="flex gap-3">
          <Dialog open={isNavSyncOpen} onOpenChange={setIsNavSyncOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 bg-white border-slate-200 text-slate-700 hover:bg-slate-50">
                <RefreshCcw className="w-4 h-4" /> NAV szinkron
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden bg-white">
              <div className="p-6">
                <DialogHeader className="mb-6">
                  <DialogTitle className="flex items-center gap-2 text-lg text-slate-900 font-bold">
                    <RefreshCcw className="w-5 h-5" />
                    NAV Online Számla szinkronizálás
                  </DialogTitle>
                  <p className="text-sm text-slate-500 mt-1">Számlák importálása a NAV Online Számla rendszerből</p>
                </DialogHeader>

                {/* Status Box */}
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 mb-6">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                      <Clock className="w-4 h-4 text-slate-400" />
                      Utolsó szinkronizálás:
                    </div>
                    <span className="text-sm font-bold text-slate-900">2024-01-15 10:30</span>
                  </div>
                  <div className="flex gap-4 text-sm font-medium">
                    <span className="text-emerald-600">12 importálva</span>
                    <span className="text-amber-500">2 duplikált</span>
                    <span className="text-red-500">0 hiba</span>
                  </div>
                </div>

                {/* Time Range */}
                <div className="space-y-3 mb-6">
                  <h3 className="text-sm font-bold text-slate-900">Időszak</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600">Kezdő dátum</label>
                      <div className="relative">
                        <Input defaultValue="2024. 01. 01." className="bg-white border-slate-200" />
                        <Calendar className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600">Záró dátum</label>
                      <div className="relative">
                        <Input defaultValue="2024. 01. 31." className="bg-white border-slate-200" />
                        <Calendar className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Invoice Types */}
                <div className="space-y-3 mb-8">
                  <h3 className="text-sm font-bold text-slate-900">Számla típusok</h3>
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-[#1A1F2C] flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                      <Download className="w-4 h-4 text-emerald-600" />
                      <span className="text-sm font-medium text-slate-900">Bejövő számlák (vásárlások)</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-[#1A1F2C] flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                      <Upload className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-slate-900">Kimenő számlák (értékesítések)</span>
                    </div>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-between pt-2">
                  <DialogTrigger asChild>
                    <Button variant="outline" className="bg-white border-slate-200 text-slate-700 px-6 h-10">
                      Mégse
                    </Button>
                  </DialogTrigger>
                  <div className="flex items-center gap-3">
                    <Button variant="outline" className="gap-2 bg-white border-slate-200 text-slate-700 h-10">
                      <Settings className="w-4 h-4" /> Beállítások
                    </Button>
                    <Button className="gap-2 bg-[#1A1F2C] hover:bg-[#1A1F2C]/90 text-white px-6 h-10">
                      <RefreshCcw className="w-4 h-4" /> Szinkronizálás
                    </Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-[#1A1F2C] hover:bg-[#1A1F2C]/90 text-white">
                <Upload className="w-4 h-4" /> Számla feltöltése
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] p-6">
              <DialogHeader>
                <DialogTitle className="text-lg text-slate-900 font-semibold mb-2">Számlák feltöltése</DialogTitle>
              </DialogHeader>

              {/* Drag & Drop Area */}
              <div className="border border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center bg-transparent mt-2 mb-6">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                  <Cloud className="w-5 h-5 text-slate-600" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-1.5 text-sm">Húzd ide a fájlokat vagy kattints a tallózáshoz</h3>
                <p className="text-xs text-slate-400 mb-4">PDF, JPG, PNG (max 10 MB / fájl)</p>
                <Button variant="outline" className="bg-white border-slate-200 text-slate-700 h-9 px-6 font-medium text-xs">
                  Tallózás
                </Button>
              </div>

              {/* Email Option */}
              <div className="space-y-4 mb-2">
                <div className="flex items-center gap-3 cursor-pointer group">
                  <div className="w-4 h-4 rounded-full border border-slate-400 group-hover:border-slate-500 transition-colors flex items-center justify-center shrink-0"></div>
                  <span className="text-sm font-semibold text-slate-800">E-mailből importálás</span>
                </div>
                <button 
                  onClick={() => {
                    setIsUploadOpen(false);
                    setTimeout(() => setIsNavSyncOpen(true), 150); // slight delay to allow smooth transition
                  }}
                  className="text-sm text-slate-500 hover:text-slate-800 transition-colors text-left flex items-center gap-2 font-medium"
                >
                  NAV szinkronizálás indítása
                </button>
              </div>

              {/* Footer Actions */}
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-50">
                <DialogTrigger asChild>
                  <Button variant="outline" className="bg-white border-slate-200 text-slate-700 px-6">
                    Mégse
                  </Button>
                </DialogTrigger>
                <Button disabled className="bg-[#8A95A5] text-white hover:bg-[#8A95A5] cursor-not-allowed px-6 opacity-80">
                  Feltöltés
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white">
          <div className="w-96 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Keresés számla szám, szállító..." 
              className="pl-9 bg-white border-slate-200" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-48 bg-white border-slate-200">
                <SelectValue placeholder="Minden típus" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Minden típus</SelectItem>
                <SelectItem value="bejovo">Bejövő</SelectItem>
                <SelectItem value="kimeno">Kimenő</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48 bg-white border-slate-200">
                <SelectValue placeholder="Minden státusz" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Minden státusz</SelectItem>
                <SelectItem value="Új">Új</SelectItem>
                <SelectItem value="Kontírozásra vár">Kontírozásra vár</SelectItem>
                <SelectItem value="Kontírozott">Kontírozott</SelectItem>
                <SelectItem value="Exportálva">Exportálva</SelectItem>
                <SelectItem value="Problémás">Problémás</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-white border-b border-slate-100 text-slate-500 font-medium text-xs">
              <tr>
                <th className="px-6 py-4 w-12 text-center font-medium"><input type="checkbox" className="rounded border-slate-300 w-4 h-4 accent-slate-900" /></th>
                <th className="px-6 py-4 font-medium">Számla sorszám</th>
                <th className="px-6 py-4 font-medium">Szállító/Vevő</th>
                <th className="px-6 py-4 font-medium">Dátum</th>
                <th className="px-6 py-4 font-medium text-right">Bruttó</th>
                <th className="px-6 py-4 font-medium text-right">ÁFA</th>
                <th className="px-6 py-4 font-medium">Státusz</th>
                <th className="px-6 py-4 w-12 text-center font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.length > 0 ? (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4 text-center"><input type="checkbox" className="rounded border-slate-300 w-4 h-4 accent-slate-900" /></td>
                    <td className="px-6 py-4 font-medium text-slate-900">{inv.invoiceNumber}</td>
                    <td className="px-6 py-4 text-slate-600">{inv.partnerName}</td>
                    <td className="px-6 py-4 text-slate-500">{inv.date}</td>
                    <td className="px-6 py-4 text-slate-900 font-semibold text-right">{formatCurrency(inv.grossAmount)}</td>
                    <td className="px-6 py-4 text-slate-500 text-right">{formatCurrency(inv.vatAmount)}</td>
                    <td className="px-6 py-4">
                      {getStatusBadge(inv.status)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="text-slate-400 hover:text-slate-600 p-1 transition-colors opacity-0 group-hover:opacity-100">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem className="cursor-pointer">Megtekintés</DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer">Kontírozás</DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer text-red-600 focus:text-red-600">Törlés</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-500">
                    Nincs találat a megadott szűrésre.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Summary */}
        <div className="bg-slate-50/50 p-4 border-t border-slate-100 flex items-center gap-6 text-xs text-slate-600">
          <div>Számlák: <span className="font-bold text-slate-900">{filteredInvoices.length}</span></div>
          <div>Összesen: <span className="font-bold text-slate-900">{formatCurrency(totalGross)}</span></div>
          <div>ÁFA: <span className="font-bold text-slate-900">{formatCurrency(totalVat)}</span></div>
        </div>

      </div>
    </div>
  );
}
