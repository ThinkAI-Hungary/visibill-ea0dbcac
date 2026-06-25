import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CompanyInvoice } from '@/hooks/accounty';

interface ClientInvoicesTabProps {
  clientId: string;
  companyInvoices?: CompanyInvoice[] | null;
}

export default function ClientInvoicesTab({
  clientId,
  companyInvoices,
}: ClientInvoicesTabProps) {
  const navigate = useNavigate();

  const invoiceData = useMemo(() => {
    if (!companyInvoices) return [];
    return companyInvoices.slice(0, 5).map((inv) => {
      const dotColor = inv.status === 'Kontírozott' || inv.status === 'Exportálva' ? 'bg-emerald-500'
        : inv.status === 'Problémás' ? 'bg-red-500' : 'bg-blue-500';
      const statusColor = inv.status === 'Kontírozott' || inv.status === 'Exportálva' ? 'bg-emerald-100 text-emerald-700'
        : inv.status === 'Problémás' ? 'bg-red-100 text-red-700'
        : inv.status === 'Új' ? 'bg-amber-100 text-amber-700'
        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400';
      const statusLabel = inv.status === 'Új' ? 'Feldolgozás alatt'
        : inv.status === 'Kontírozott' ? 'Könyvelve'
        : inv.status === 'Exportálva' ? 'Exportálva' : inv.status;
      return {
        id: inv.id,
        number: inv.invoiceNumber,
        company: inv.partnerName,
        amount: new Intl.NumberFormat('hu-HU').format(inv.grossAmount) + ' Ft',
        date: inv.date,
        status: statusLabel,
        dotColor,
        statusColor,
      };
    });
  }, [companyInvoices]);

  const totalInvoices = companyInvoices?.length || 0;
  const processingInvoices = companyInvoices?.filter(i => i.status === 'Új' || i.status === 'Kontírozásra vár').length || 0;
  const totalGross = companyInvoices?.reduce((s, i) => s + i.grossAmount, 0) || 0;
  const totalVat = companyInvoices?.reduce((s, i) => s + i.vatAmount, 0) || 0;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
          <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Összes számla</h3>
          <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">{totalInvoices}</div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
          <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Feldolgozásra vár</h3>
          <div className="text-3xl font-bold text-amber-500">{processingInvoices}</div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
          <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Bruttó összesen</h3>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            {new Intl.NumberFormat('hu-HU').format(totalGross)} Ft
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
          <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">ÁFA összesen</h3>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            {new Intl.NumberFormat('hu-HU').format(totalVat)} Ft
          </div>
        </div>
      </div>

      {/* Invoices List */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">Legutóbbi számlák</h3>
          <Button 
            variant="outline" 
            size="sm" 
            className="bg-white dark:bg-slate-900 text-xs text-slate-600 dark:text-slate-400 h-8"
            onClick={() => navigate(`/accounty/client/${clientId}/invoices`)}
          >
            Összes megtekintése <ChevronRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
        <div className="p-2 space-y-1 bg-white dark:bg-slate-900">
          {invoiceData.map((invoice) => (
            <div 
              key={invoice.id} 
              className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-4">
                <div className={`w-2 h-2 rounded-full ${invoice.dotColor}`}></div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{invoice.number}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{invoice.company}</p>
                </div>
              </div>
              <div className="flex items-center gap-8">
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{invoice.amount}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{invoice.date}</p>
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
  );
}
