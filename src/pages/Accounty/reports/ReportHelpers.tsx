import React from 'react';
import { cn } from '@/lib/utils';
import { type FullReportData } from '@/hooks/accounty';

type ReportType = 'havi' | 'afa' | 'koltseg' | 'cashflow' | 'partner' | 'hianyzo';
// ── Preview table component ──

export function PreviewTable({ data, type, options }: { data: FullReportData; type: ReportType; options?: { details: boolean } }) {
  const fmt = (n: number) => new Intl.NumberFormat('hu-HU').format(n);

  if (type === 'havi') {
    const inbound = data.invoices.filter(i => i.direction === 'Bejövő');
    const outbound = data.invoices.filter(i => i.direction === 'Kimenő');
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3"><div className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">Összes számla</div><div className="text-lg font-bold text-blue-700 dark:text-blue-300">{data.invoices.length}</div></div>
          <div className="bg-accent-subtle dark:bg-accent rounded-lg p-3"><div className="text-[10px] text-primary font-medium">Bejövő</div><div className="text-lg font-bold text-accent-foreground">{inbound.length}</div></div>
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3"><div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">Kimenő</div><div className="text-lg font-bold text-amber-700 dark:text-amber-300">{outbound.length}</div></div>
        </div>
        {options?.details !== false && (
          <table className="w-full"><thead><tr className="text-[10px] text-slate-500 border-b"><th className="pb-1 text-left">Szám</th><th className="pb-1 text-left">Partner</th><th className="pb-1">Irány</th><th className="pb-1 text-right">Bruttó</th></tr></thead>
          <tbody>{data.invoices.slice(0, 5).map((inv, i) => (
            <tr key={i} className="border-b border-slate-100 dark:border-slate-800"><td className="py-1 font-medium">{inv.invoiceNumber}</td><td className="py-1 text-slate-500 dark:text-slate-400">{inv.partnerName}</td><td className="py-1 text-center"><span className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold", inv.direction === 'Bejövő' ? 'bg-accent text-accent-foreground' : 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300')}>{inv.direction}</span></td><td className="py-1 text-right font-semibold">{fmt(inv.grossAmount)} {inv.currency}</td></tr>
          ))}</tbody></table>
        )}
        {data.invoices.length > 5 && <p className="text-[10px] text-slate-400 text-center">+{data.invoices.length - 5} további számla...</p>}
      </div>
    );
  }

  if (type === 'afa') {
    const totalNet = data.invoices.reduce((s, i) => s + i.netAmount, 0);
    const totalVat = data.invoices.reduce((s, i) => s + i.vatAmount, 0);
    const totalGross = data.invoices.reduce((s, i) => s + i.grossAmount, 0);
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3"><div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Nettó összesen</div><div className="text-sm font-bold">{fmt(totalNet)} Ft</div></div>
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3"><div className="text-[10px] text-red-500 dark:text-red-400 font-medium">ÁFA összesen</div><div className="text-sm font-bold text-red-700 dark:text-red-300">{fmt(totalVat)} Ft</div></div>
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3"><div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Bruttó összesen</div><div className="text-sm font-bold">{fmt(totalGross)} Ft</div></div>
        </div>
        {options?.details !== false && (
          <table className="w-full"><thead><tr className="text-[10px] text-slate-500 border-b"><th className="pb-1 text-left">Szám</th><th className="pb-1 text-right">Nettó</th><th className="pb-1 text-right">ÁFA</th><th className="pb-1 text-right">Bruttó</th></tr></thead>
          <tbody>{data.invoices.slice(0, 5).map((inv, i) => (
            <tr key={i} className="border-b border-slate-100 dark:border-slate-800"><td className="py-1 font-medium">{inv.invoiceNumber}</td><td className="py-1 text-right">{fmt(inv.netAmount)} {inv.currency}</td><td className="py-1 text-right text-red-600 dark:text-red-400 font-semibold">{fmt(inv.vatAmount)} {inv.currency}</td><td className="py-1 text-right font-semibold">{fmt(inv.grossAmount)} {inv.currency}</td></tr>
          ))}</tbody></table>
        )}
      </div>
    );
  }

  if (type === 'koltseg') {
    const costs = data.invoices.filter(i => i.direction === 'Bejövő');
    const byClient: Record<string, number> = {};
    costs.forEach(c => { byClient[c.clientName] = (byClient[c.clientName] || 0) + c.grossAmount; });
    return (
      <div className="space-y-3">
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3"><div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">Összes költség (bejövő számlák)</div><div className="text-lg font-bold text-amber-700 dark:text-amber-300">{fmt(costs.reduce((s, c) => s + c.grossAmount, 0))} Ft</div></div>
        {options?.details !== false && (
          <table className="w-full"><thead><tr className="text-[10px] text-slate-500 border-b"><th className="pb-1 text-left">Ügyfél</th><th className="pb-1 text-right">Összeg</th></tr></thead>
          <tbody>{Object.entries(byClient).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, amount], i) => (
            <tr key={i} className="border-b border-slate-100 dark:border-slate-800"><td className="py-1 font-medium">{name}</td><td className="py-1 text-right font-semibold">{fmt(amount)} Ft</td></tr>
          ))}</tbody></table>
        )}
      </div>
    );
  }

  if (type === 'cashflow') {
    const inflow = data.invoices.filter(i => i.direction === 'Kimenő').reduce((s, i) => s + i.grossAmount, 0);
    const outflow = data.invoices.filter(i => i.direction === 'Bejövő').reduce((s, i) => s + i.grossAmount, 0);
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-accent-subtle dark:bg-accent rounded-lg p-3"><div className="text-[10px] text-primary font-medium">Befolyó (kimenő számlák)</div><div className="text-sm font-bold text-accent-foreground">+{fmt(inflow)} Ft</div></div>
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3"><div className="text-[10px] text-red-500 dark:text-red-400 font-medium">Kiáramló (bejövő számlák)</div><div className="text-sm font-bold text-red-700 dark:text-red-300">-{fmt(outflow)} Ft</div></div>
          <div className={cn("rounded-lg p-3", inflow - outflow >= 0 ? "bg-accent-subtle dark:bg-accent" : "bg-red-50 dark:bg-red-900/20")}><div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Egyenleg</div><div className={cn("text-sm font-bold", inflow - outflow >= 0 ? "text-accent-foreground" : "text-red-700 dark:text-red-300")}>{fmt(inflow - outflow)} Ft</div></div>
        </div>
        {options?.details !== false && (
          <table className="w-full"><thead><tr className="text-[10px] text-slate-500 border-b"><th className="pb-1 text-left">Szám</th><th className="pb-1 text-left">Partner</th><th className="pb-1 text-center">Típus</th><th className="pb-1 text-right">Bruttó</th></tr></thead>
          <tbody>{data.invoices.slice(0, 5).map((inv, i) => (
            <tr key={i} className="border-b border-slate-100 dark:border-slate-800"><td className="py-1 font-medium">{inv.invoiceNumber}</td><td className="py-1 text-slate-500 dark:text-slate-400">{inv.partnerName}</td><td className="py-1 text-center"><span className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold", inv.direction === 'Bejövő' ? 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300' : 'bg-accent text-accent-foreground')}>{inv.direction === 'Bejövő' ? 'Kiáramló' : 'Befolyó'}</span></td><td className={cn("py-1 text-right font-semibold", inv.direction === 'Bejövő' ? 'text-red-700 dark:text-red-400' : 'text-accent-foreground')}>{inv.direction === 'Bejövő' ? '-' : '+'}{fmt(inv.grossAmount)} {inv.currency}</td></tr>
          ))}</tbody></table>
        )}
        {data.invoices.length > 5 && <p className="text-[10px] text-slate-400 text-center">+{data.invoices.length - 5} további tétel...</p>}
      </div>
    );
  }

  if (type === 'partner') {
    const byPartner: Record<string, { count: number; total: number }> = {};
    data.invoices.forEach(inv => {
      const p = inv.partnerName;
      if (!byPartner[p]) byPartner[p] = { count: 0, total: 0 };
      byPartner[p].count++;
      byPartner[p].total += inv.grossAmount;
    });
    return (
      <div className="space-y-3">
        <div className="bg-rose-50 dark:bg-rose-900/20 rounded-lg p-3"><div className="text-[10px] text-rose-600 font-medium">Egyedi partnerek</div><div className="text-lg font-bold text-rose-700">{Object.keys(byPartner).length}</div></div>
        {options?.details !== false && (
          <table className="w-full"><thead><tr className="text-[10px] text-slate-500 border-b"><th className="pb-1 text-left">Partner</th><th className="pb-1 text-right">Számlák</th><th className="pb-1 text-right">Forgalom</th></tr></thead>
          <tbody>{Object.entries(byPartner).sort((a, b) => b[1].total - a[1].total).slice(0, 8).map(([name, d], i) => (
            <tr key={i} className="border-b border-slate-100"><td className="py-1 font-medium">{name}</td><td className="py-1 text-right">{d.count}</td><td className="py-1 text-right font-semibold">{fmt(d.total)} Ft</td></tr>
          ))}</tbody></table>
        )}
      </div>
    );
  }

  return <p className="text-slate-500">Nincs elérhető előnézet.</p>;
}

