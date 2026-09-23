import React from 'react';
import { type CompanyInvoice } from '@/hooks/accounty/useAccountyClients';
import { cn } from '@/lib/utils';
import { ArrowLeftRight, Landmark, Layers, CheckCircle } from 'lucide-react';

interface TAccountLedgerProps {
  invoice: CompanyInvoice;
}

export function TAccountLedger({ invoice }: TAccountLedgerProps) {
  const net = invoice.grossAmount - invoice.vatAmount;
  const isExpense = invoice.type === 'bejovo';

  // Format currency helper
  const fmt = (val: number) => {
    return new Intl.NumberFormat('hu-HU', {
      style: 'currency',
      currency: invoice.currency || 'HUF',
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Customer labels lookup helper
  const getCustomerAccount = (code?: string | null) => {
    switch (code) {
      case '312': return { code: '312', name: 'Külföldi vevők (Export)' };
      case '315': return { code: '315', name: 'Vevők (Kapcsolt vállalkozás)' };
      case '316': return { code: '316', name: 'Vevők (Jelentős részesedés)' };
      case '317': return { code: '317', name: 'Vevők (Egyéb részesedés)' };
      case '311':
      default: return { code: code || '311', name: 'Vevők (Belföldi)' };
    }
  };

  const getSupplierAccount = (code?: string | null) => {
    switch (code) {
      case '4542': return { code: '4542', name: 'Szállítók (Külföldi)' };
      case '4541':
      case '454':
      default: return { code: code || '454', name: 'Szállítók (Belföldi)' };
    }
  };

  const custAcc = getCustomerAccount(invoice.partnerGlNumber);
  const suppAcc = getSupplierAccount(invoice.partnerGlNumber);
  const vatDedCode = invoice.vatGlNumber || '466';
  const vatPayCode = invoice.vatGlNumber || '467';

  // Define Hungarian accounts based on direction
  const debitAccounts = isExpense
    ? [
        { 
          code: invoice.glNumber || '511', 
          name: invoice.glName || 'Vásárolt anyagok és szolgáltatások', 
          amount: net 
        },
        ...(invoice.vatAmount > 0
          ? [{ code: vatDedCode, name: vatDedCode === '466' ? 'Előzetesen felszámított ÁFA' : 'Levonható ÁFA', amount: invoice.vatAmount }]
          : []),
      ]
    : [
        { code: custAcc.code, name: custAcc.name, amount: invoice.grossAmount },
      ];

  const creditAccounts = isExpense
    ? [
        { code: suppAcc.code, name: suppAcc.name, amount: invoice.grossAmount },
      ]
    : [
        { 
          code: invoice.glNumber || '911', 
          name: invoice.glName || 'Belföldi értékesítés nettó árbevétele', 
          amount: net 
        },
        ...(invoice.vatAmount > 0
          ? [{ code: vatPayCode, name: vatPayCode === '467' ? 'Fizetendő ÁFA' : 'ÁFA számla', amount: invoice.vatAmount }]
          : []),
      ];

  return (
    <div className="bg-card border border-border rounded-lg p-5 shadow-soft space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 pb-3 border-b border-border">
        <ArrowLeftRight className="w-5 h-5 text-primary" />
        <div>
          <h3 className="text-sm font-bold text-foreground">Dupla könyvelési T-számlák</h3>
          <p className="text-[11px] text-muted-foreground">Automatikusan kontírozott főkönyvi napló tétel (Tartozik / Követel)</p>
        </div>
      </div>

      {/* Visual T-Accounts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left column: Debit accounts */}
        <div className="space-y-4">
          <div className="text-xs font-bold uppercase tracking-wider text-primary dark:text-primary mb-1 flex items-center gap-1">
            <Landmark className="w-3.5 h-3.5" />
            Tartozik oldal (Debit)
          </div>
          
          {debitAccounts.map(acc => (
            <div key={acc.code} className="bg-background/30 border border-border rounded-lg p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-mono font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-primary px-2 py-0.5 rounded">
                  {acc.code}
                </span>
                <span className="text-xs font-semibold text-primary dark:text-primary font-mono">
                  {fmt(acc.amount)}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground truncate">{acc.name}</p>
              
              {/* T-Chart representation */}
              <div className="mt-2 border-t border-border relative pt-1">
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-muted-foreground/30 dark:bg-muted -translate-x-1/2" style={{ height: '24px' }} />
                <div className="grid grid-cols-2 text-[9px] font-bold text-center">
                  <div className="text-emerald-600 dark:text-emerald-500 font-mono">{fmt(acc.amount)}</div>
                  <div className="text-muted-foreground/60 dark:text-foreground/90">-</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Right column: Credit accounts */}
        <div className="space-y-4">
          <div className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 mb-1 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5" />
            Követel oldal (Credit)
          </div>

          {creditAccounts.map(acc => (
            <div key={acc.code} className="bg-background/30 border border-border rounded-lg p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-mono font-bold bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 px-2 py-0.5 rounded">
                  {acc.code}
                </span>
                <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 font-mono">
                  {fmt(acc.amount)}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground truncate">{acc.name}</p>

              {/* T-Chart representation */}
              <div className="mt-2 border-t border-border relative pt-1">
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-muted-foreground/30 dark:bg-muted -translate-x-1/2" style={{ height: '24px' }} />
                <div className="grid grid-cols-2 text-[9px] font-bold text-center">
                  <div className="text-muted-foreground/60 dark:text-foreground/90">-</div>
                  <div className="text-emerald-600 dark:text-emerald-500 font-mono">{fmt(acc.amount)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Balanced Warning */}
      <div className="bg-muted/40 border border-border rounded-lg p-3 flex justify-between items-center text-xs font-semibold">
        <span className="text-muted-foreground">Mérlegegyezőség (Főkönyvi egyenleg):</span>
        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
          <CheckCircle className="w-4 h-4" />
          Kiegyenlítve: {fmt(invoice.grossAmount)}
        </span>
      </div>
    </div>
  );
}
