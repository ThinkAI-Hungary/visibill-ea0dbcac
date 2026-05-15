import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar, FileText, PieChart, TrendingUp, Users, FileWarning, 
  Filter, Eye, Download, FileJson, Mail, ChevronRight, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

type ReportType = 'havi' | 'afa' | 'koltseg' | 'cashflow' | 'partner' | 'hianyzo';

const reportTypes = [
  { id: 'havi', title: 'Havi összesítő', description: 'Bejövő és kimenő számlák összesítése, ÁFA kimutatás', icon: Calendar, color: 'text-indigo-500', bg: 'bg-indigo-50' },
  { id: 'afa', title: 'ÁFA kimutatás', description: 'Részletes ÁFA bontás kategóriánként', icon: FileText, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  { id: 'koltseg', title: 'Költségkimutatás', description: 'Költségek főkönyvi szám és kategória szerint', icon: PieChart, color: 'text-amber-500', bg: 'bg-amber-50' },
  { id: 'cashflow', title: 'Cash flow riport', description: 'Pénzforgalom és likviditás elemzés', icon: TrendingUp, color: 'text-blue-500', bg: 'bg-blue-50' },
  { id: 'partner', title: 'Partner kimutatás', description: 'Szállítói és vevői forgalom riport', icon: Users, color: 'text-rose-500', bg: 'bg-rose-50' },
  { id: 'hianyzo', title: 'Hiányzó számlák riport', description: 'Automatikus bekérő statisztikák', icon: FileWarning, color: 'text-red-500', bg: 'bg-red-50' },
];

const recentReports = [
  { id: 1, title: 'Tech Solutions - Havi összesítő 2024 Január', date: '2024. 01. 15.', client: 'Tech Solutions Kft.', format: 'PDF', iconColor: 'text-red-500', bg: 'bg-red-50' },
  { id: 2, title: 'Digital Partners - ÁFA kimutatás Q4 2023', date: '2024. 01. 10.', client: 'Digital Partners Zrt.', format: 'EXCEL', iconColor: 'text-emerald-500', bg: 'bg-emerald-50' },
  { id: 3, title: 'Innovation Labs - Költségkimutatás 2023', date: '2024. 01. 05.', client: 'Innovation Labs Kft.', format: 'PDF', iconColor: 'text-red-500', bg: 'bg-red-50' },
  { id: 4, title: 'Smart Office - Havi összesítő 2024 Január', date: '2024. 01. 14.', client: 'Smart Office Bt.', format: 'PDF', iconColor: 'text-red-500', bg: 'bg-red-50' },
  { id: 5, title: 'Global Trade - Cash flow riport Q4', date: '2024. 01. 08.', client: 'Global Trade Kft.', format: 'EXCEL', iconColor: 'text-emerald-500', bg: 'bg-emerald-50' },
];

export default function ReportsPage() {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<ReportType>('havi');
  const [format, setFormat] = useState<'pdf' | 'excel'>('pdf');

  const openModal = (type: ReportType) => {
    if (type === 'hianyzo') {
      navigate('/accounty/reports/missing-invoices');
      return;
    }
    setSelectedType(type);
    setIsModalOpen(true);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 relative">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Riportok</h1>
        <p className="text-sm text-slate-500 mt-1">Átfogó riportok és kimutatások</p>
      </div>

      {/* Report Types Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reportTypes.map((report) => (
          <button 
            key={report.id}
            onClick={() => openModal(report.id as ReportType)}
            className="flex flex-col text-left bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 hover:shadow-sm transition-all group relative overflow-hidden"
          >
            <div className="flex justify-between items-start w-full mb-4">
              <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", report.bg)}>
                <report.icon className={cn("w-5 h-5", report.color)} />
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-500 transition-colors" />
            </div>
            <h3 className="font-semibold text-slate-900 mb-1">{report.title}</h3>
            <p className="text-xs text-slate-500 line-clamp-2">{report.description}</p>
          </button>
        ))}
      </div>

      {/* Recent Reports */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-slate-900">Legutóbbi riportok</h2>
          <Button variant="outline" size="sm" className="gap-2 bg-white h-9">
            <Filter className="w-4 h-4" /> Szűrés
          </Button>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden divide-y divide-slate-100">
          {recentReports.map((report) => (
            <div key={report.id} className="flex items-center justify-between p-4 hover:bg-slate-50/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", report.bg)}>
                  <FileText className={cn("w-5 h-5", report.iconColor)} />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900 text-sm">{report.title}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">{report.date} • {report.client}</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <span className={cn(
                  "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider",
                  report.format === 'PDF' ? "bg-slate-100 text-slate-600" : "bg-slate-100 text-slate-600"
                )}>
                  {report.format}
                </span>
                <div className="flex items-center gap-2">
                  <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors rounded-full hover:bg-slate-100"><Eye className="w-4 h-4" /></button>
                  <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors rounded-full hover:bg-slate-100"><Download className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal Overlay & Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" 
            onClick={() => setIsModalOpen(false)}
          ></div>
          
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 z-10 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex justify-between items-start p-6 border-b border-slate-100 shrink-0">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Riport generálása</h2>
                <p className="text-sm text-slate-500 mt-1">Állítsd be a riport paramétereit</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 overflow-y-auto">
              {/* Report Type Selection */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-slate-900">Riport típusa</Label>
                <RadioGroup value={selectedType} onValueChange={(v) => setSelectedType(v as ReportType)} className="grid grid-cols-2 gap-3">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="havi" id="type-havi" className="border-slate-300 text-slate-900" />
                    <Label htmlFor="type-havi" className="text-sm font-normal cursor-pointer">Havi összesítő</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="afa" id="type-afa" className="border-slate-300 text-slate-900" />
                    <Label htmlFor="type-afa" className="text-sm font-normal cursor-pointer">ÁFA kimutatás</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="koltseg" id="type-koltseg" className="border-slate-300 text-slate-900" />
                    <Label htmlFor="type-koltseg" className="text-sm font-normal cursor-pointer">Költségkimutatás</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="cashflow" id="type-cashflow" className="border-slate-300 text-slate-900" />
                    <Label htmlFor="type-cashflow" className="text-sm font-normal cursor-pointer">Cash flow riport</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="partner" id="type-partner" className="border-slate-300 text-slate-900" />
                    <Label htmlFor="type-partner" className="text-sm font-normal cursor-pointer">Partner kimutatás</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Date Range */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-slate-900">Időszak</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">Kezdő dátum</Label>
                    <div className="relative">
                      <Input defaultValue="2024. 01. 01." className="bg-white border-slate-200 text-sm pl-10" />
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <div className="bg-blue-600 text-white text-[10px] font-bold px-1 rounded-sm">2024</div>
                      </div>
                      <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">Záró dátum</Label>
                    <div className="relative">
                      <Input defaultValue="2024. 01. 31." className="bg-white border-slate-200 text-sm" />
                      <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Format Toggle */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-slate-900">Formátum</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setFormat('pdf')}
                    className={cn(
                      "flex items-center gap-2 p-3 rounded-xl border-2 transition-colors text-sm font-medium",
                      format === 'pdf' ? "border-slate-900 bg-slate-50" : "border-slate-100 hover:border-slate-200"
                    )}
                  >
                    <FileText className={cn("w-4 h-4", format === 'pdf' ? "text-red-500" : "text-slate-400")} />
                    PDF
                  </button>
                  <button 
                    onClick={() => setFormat('excel')}
                    className={cn(
                      "flex items-center gap-2 p-3 rounded-xl border-2 transition-colors text-sm font-medium",
                      format === 'excel' ? "border-slate-900 bg-slate-50" : "border-slate-100 hover:border-slate-200"
                    )}
                  >
                    <FileJson className={cn("w-4 h-4", format === 'excel' ? "text-emerald-500" : "text-slate-400")} />
                    Excel
                  </button>
                </div>
              </div>

              {/* Options */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-slate-900">Opciók</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="opt-1" defaultChecked className="border-slate-300 rounded" />
                    <Label htmlFor="opt-1" className="text-sm font-normal cursor-pointer">Részletes tételsorok</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="opt-2" defaultChecked className="border-slate-300 rounded" />
                    <Label htmlFor="opt-2" className="text-sm font-normal cursor-pointer">Diagramok hozzáadása</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="opt-3" className="border-slate-300 rounded" />
                    <Label htmlFor="opt-3" className="text-sm font-normal cursor-pointer">Csak összesítő</Label>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
              <Button variant="ghost" className="text-slate-500 hover:text-slate-700 whitespace-nowrap" onClick={() => setIsModalOpen(false)}>
                Mégse
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" className="gap-2 bg-white text-slate-700 border-slate-200 whitespace-nowrap">
                  <Mail className="w-4 h-4" /> Generálás és küldés
                </Button>
                <Button variant="outline" className="gap-2 bg-white text-slate-700 border-slate-200 whitespace-nowrap">
                  <Eye className="w-4 h-4" /> Előnézet
                </Button>
                <Button className="gap-2 bg-[#1A1F2C] text-white hover:bg-[#1A1F2C]/90 whitespace-nowrap">
                  <Download className="w-4 h-4" /> Generálás
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
