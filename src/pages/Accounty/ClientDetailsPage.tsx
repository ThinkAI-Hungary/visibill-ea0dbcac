import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  ArrowLeft, Settings, FileText, UploadCloud, RefreshCcw, FileCheck,
  Clock, AlertTriangle, FileWarning, TrendingUp, CheckCircle2, ChevronRight,
  Bell
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { mockClients } from './mockData';

export default function ClientDetailsPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState('Áttekintés');
  
  // Try to find the client from mockData, otherwise use generic data
  const client = mockClients.find(c => c.id === id) || {
    id: id || '1',
    name: 'Tech Solutions Kft.',
    taxNumber: '12345678-1-42'
  };

  const tabs = ['Áttekintés', 'Számlák', 'Bérszámfejtés', 'Riportok', 'Beállítások'];

  const invoiceData = [
    { id: 1, number: 'INV-2024-001', company: 'ABC Kft.', amount: '254 000 Ft', date: '2024.01.15', status: 'Feldolgozás alatt', dotColor: 'bg-blue-500', statusColor: 'bg-amber-100 text-amber-700' },
    { id: 2, number: 'INV-2024-002', company: 'XYZ Zrt.', amount: '127 500 Ft', date: '2024.01.14', status: 'Könyvelve', dotColor: 'bg-emerald-500', statusColor: 'bg-emerald-100 text-emerald-700' },
    { id: 3, number: 'INV-2024-003', company: 'Demo Bt.', amount: '89 000 Ft', date: '2024.01.13', status: 'Jóváhagyva', dotColor: 'bg-blue-500', statusColor: 'bg-slate-100 text-slate-600' },
    { id: 4, number: 'INV-2024-004', company: 'Partner Kft.', amount: '456 000 Ft', date: '2024.01.12', status: 'Feldolgozás alatt', dotColor: 'bg-blue-500', statusColor: 'bg-amber-100 text-amber-700' },
    { id: 5, number: 'INV-2024-005', company: 'Service Zrt.', amount: '78 500 Ft', date: '2024.01.11', status: 'Könyvelve', dotColor: 'bg-emerald-500', statusColor: 'bg-emerald-100 text-emerald-700' },
  ];

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{client.name}</h1>
            <p className="text-sm text-slate-500">{client.taxNumber}</p>
          </div>
        </div>
        <button className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600">
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-full w-fit">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium transition-all",
              activeTab === tab 
                ? "bg-white text-slate-900 shadow-sm" 
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* TABS CONTENT */}
      
      {/* Áttekintés Tab */}
      {activeTab === 'Áttekintés' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-4">
            <div 
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm cursor-pointer transition-all duration-200 hover:shadow-md hover:border-indigo-300 hover:-translate-y-1"
              onClick={() => setActiveTab('Számlák')}
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-sm font-medium text-slate-500">Feldolgozatlan számlák</h3>
                <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-amber-500" />
                </div>
              </div>
              <div className="text-3xl font-bold text-slate-900">5</div>
            </div>

            <div 
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm cursor-pointer transition-all duration-200 hover:shadow-md hover:border-indigo-300 hover:-translate-y-1"
              onClick={() => setActiveTab('Számlák')}
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-sm font-medium text-slate-500">Kontírozásra vár</h3>
                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                  <FileCheck className="w-4 h-4 text-blue-500" />
                </div>
              </div>
              <div className="text-3xl font-bold text-slate-900">3</div>
            </div>

            <div 
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm cursor-pointer transition-all duration-200 hover:shadow-md hover:border-indigo-300 hover:-translate-y-1"
              onClick={() => navigate(`/accounty/missing-invoices/${client.id}`)}
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-sm font-medium text-slate-500">Hiányzó számlák</h3>
                <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center">
                  <FileWarning className="w-4 h-4 text-red-500" />
                </div>
              </div>
              <div className="text-3xl font-bold text-slate-900">2</div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm cursor-pointer transition-all duration-200 hover:shadow-md hover:border-indigo-300 hover:-translate-y-1">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-sm font-medium text-slate-500">ÁFA egyenleg (becsült)</h3>
                <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                </div>
              </div>
              <div className="text-3xl font-bold text-slate-900">245,000 Ft</div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-3 gap-4">
            <Button className="h-14 bg-[#1A1F2C] hover:bg-[#1A1F2C]/90 text-white rounded-xl text-base font-semibold flex items-center justify-center gap-2">
              <FileCheck className="w-5 h-5" />
              Számlák feldolgozása
            </Button>
            <Button 
              variant="outline" 
              className="h-14 bg-white border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-base font-semibold flex items-center justify-center gap-2"
              onClick={() => navigate(`/accounty/missing-invoices/${client.id}`)}
            >
              <AlertTriangle className="w-5 h-5 text-slate-400" />
              Hiányzók bekérése
            </Button>
            <Button 
              variant="outline" 
              className="h-14 bg-white border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-base font-semibold flex items-center justify-center gap-2"
              onClick={() => navigate(`/accounty/client/${client.id}/reports`)}
            >
              <UploadCloud className="w-5 h-5 text-slate-400" />
              Riport generálása
            </Button>
          </div>

          {/* 🚨 Zárást blokkoló hiányosságok */}
          <div id="missing-items-section" className="mt-8 mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">🚨 Zárást blokkoló hiányosságok</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              
              {/* Oszlop 1: Bejövő */}
              <div className="bg-slate-100/80 border border-slate-200 rounded-xl p-4 flex flex-col gap-3 min-h-[300px]">
                <h3 className="text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">📥 Bejövő</h3>
                <div className="bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow rounded-lg p-3 flex justify-between items-start gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 leading-tight">MOL Nyrt.</p>
                    <p className="text-xs font-medium text-slate-500 mt-1">24.500 Ft (PDF hiányzik)</p>
                  </div>
                  <button className="p-2 rounded-md bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 transition-all cursor-pointer shadow-sm shrink-0" title="Hiánypótlás kérése">
                    <Bell size={16} />
                  </button>
                </div>
              </div>

              {/* Oszlop 2: Kimenő */}
              <div className="bg-slate-100/80 border border-slate-200 rounded-xl p-4 flex flex-col gap-3 min-h-[300px]">
                <h3 className="text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">📤 Kimenő</h3>
                <div className="bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow rounded-lg p-3 flex justify-between items-start gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 leading-tight">Partner Kft.</p>
                    <p className="text-xs font-medium text-slate-500 mt-1">120.000 Ft (5 napja lejárt)</p>
                  </div>
                  <button className="p-2 rounded-md bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 transition-all cursor-pointer shadow-sm shrink-0" title="Hiánypótlás kérése">
                    <Bell size={16} />
                  </button>
                </div>
              </div>

              {/* Oszlop 3: Bank */}
              <div className="bg-slate-100/80 border border-slate-200 rounded-xl p-4 flex flex-col gap-3 min-h-[300px]">
                <h3 className="text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">🏦 Bank</h3>
                <div className="bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow rounded-lg p-3 flex justify-between items-start gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 leading-tight">Hiányzó kivonat</p>
                    <p className="text-xs font-medium text-slate-500 mt-1">Május 01-15</p>
                  </div>
                  <button className="p-2 rounded-md bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 transition-all cursor-pointer shadow-sm shrink-0" title="Hiánypótlás kérése">
                    <Bell size={16} />
                  </button>
                </div>
              </div>

              {/* Oszlop 4: Bér */}
              <div className="bg-slate-100/80 border border-slate-200 rounded-xl p-4 flex flex-col gap-3 min-h-[300px]">
                <h3 className="text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">👥 Bér</h3>
                <div className="bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow rounded-lg p-3 flex justify-between items-start gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 leading-tight">Májusi jelenléti ívek</p>
                    <p className="text-xs font-medium text-red-500 mt-1">(❌)</p>
                  </div>
                  <button className="p-2 rounded-md bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 transition-all cursor-pointer shadow-sm shrink-0" title="Hiánypótlás kérése">
                    <Bell size={16} />
                  </button>
                </div>
              </div>

            </div>
          </div>

          {/* Bottom Section */}
          <div className="grid grid-cols-2 gap-6">
            
            {/* Recent Activities */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="p-5 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-semibold text-slate-900">Legutóbbi tevékenységek</h3>
                <button className="text-xs font-semibold text-slate-500 hover:text-slate-900 flex items-center transition-colors">
                  Összes <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                </button>
              </div>
              <div className="p-2 flex-1">
                <div className="flex items-start gap-4 p-3 hover:bg-slate-50 rounded-lg transition-colors">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                    <UploadCloud className="w-4 h-4 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">12 számla feltöltve</p>
                    <p className="text-xs text-slate-500">2024.01.15</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4 p-3 hover:bg-slate-50 rounded-lg transition-colors">
                  <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center shrink-0 mt-0.5">
                    <FileText className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Bérszámfejtés lezárva</p>
                    <p className="text-xs text-slate-500">2024.01.14</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-3 hover:bg-slate-50 rounded-lg transition-colors">
                  <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                    <RefreshCcw className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">NAV szinkronizálás</p>
                    <p className="text-xs text-slate-500">2024.01.13</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-3 hover:bg-slate-50 rounded-lg transition-colors">
                  <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center shrink-0 mt-0.5">
                    <FileCheck className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">5 számla kontírozva</p>
                    <p className="text-xs text-slate-500">2024.01.12</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Upcoming Deadlines */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="p-5 border-b border-slate-100">
                <h3 className="font-semibold text-slate-900">Következő határidők</h3>
              </div>
              <div className="p-4 space-y-3 flex-1">
                
                <div className="border border-slate-100 bg-slate-50/50 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-white shadow-sm border border-slate-200 flex items-center justify-center shrink-0">
                      <Clock className="w-5 h-5 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">ÁFA bevallás</p>
                      <p className="text-xs text-slate-500">2024.01.20</p>
                    </div>
                  </div>
                  <div className="px-2.5 py-1 rounded-full bg-slate-200/50 text-slate-600 text-[10px] font-bold uppercase tracking-wider">
                    5 nap
                  </div>
                </div>

                <div className="border border-red-100 bg-red-50/30 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-white shadow-sm border border-red-100 flex items-center justify-center shrink-0">
                      <Clock className="w-5 h-5 text-red-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-red-600">Bérszámfejtés</p>
                      <p className="text-xs text-red-500/80">2024.01.10</p>
                    </div>
                  </div>
                  <div className="px-2.5 py-1 rounded-full bg-red-100 text-red-600 text-[10px] font-bold uppercase tracking-wider">
                    5 napja lejárt
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

      {/* Számlák Tab */}
      {activeTab === 'Számlák' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h3 className="text-sm font-medium text-slate-500 mb-2">Összes számla</h3>
              <div className="text-3xl font-bold text-slate-900">47</div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h3 className="text-sm font-medium text-slate-500 mb-2">Feldolgozásra vár</h3>
              <div className="text-3xl font-bold text-amber-500">8</div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h3 className="text-sm font-medium text-slate-500 mb-2">Bruttó összesen</h3>
              <div className="text-2xl font-bold text-slate-900 mt-1">4 567 000 Ft</div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h3 className="text-sm font-medium text-slate-500 mb-2">ÁFA összesen</h3>
              <div className="text-2xl font-bold text-slate-900 mt-1">912 000 Ft</div>
            </div>
          </div>

          {/* Invoices List */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-white">
              <h3 className="font-semibold text-slate-900">Legutóbbi számlák</h3>
              <Button 
                variant="outline" 
                size="sm" 
                className="bg-white text-xs text-slate-600 h-8"
                onClick={() => navigate(`/accounty/client/${id}/invoices`)}
              >
                Összes megtekintése <ChevronRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
            <div className="p-2 space-y-1 bg-white">
              {invoiceData.map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between p-4 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer group">
                  <div className="flex items-center gap-4">
                    <div className={`w-2 h-2 rounded-full ${invoice.dotColor}`}></div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{invoice.number}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{invoice.company}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-900">{invoice.amount}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{invoice.date}</p>
                    </div>
                    <div className={cn("px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider w-32 text-center", invoice.statusColor)}>
                      {invoice.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
