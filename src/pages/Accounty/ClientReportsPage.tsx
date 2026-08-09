import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Calendar, FileText, PieChart, TrendingUp, Users, FileWarning, 
  Download, FileJson, Mail, ChevronRight, X, ArrowLeft, Eye, ChevronLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useAccountyClients } from '@/hooks/accounty';

type ReportType = 'havi' | 'afa' | 'koltseg' | 'cashflow' | 'partner' | 'hianyzo';

const reportTypes = [
  { id: 'havi', title: 'Havi összesítő', description: 'Bejövő és kimenő számlák összesítése, ÁFA kimutatás', icon: Calendar, color: 'text-indigo-500', bg: 'bg-indigo-50' },
  { id: 'afa', title: 'ÁFA kimutatás', description: 'Részletes ÁFA bontás kategóriánként', icon: FileText, color: 'text-primary', bg: 'bg-accent-subtle' },
  { id: 'koltseg', title: 'Költségkimutatás', description: 'Költségek főkönyvi szám és kategória szerint', icon: PieChart, color: 'text-amber-500', bg: 'bg-amber-50' },
  { id: 'cashflow', title: 'Cash flow riport', description: 'Pénzforgalom és likviditás elemzés', icon: TrendingUp, color: 'text-blue-500', bg: 'bg-blue-50' },
  { id: 'partner', title: 'Partner kimutatás', description: 'Szállítói és vevői forgalom riport', icon: Users, color: 'text-rose-500', bg: 'bg-rose-50' },
  { id: 'hianyzo', title: 'Hiányzó számlák riport', description: 'Automatikus bekérő statisztikák', icon: FileWarning, color: 'text-red-500', bg: 'bg-red-50' },
];