// ── Export helpers ──

export const reportTypeLabels: Record<string, string> = {
  havi: 'Havi összesítő',
  afa: 'ÁFA kimutatás',
  koltseg: 'Költségkimutatás',
  cashflow: 'Cash flow riport',
  partner: 'Partner kimutatás',
};

export function exportCSV(data: FullReportData, type: string, options: { details: boolean } = { details: true }) {
  const bom = '\uFEFF';
  let csvContent = '';

  if (type === 'havi' || type === 'afa') {
    if (options.details) {
      csvContent = ['Számla szám;Partner;Dátum;Irány;Nettó (Ft);ÁFA (Ft);Bruttó (Ft);Ügyfél',
        ...data.invoices.map(i => [i.invoiceNumber, i.partnerName, i.date, i.direction, i.netAmount, i.vatAmount, i.grossAmount, i.clientName].join(';'))
      ].join('\n');
    } else {
      const totalNet = data.invoices.reduce((s, i) => s + i.netAmount, 0);
      const totalVat = data.invoices.reduce((s, i) => s + i.vatAmount, 0);
      const totalGross = data.invoices.reduce((s, i) => s + i.grossAmount, 0);
      csvContent = ['Nettó összesen (Ft);ÁFA összesen (Ft);Bruttó összesen (Ft)', `${totalNet};${totalVat};${totalGross}`].join('\n');
    }
  } else if (type === 'koltseg') {
    const costs = data.invoices.filter(i => i.direction === 'Bejövő');
    if (options.details) {
      csvContent = ['Számla szám;Szállító;Dátum;Nettó (Ft);ÁFA (Ft);Bruttó (Ft);Ügyfél',
        ...costs.map(i => [i.invoiceNumber, i.partnerName, i.date, i.netAmount, i.vatAmount, i.grossAmount, i.clientName].join(';'))
      ].join('\n');
    } else {
      const total = costs.reduce((s, c) => s + c.grossAmount, 0);
      csvContent = ['Összes költség (Ft);Számlák száma', `${total};${costs.length}`].join('\n');
    }
  } else if (type === 'cashflow') {
    const inflow = data.invoices.filter(i => i.direction === 'Kimenő').reduce((s, i) => s + i.grossAmount, 0);
    const outflow = data.invoices.filter(i => i.direction === 'Bejövő').reduce((s, i) => s + i.grossAmount, 0);
    if (options.details) {
      csvContent = ['Irány;Partner;Dátum;Bruttó (Ft);Ügyfél',
        ...data.invoices.map(i => [i.direction, i.partnerName, i.date, i.direction === 'Kimenő' ? i.grossAmount : -i.grossAmount, i.clientName].join(';'))
      ].join('\n');
    } else {
      csvContent = ['Befolyó (Ft);Kiáramló (Ft);Egyenleg (Ft)', `${inflow};${outflow};${inflow - outflow}`].join('\n');
    }
  } else if (type === 'partner') {
    const byPartner: Record<string, { count: number; total: number }> = {};
    data.invoices.forEach(inv => {
      if (!byPartner[inv.partnerName]) byPartner[inv.partnerName] = { count: 0, total: 0 };
      byPartner[inv.partnerName].count++;
      byPartner[inv.partnerName].total += inv.grossAmount;
    });
    csvContent = ['Partner;Számlák száma;Összes forgalom (Ft)',
      ...Object.entries(byPartner).sort((a, b) => b[1].total - a[1].total).map(([name, d]) => [name, d.count, d.total].join(';'))
    ].join('\n');
  }

  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `visibill_${type}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
export function exportPDF(data: FullReportData, type: string, options: { details: boolean } = { details: true }) {
  const title = reportTypeLabels[type] || type;
  const now = new Date().toLocaleDateString('hu-HU');
  const fmt = (n: number) => new Intl.NumberFormat('hu-HU').format(n);

  let tableHtml = '';

  if (type === 'havi' || type === 'afa') {
    const totalNet = data.invoices.reduce((s, i) => s + i.netAmount, 0);
    const totalVat = data.invoices.reduce((s, i) => s + i.vatAmount, 0);
    const totalGross = data.invoices.reduce((s, i) => s + i.grossAmount, 0);
    tableHtml = `
      <div class="summary-divider-bar">
        <div class="summary-item">
          <div class="summary-label">Nettó összesen</div>
          <div class="summary-value">${fmt(totalNet)} Ft</div>
        </div>
        <div class="summary-divider"></div>
        <div class="summary-item">
          <div class="summary-label">ÁFA összesen</div>
          <div class="summary-value text-destructive">${fmt(totalVat)} Ft</div>
        </div>
        <div class="summary-divider"></div>
        <div class="summary-item">
          <div class="summary-label">Bruttó összesen</div>
          <div class="summary-value text-primary">${fmt(totalGross)} Ft</div>
        </div>
      </div>
      ${options.details ? `<table><thead><tr><th>Számlaszám</th><th>Partner</th><th>Dátum</th><th>Irány</th><th style="text-align:right">Nettó</th><th style="text-align:right">ÁFA</th><th style="text-align:right">Bruttó</th><th>Ügyfél</th></tr></thead>
      <tbody>${data.invoices.map(i => `<tr><td><strong class="font-mono">${i.invoiceNumber}</strong></td><td>${i.partnerName}</td><td class="font-mono">${i.date}</td><td><span class="badge ${i.direction === 'Bejövő' ? 'inbound' : 'outbound'}">${i.direction}</span></td><td style="text-align:right" class="font-mono">${fmt(i.netAmount)} ${i.currency}</td><td style="text-align:right" class="font-mono text-destructive">${fmt(i.vatAmount)} ${i.currency}</td><td style="text-align:right" class="font-mono"><strong>${fmt(i.grossAmount)} ${i.currency}</strong></td><td>${i.clientName}</td></tr>`).join('')}</tbody></table>` : ''}`;
  } else if (type === 'koltseg') {
    const costs = data.invoices.filter(i => i.direction === 'Bejövő');
    const total = costs.reduce((s, c) => s + c.grossAmount, 0);
    tableHtml = `
      <div class="summary-divider-bar">
        <div class="summary-item">
          <div class="summary-label">Összes költség (bejövő)</div>
          <div class="summary-value text-destructive">${fmt(total)} Ft</div>
        </div>
        <div class="summary-divider"></div>
        <div class="summary-item">
          <div class="summary-label">Számlák száma</div>
          <div class="summary-value">${costs.length} db</div>
        </div>
      </div>
      ${options.details ? `<table><thead><tr><th>Számlaszám</th><th>Szállító</th><th>Dátum</th><th style="text-align:right">Bruttó</th><th>Ügyfél</th></tr></thead>
      <tbody>${costs.map(i => `<tr><td><strong class="font-mono">${i.invoiceNumber}</strong></td><td>${i.partnerName}</td><td class="font-mono">${i.date}</td><td style="text-align:right" class="font-mono"><strong>${fmt(i.grossAmount)} ${i.currency}</strong></td><td>${i.clientName}</td></tr>`).join('')}</tbody></table>` : ''}`;
  } else if (type === 'cashflow') {
    const inflow = data.invoices.filter(i => i.direction === 'Kimenő').reduce((s, i) => s + i.grossAmount, 0);
    const outflow = data.invoices.filter(i => i.direction === 'Bejövő').reduce((s, i) => s + i.grossAmount, 0);
    tableHtml = `
      <div class="summary-divider-bar">
        <div class="summary-item">
          <div class="summary-label">Befolyó (Kimenő)</div>
          <div class="summary-value text-success">+${fmt(inflow)} Ft</div>
        </div>
        <div class="summary-divider"></div>
        <div class="summary-item">
          <div class="summary-label">Kiáramló (Bejövő)</div>
          <div class="summary-value text-destructive">-${fmt(outflow)} Ft</div>
        </div>
        <div class="summary-divider"></div>
        <div class="summary-item">
          <div class="summary-label">Egyenleg</div>
          <div class="summary-value ${inflow - outflow >= 0 ? 'text-success' : 'text-destructive'}">${inflow - outflow >= 0 ? '+' : ''}${fmt(inflow - outflow)} Ft</div>
        </div>
      </div>
      ${options.details ? `<table><thead><tr><th>Irány</th><th>Partner</th><th>Dátum</th><th style="text-align:right">Összeg</th><th>Ügyfél</th></tr></thead>
      <tbody>${data.invoices.map(i => `<tr><td><span class="badge ${i.direction === 'Kimenő' ? 'outbound' : 'inbound'}">${i.direction}</span></td><td>${i.partnerName}</td><td class="font-mono">${i.date}</td><td style="text-align:right" class="font-mono"><strong>${i.direction === 'Kimenő' ? '+' : '-'}${fmt(i.grossAmount)} ${i.currency}</strong></td><td>${i.clientName}</td></tr>`).join('')}</tbody></table>` : ''}`;
  } else if (type === 'partner') {
    const byPartner: Record<string, { count: number; total: number }> = {};
    data.invoices.forEach(inv => {
      if (!byPartner[inv.partnerName]) byPartner[inv.partnerName] = { count: 0, total: 0 };
      byPartner[inv.partnerName].count++;
      byPartner[inv.partnerName].total += inv.grossAmount;
    });
    const sorted = Object.entries(byPartner).sort((a, b) => b[1].total - a[1].total);
    tableHtml = `
      <div class="summary-divider-bar">
        <div class="summary-item">
          <div class="summary-label">Egyedi partnerek száma</div>
          <div class="summary-value text-primary">${sorted.length} db</div>
        </div>
      </div>
      ${options.details ? `<table><thead><tr><th>Partner</th><th style="text-align:right">Számlák</th><th style="text-align:right">Forgalom</th></tr></thead>
      <tbody>${sorted.map(([name, d]) => `<tr><td><strong>${name}</strong></td><td style="text-align:right" class="font-mono">${d.count}</td><td style="text-align:right" class="font-mono"><strong>${fmt(d.total)} Ft</strong></td></tr>`).join('')}</tbody></table>` : ''}`;
  }

  const html = `<!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="UTF-8">
  <title>${title} – eaisybooks</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    @page { size: A4; margin: 0; }
    @media print {
      body {
        padding: 20mm 15mm !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .no-print { display: none !important; }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, sans-serif;
      color: #1e293b;
      background-color: #ffffff;
      line-height: 1.5;
      padding: 20px;
      -webkit-font-smoothing: antialiased;
    }
    
    /* Brand Header */
    .brand-container {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 18px;
      margin-bottom: 24px;
    }
    .brand-logo {
      font-family: 'Outfit', sans-serif;
      font-size: 24px;
      font-weight: 500;
      color: #1e293b;
      letter-spacing: -0.5px;
      line-height: 1;
      display: inline-flex;
      align-items: center;
    }
    .brand-logo .highlight {
      color: #0f7467;
      font-weight: 800;
    }
    
    .report-title-container { text-align: right; }
    .report-title {
      font-family: 'Outfit', sans-serif;
      font-size: 20px;
      font-weight: 700;
      color: #0f7467;
      margin-bottom: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .report-meta { font-size: 11px; color: #64748b; }

    /* Summary Bar */
    .summary-divider-bar {
      display: flex;
      align-items: center;
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px 24px;
      margin-bottom: 28px;
    }
    .summary-item {
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    .summary-label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.7px;
      color: #64748b;
      margin-bottom: 4px;
    }
    .summary-value {
      font-size: 18px;
      font-weight: 700;
      color: #1e293b;
      font-variant-numeric: tabular-nums;
    }
    .summary-divider {
      width: 1px;
      height: 32px;
      background-color: #e2e8f0;
      margin: 0 24px;
    }
    
    /* Table Styling */
    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 11px; }
    th {
      font-family: 'Outfit', sans-serif;
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.7px;
      color: #64748b;
      border-bottom: 1.5px solid #cbd5e1;
      padding: 10px 8px;
      text-align: left;
    }
    td { padding: 10px 8px; border-bottom: 1px solid #f1f5f9; color: #334155; }
    
    /* Badges */
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .badge.inbound { background-color: #fee2e2; color: #991b1b; }
    .badge.outbound { background-color: #d1fae5; color: #065f46; }
    
    /* Utilities */
    .font-mono { font-family: 'Courier New', Courier, monospace; font-weight: 600; font-variant-numeric: tabular-nums; }
    .text-destructive { color: #dc2626 !important; }
    .text-primary { color: #0f7467 !important; }
    .text-success { color: #16a34a !important; }

    /* Actions / Print Button */
    .print-btn-container { display: flex; justify-content: flex-start; margin-bottom: 24px; }
    .print-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: linear-gradient(135deg, #0f7467 0%, #0d6459 100%);
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(15,116,103,0.15);
      transition: all 0.2s ease;
    }
    .print-btn:hover {
      background: linear-gradient(135deg, #0d6459 0%, #0b534a 100%);
      box-shadow: 0 6px 16px rgba(15,116,103,0.25);
      transform: translateY(-1px);
    }
    
    .report-footer {
      margin-top: 40px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
      font-size: 9px;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
  </style>
</head>
<body>
  <div class="print-btn-container no-print">
    <button class="print-btn" onclick="window.print()">🖨 Nyomtatás / Mentés PDF-ként</button>
  </div>
  
  <div class="brand-container">
    <div class="brand-left">
      <div class="brand-logo">
        e<span class="highlight">ai</span>sy<span class="highlight">Books</span>
      </div>
    </div>
    <div class="report-title-container">
      <h1 class="report-title">${title}</h1>
      <div class="report-meta">Generálva: ${now}</div>
    </div>
  </div>

  ${tableHtml}

  <div class="report-footer">
    <span>Ez a dokumentum az eaisybooks rendszerben került generálásra. Bizalmas üzleti jelentés.</span>
    <span>eaisybooks.hu</span>
  </div>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}
