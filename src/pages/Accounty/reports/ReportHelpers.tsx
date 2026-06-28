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
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3"><div className="text-[10px] text-blue-600 font-medium">Összes számla</div><div className="text-lg font-bold text-blue-700">{data.invoices.length}</div></div>
          <div className="bg-accent-subtle dark:bg-accent rounded-lg p-3"><div className="text-[10px] text-primary font-medium">Bejövő</div><div className="text-lg font-bold text-accent-foreground">{inbound.length}</div></div>
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3"><div className="text-[10px] text-amber-600 font-medium">Kimenő</div><div className="text-lg font-bold text-amber-700">{outbound.length}</div></div>
        </div>
        {options?.details !== false && (
          <table className="w-full"><thead><tr className="text-[10px] text-slate-500 border-b"><th className="pb-1 text-left">Szám</th><th className="pb-1 text-left">Partner</th><th className="pb-1">Irány</th><th className="pb-1 text-right">Bruttó</th></tr></thead>
          <tbody>{data.invoices.slice(0, 5).map((inv, i) => (
            <tr key={i} className="border-b border-slate-100"><td className="py-1 font-medium">{inv.invoiceNumber}</td><td className="py-1 text-slate-500">{inv.partnerName}</td><td className="py-1 text-center"><span className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold", inv.direction === 'Bejövő' ? 'bg-accent text-accent-foreground' : 'bg-blue-100 text-blue-700')}>{inv.direction}</span></td><td className="py-1 text-right font-semibold">{fmt(inv.grossAmount)} {inv.currency}</td></tr>
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
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3"><div className="text-[10px] text-slate-500 font-medium">Nettó összesen</div><div className="text-sm font-bold">{fmt(totalNet)} Ft</div></div>
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3"><div className="text-[10px] text-red-500 font-medium">ÁFA összesen</div><div className="text-sm font-bold text-red-700">{fmt(totalVat)} Ft</div></div>
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3"><div className="text-[10px] text-slate-500 font-medium">Bruttó összesen</div><div className="text-sm font-bold">{fmt(totalGross)} Ft</div></div>
        </div>
        {options?.details !== false && (
          <table className="w-full"><thead><tr className="text-[10px] text-slate-500 border-b"><th className="pb-1 text-left">Szám</th><th className="pb-1 text-right">Nettó</th><th className="pb-1 text-right">ÁFA</th><th className="pb-1 text-right">Bruttó</th></tr></thead>
          <tbody>{data.invoices.slice(0, 5).map((inv, i) => (
            <tr key={i} className="border-b border-slate-100"><td className="py-1 font-medium">{inv.invoiceNumber}</td><td className="py-1 text-right">{fmt(inv.netAmount)} {inv.currency}</td><td className="py-1 text-right text-red-600 font-semibold">{fmt(inv.vatAmount)} {inv.currency}</td><td className="py-1 text-right font-semibold">{fmt(inv.grossAmount)} {inv.currency}</td></tr>
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
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3"><div className="text-[10px] text-amber-600 font-medium">Összes költség (bejövő számlák)</div><div className="text-lg font-bold text-amber-700">{fmt(costs.reduce((s, c) => s + c.grossAmount, 0))} Ft</div></div>
        {options?.details !== false && (
          <table className="w-full"><thead><tr className="text-[10px] text-slate-500 border-b"><th className="pb-1 text-left">Ügyfél</th><th className="pb-1 text-right">Összeg</th></tr></thead>
          <tbody>{Object.entries(byClient).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, amount], i) => (
            <tr key={i} className="border-b border-slate-100"><td className="py-1 font-medium">{name}</td><td className="py-1 text-right font-semibold">{fmt(amount)} Ft</td></tr>
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
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3"><div className="text-[10px] text-red-500 font-medium">Kiáramló (bejövő számlák)</div><div className="text-sm font-bold text-red-700">-{fmt(outflow)} Ft</div></div>
          <div className={cn("rounded-lg p-3", inflow - outflow >= 0 ? "bg-accent-subtle dark:bg-accent" : "bg-red-50 dark:bg-red-900/20")}><div className="text-[10px] text-slate-500 font-medium">Egyenleg</div><div className={cn("text-sm font-bold", inflow - outflow >= 0 ? "text-accent-foreground" : "text-red-700")}>{fmt(inflow - outflow)} Ft</div></div>
        </div>
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
      <div class="summary"><span>Nettó: <strong>${fmt(totalNet)} Ft</strong></span> &nbsp;|&nbsp; <span>ÁFA: <strong style="color:#dc2626">${fmt(totalVat)} Ft</strong></span> &nbsp;|&nbsp; <span>Bruttó: <strong>${fmt(totalGross)} Ft</strong></span></div>
      ${options.details ? `<table><thead><tr><th>Számla</th><th>Partner</th><th>Dátum</th><th>Irány</th><th style="text-align:right">Nettó</th><th style="text-align:right">ÁFA</th><th style="text-align:right">Bruttó</th><th>Ügyfél</th></tr></thead>
      <tbody>${data.invoices.map(i => `<tr><td><strong>${i.invoiceNumber}</strong></td><td>${i.partnerName}</td><td>${i.date}</td><td><span class="badge ${i.direction === 'Bejövő' ? 'rendben' : 'feldolgozando'}">${i.direction}</span></td><td style="text-align:right">${fmt(i.netAmount)} ${i.currency}</td><td style="text-align:right">${fmt(i.vatAmount)} ${i.currency}</td><td style="text-align:right"><strong>${fmt(i.grossAmount)} ${i.currency}</strong></td><td>${i.clientName}</td></tr>`).join('')}</tbody></table>` : ''}`;
  } else if (type === 'koltseg') {
    const costs = data.invoices.filter(i => i.direction === 'Bejövő');
    const total = costs.reduce((s, c) => s + c.grossAmount, 0);
    tableHtml = `
      <div class="summary">Összes költség: <strong>${fmt(total)} Ft</strong> (${costs.length} számla)</div>
      ${options.details ? `<table><thead><tr><th>Számla</th><th>Szállító</th><th>Dátum</th><th style="text-align:right">Bruttó</th><th>Ügyfél</th></tr></thead>
      <tbody>${costs.map(i => `<tr><td><strong>${i.invoiceNumber}</strong></td><td>${i.partnerName}</td><td>${i.date}</td><td style="text-align:right"><strong>${fmt(i.grossAmount)} ${i.currency}</strong></td><td>${i.clientName}</td></tr>`).join('')}</tbody></table>` : ''}`;
  } else if (type === 'cashflow') {
    const inflow = data.invoices.filter(i => i.direction === 'Kimenő').reduce((s, i) => s + i.grossAmount, 0);
    const outflow = data.invoices.filter(i => i.direction === 'Bejövő').reduce((s, i) => s + i.grossAmount, 0);
    tableHtml = `
      <div class="summary"><span style="color:hsl(173, 80%, 40%)">Befolyó: <strong>+${fmt(inflow)} Ft</strong></span> &nbsp;|&nbsp; <span style="color:#dc2626">Kiáramló: <strong>-${fmt(outflow)} Ft</strong></span> &nbsp;|&nbsp; Egyenleg: <strong>${fmt(inflow - outflow)} Ft</strong></div>
      ${options.details ? `<table><thead><tr><th>Irány</th><th>Partner</th><th>Dátum</th><th style="text-align:right">Összeg</th><th>Ügyfél</th></tr></thead>
      <tbody>${data.invoices.map(i => `<tr><td><span class="badge ${i.direction === 'Kimenő' ? 'rendben' : 'kritikus'}">${i.direction}</span></td><td>${i.partnerName}</td><td>${i.date}</td><td style="text-align:right"><strong>${i.direction === 'Kimenő' ? '+' : '-'}${fmt(i.grossAmount)} ${i.currency}</strong></td><td>${i.clientName}</td></tr>`).join('')}</tbody></table>` : ''}`;
  } else if (type === 'partner') {
    const byPartner: Record<string, { count: number; total: number }> = {};
    data.invoices.forEach(inv => {
      if (!byPartner[inv.partnerName]) byPartner[inv.partnerName] = { count: 0, total: 0 };
      byPartner[inv.partnerName].count++;
      byPartner[inv.partnerName].total += inv.grossAmount;
    });
    const sorted = Object.entries(byPartner).sort((a, b) => b[1].total - a[1].total);
    tableHtml = `
      <div class="summary">Egyedi partnerek: <strong>${sorted.length}</strong></div>
      ${options.details ? `<table><thead><tr><th>Partner</th><th style="text-align:right">Számlák</th><th style="text-align:right">Forgalom</th></tr></thead>
      <tbody>${sorted.map(([name, d]) => `<tr><td><strong>${name}</strong></td><td style="text-align:right">${d.count}</td><td style="text-align:right"><strong>${fmt(d.total)} Ft</strong></td></tr>`).join('')}</tbody></table>` : ''}`;
  }

  const html = `<html><head><title>${title} – eaisybooks</title>
    <style>
      body { font-family: 'Segoe UI', sans-serif; padding: 40px; color: #1e293b; }
      h1 { font-size: 22px; margin-bottom: 4px; }
      p.sub { color: #64748b; font-size: 13px; margin-bottom: 24px; }
      .summary { background: #f8fafc; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; font-size: 14px; border: 1px solid #e2e8f0; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th { text-align: left; padding: 10px 12px; background: #f1f5f9; border-bottom: 2px solid #e2e8f0; font-weight: 600; }
      td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
      tr:nth-child(even) { background: #f8fafc; }
      .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; }
      .rendben { background: #d1fae5; color: #065f46; }
      .feldolgozando { background: #fef3c7; color: #92400e; }
      .kritikus { background: #fee2e2; color: #991b1b; }
      .print-btn { display: inline-flex; align-items: center; gap: 6px; margin-bottom: 24px; padding: 8px 18px; background: #111827; color: #fff; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
      .print-btn:hover { background: #1e293b; }
      @media print { .print-btn { display: none; } body { padding: 20px; } }
    </style></head><body>
    <button class="print-btn" onclick="window.print()">🖨 Nyomtatás / Mentés PDF-ként</button>
    <h1>${title}</h1>
    <p class="sub">Generálva: ${now} – eaisybooks</p>
    ${tableHtml}
    </body></html>`;
  
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}