export default function ClientReportsPage() {
  const { companyId, dateRange } = useParams<{ companyId: string; dateRange: string }>();
  const id = companyId;
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<ReportType>('havi');
  const [format, setFormat] = useState<'pdf' | 'excel'>('pdf');

  const { data: clients } = useAccountyClients();
  const clientName = useMemo(() => {
    const found = clients?.find(c => c.id === id);
    return found?.name || 'Betöltés...';
  }, [clients, id]);



  const openModal = (type: ReportType) => {
    if (type === 'hianyzo') {
      navigate(`/accounty/client/${id}/reports/missing-invoices`);
      return;
    }
    setSelectedType(type);
    setIsModalOpen(true);
  };

  return (
    <div className="w-full space-y-8 animate-in fade-in slide-in-from-right-8 duration-500 relative pb-24">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button 
          onClick={() => navigate(`/accounty/${companyId}/${dateRange}/overview`)}
          className="flex items-center justify-center w-8 h-8 mt-1 shrink-0 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-sm"
          title="Vissza az áttekintéshez"
        >
          <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </button>
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            {clientName === 'Betöltés...' ? (
              <div className="h-3.5 w-32 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
            ) : (
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{clientName}</span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Riportok</h1>
        </div>
      </div>

      {/* Report Types Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reportTypes.map((report) => (
          <button 
            key={report.id}
            onClick={() => openModal(report.id as ReportType)}
            className="flex flex-col text-left bg-card border border-border rounded-xl p-5 hover:border-slate-300 hover:shadow-soft transition-all group relative overflow-hidden"
          >
            <div className="flex justify-between items-start w-full mb-4">
              <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", report.bg)}>
                <report.icon className={cn("w-5 h-5", report.color)} />
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-500 dark:text-slate-400 transition-colors" />
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">{report.title}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{report.description}</p>
          </button>
        ))}
      </div>

      {/* Recent Reports - empty state */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Legutóbbi riportok</h2>
        </div>

        <div className="bg-card border border-border rounded-xl shadow-soft overflow-hidden">
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
              <FileText className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Még nincs generált riport</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">A generált riportok itt fognak megjelenni</p>
          </div>
        </div>
      </div>

      {/* Modal Overlay & Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" 
            onClick={() => setIsModalOpen(false)}
          ></div>
          
          <div className="relative bg-card rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 z-10 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex justify-between items-start p-6 border-b border-border shrink-0">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Riport generálása</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Állítsd be a {clientName} riport paramétereit</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 dark:text-slate-400 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 overflow-y-auto">
              {/* Report Type Selection */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-slate-900 dark:text-slate-100">Riport típusa</Label>
                <RadioGroup value={selectedType} onValueChange={(v) => setSelectedType(v as ReportType)} className="grid grid-cols-2 gap-3">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="havi" id="type-havi" className="border-slate-300 text-slate-900 dark:text-slate-100" />
                    <Label htmlFor="type-havi" className="text-sm font-normal cursor-pointer">Havi összesítő</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="afa" id="type-afa" className="border-slate-300 text-slate-900 dark:text-slate-100" />
                    <Label htmlFor="type-afa" className="text-sm font-normal cursor-pointer">ÁFA kimutatás</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="koltseg" id="type-koltseg" className="border-slate-300 text-slate-900 dark:text-slate-100" />
                    <Label htmlFor="type-koltseg" className="text-sm font-normal cursor-pointer">Költségkimutatás</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="cashflow" id="type-cashflow" className="border-slate-300 text-slate-900 dark:text-slate-100" />
                    <Label htmlFor="type-cashflow" className="text-sm font-normal cursor-pointer">Cash flow riport</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="partner" id="type-partner" className="border-slate-300 text-slate-900 dark:text-slate-100" />
                    <Label htmlFor="type-partner" className="text-sm font-normal cursor-pointer">Partner kimutatás</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="hianyzo" id="type-hianyzo" className="border-slate-300 text-slate-900 dark:text-slate-100" />
                    <Label htmlFor="type-hianyzo" className="text-sm font-normal cursor-pointer">Hiányzó számlák riport</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Date Range */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-slate-900 dark:text-slate-100">Időszak</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500 dark:text-slate-400">Kezdő dátum</Label>
                    <div className="relative">
                      <Input defaultValue="2024. 01. 01." className="bg-card border-border text-sm pl-10" />
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <div className="bg-blue-600 text-white text-[10px] font-bold px-1 rounded-sm">2024</div>
                      </div>
                      <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500 dark:text-slate-400">Záró dátum</Label>
                    <div className="relative">
                      <Input defaultValue="2024. 01. 31." className="bg-card border-border text-sm" />
                      <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Format Toggle */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-slate-900 dark:text-slate-100">Formátum</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setFormat('pdf')}
                    className={cn(
                      "flex items-center gap-2 p-3 rounded-xl border-2 transition-colors text-sm font-medium",
                      format === 'pdf' ? "border-slate-900 dark:border-primary bg-slate-50 dark:bg-accent" : "border-border hover:border-slate-200"
                    )}
                  >
                    <FileText className={cn("w-4 h-4", format === 'pdf' ? "text-red-500" : "text-slate-400")} />
                    PDF
                  </button>
                  <button 
                    onClick={() => setFormat('excel')}
                    className={cn(
                      "flex items-center gap-2 p-3 rounded-xl border-2 transition-colors text-sm font-medium",
                      format === 'excel' ? "border-slate-900 dark:border-primary bg-slate-50 dark:bg-accent" : "border-border hover:border-slate-200"
                    )}
                  >
                    <FileJson className={cn("w-4 h-4", format === 'excel' ? "text-primary" : "text-slate-400")} />
                    Excel
                  </button>
                </div>
              </div>

              {/* Options */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-slate-900 dark:text-slate-100">Opciók</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="opt-1" defaultChecked className="border-slate-300 rounded" />
                    <Label htmlFor="opt-1" className="text-sm font-normal cursor-pointer">Részletes tételsorok</Label>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border flex items-center justify-between shrink-0 dark:bg-slate-900/50">
              <Button variant="ghost" className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 dark:text-slate-300 whitespace-nowrap" onClick={() => setIsModalOpen(false)}>
                Mégse
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" className="gap-2 bg-card text-slate-700 dark:text-slate-300 border-border whitespace-nowrap">
                  <Mail className="w-4 h-4" /> Generálás és küldés
                </Button>
                <Button variant="outline" className="gap-2 bg-card text-slate-700 dark:text-slate-300 border-border whitespace-nowrap">
                  <Eye className="w-4 h-4" /> Előnézet
                </Button>
                <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 whitespace-nowrap" onClick={() => setIsModalOpen(false)}>
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
