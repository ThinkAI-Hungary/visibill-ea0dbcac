import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ExportButton } from '@/components/accounty/ExportButton';
import {
  ArrowLeft, FileSpreadsheet, Download, Eye, Banknote, AlertTriangle,
  Users, Coffee, FileText, CheckCircle, Printer
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type DocType = 'cash' | 'garnishment' | 'cafeteria' | 'summary' | 'certificates';

interface DocConfig {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  color: string;
  columns: { key: string; label: string; align?: 'right' | 'center' }[];
  data: Record<string, string | number>[];
  footer?: { label: string; value: string };
}

const CONFIGS: Record<DocType, DocConfig> = {
  cash: {
    title: 'Készpénzes kifizetési lista', subtitle: 'Mt. 158. § — Készpénzben fizetett bér dokumentálása',
    icon: Banknote, color: 'from-amber-500 to-orange-500',
    columns: [
      { key: 'name', label: 'Munkavállaló' },
      { key: 'netAmount', label: 'Nettó összeg (Ft)', align: 'right' },
      { key: 'payDate', label: 'Kifizetés dátuma', align: 'center' },
      { key: 'signature', label: 'Aláírás', align: 'center' },
    ],
    data: [
      { name: 'Molnár Gábor', netAmount: '214 662', payDate: '2026-06-10', signature: '□' },
      { name: 'Varga László', netAmount: '189 500', payDate: '2026-06-10', signature: '□' },
    ],
    footer: { label: 'Készpénzes összesen', value: '404 162 Ft' },
  },
  garnishment: {
    title: 'Letiltások és levonások jegyzéke', subtitle: 'Bírósági végrehajtás és egyéb letiltások nyilvántartása',
    icon: AlertTriangle, color: 'from-red-500 to-pink-500',
    columns: [
      { key: 'name', label: 'Munkavállaló' },
      { key: 'type', label: 'Típus' },
      { key: 'caseNumber', label: 'Ügyszám' },
      { key: 'monthlyAmount', label: 'Havi levonás (Ft)', align: 'right' },
      { key: 'remaining', label: 'Hátralék (Ft)', align: 'right' },
      { key: 'priority', label: 'Sorrend', align: 'center' },
    ],
    data: [
      { name: 'Kiss Béla', type: 'Gyermektartásdíj', caseNumber: 'Vht.2024/1234', monthlyAmount: '75 000', remaining: '450 000', priority: '1.' },
      { name: 'Kiss Béla', type: 'Adó végrehajtás', caseNumber: 'NAV-2025/5678', monthlyAmount: '30 000', remaining: '180 000', priority: '2.' },
      { name: 'Szabó Péter', type: 'Magánhitel végrehajtás', caseNumber: 'Bír.2025/9012', monthlyAmount: '50 000', remaining: '600 000', priority: '1.' },
    ],
    footer: { label: 'Havi levonások összesen', value: '155 000 Ft' },
  },
  cafeteria: {
    title: 'Cafeteria feltöltési fájlok', subtitle: 'SZÉP-kártya és egyéb cafeteria juttatások exportja',
    icon: Coffee, color: 'from-violet-500 to-purple-500',
    columns: [
      { key: 'name', label: 'Munkavállaló' },
      { key: 'cardNumber', label: 'Kártyaszám' },
      { key: 'szallasAmount', label: 'Szálláshely (Ft)', align: 'right' },
      { key: 'vendeglatasAmount', label: 'Vendéglátás (Ft)', align: 'right' },
      { key: 'szabadidoAmount', label: 'Szabadidő (Ft)', align: 'right' },
      { key: 'total', label: 'Összesen (Ft)', align: 'right' },
    ],
    data: [
      { name: 'Nagy Anna', cardNumber: 'SZEP-1234-5678', szallasAmount: '50 000', vendeglatasAmount: '30 000', szabadidoAmount: '20 000', total: '100 000' },
      { name: 'Kiss Béla', cardNumber: 'SZEP-2345-6789', szallasAmount: '50 000', vendeglatasAmount: '30 000', szabadidoAmount: '20 000', total: '100 000' },
      { name: 'Tóth Éva', cardNumber: 'SZEP-3456-7890', szallasAmount: '30 000', vendeglatasAmount: '20 000', szabadidoAmount: '15 000', total: '65 000' },
    ],
    footer: { label: 'Cafeteria összesen', value: '265 000 Ft' },
  },
  summary: {
    title: 'Munkáltatói összesítő', subtitle: 'Havi bérszámfejtés munkáltatói összesítő kimutatás',
    icon: Users, color: 'from-slate-500 to-slate-700',
    columns: [
      { key: 'item', label: 'Tétel' },
      { key: 'amount', label: 'Összeg (Ft)', align: 'right' },
      { key: 'note', label: 'Megjegyzés' },
    ],
    data: [
      { item: 'Bruttó bérek összesen', amount: '15 420 000', note: '42 fő' },
      { item: 'Munkáltatót terhelő SZOCHO (13%)', amount: '2 004 600', note: '' },
      { item: 'Munkáltatót terhelő szakképzési hozzájárulás', amount: '0', note: 'SZOCHO-ba beolvadt' },
      { item: 'Munkavállalók SZJA', amount: '2 313 000', note: 'Levont 15%' },
      { item: 'Munkavállalók TB járulék', amount: '2 852 700', note: 'Levont 18,5%' },
      { item: 'Családi kedvezmény', amount: '-380 000', note: '8 fő érvényesíti' },
      { item: 'Nettó bérek összesen', amount: '10 254 300', note: 'Utalandó' },
      { item: 'Teljes bérköltség (bruttó+SZOCHO)', amount: '17 424 600', note: '' },
    ],
    footer: { label: 'Teljes munkáltatói bérköltség', value: '17 424 600 Ft' },
  },
  certificates: {
    title: 'Jövedelem- és foglalkoztatási igazolások', subtitle: 'Egyedi igazolások generálása munkavállalók részére',
    icon: FileText, color: 'from-green-500 to-emerald-500',
    columns: [
      { key: 'name', label: 'Munkavállaló' },
      { key: 'type', label: 'Igazolás típusa' },
      { key: 'purpose', label: 'Cél' },
      { key: 'requestDate', label: 'Kérelem dátuma', align: 'center' },
      { key: 'status', label: 'Státusz', align: 'center' },
    ],
    data: [
      { name: 'Nagy Anna', type: 'Jövedelemigazolás', purpose: 'Hitelkérelem (OTP)', requestDate: '2026-06-05', status: ' Kész' },
      { name: 'Tóth Éva', type: 'Foglalkoztatási igazolás', purpose: 'Lakáspályázat', requestDate: '2026-06-08', status: ' Kész' },
      { name: 'Szabó Péter', type: 'Jövedelemigazolás', purpose: 'Bíróság', requestDate: '2026-06-10', status: ' Folyamatban' },
      { name: 'Kiss Béla', type: 'TB igazolás', purpose: 'Kórházi kezelés', requestDate: '2026-06-09', status: ' Kész' },
      { name: 'Horváth Dávid', type: 'Munkáltatói igazolás', purpose: 'Albérlet kérelem', requestDate: '2026-06-10', status: ' Folyamatban' },
    ],
  },
};

export default function OutputDocumentsPage() {
  const { id, docType } = useParams<{ id: string; docType: string }>();
  const config = CONFIGS[docType as DocType];

  if (!config) {
    return (
      <div className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
        <div className="flex items-center gap-3">
          <button onClick={() => window.history.back()} className="p-2 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="w-5 h-5" /></button>
          <h1 className="text-2xl font-bold">Kimeneti dokumentumok</h1>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(CONFIGS).map(([key, cfg]) => (
            <Link key={key} to={`/accounty/payroll/${id}/documents/${key}`}
              className="p-4 rounded-xl border border-border hover:border-blue-300 hover:shadow-lg hover:-translate-y-0.5 transition-all group">
              <div className={cn('w-8 h-8 rounded-lg bg-gradient-to-br text-white flex items-center justify-center mb-2', cfg.color)}>
                <cfg.icon className="w-4 h-4" />
              </div>
              <p className="text-sm font-bold">{cfg.title}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{cfg.subtitle}</p>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => window.history.back()} className="p-2 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="w-5 h-5" /></button>
          <div className={cn('p-2.5 bg-gradient-to-br rounded-xl shadow-lg', config.color)}><config.icon className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-xl font-bold">{config.title}</h1>
            <p className="text-sm text-slate-500">{config.subtitle}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-1.5" onClick={() => window.print()}><Printer className="w-4 h-4" /> Nyomtatás</Button>
          <ExportButton
            filename={docType || 'document'}
            headers={config.columns.map(c => c.label)}
            getRows={() => config.data.map(row => config.columns.map(c => row[c.key] ?? ''))}
          />
          <Button className={cn('gap-1.5 bg-gradient-to-r hover:opacity-90', config.color)} onClick={() => window.print()}><Download className="w-4 h-4" /> PDF letöltés</Button>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border dark:bg-slate-900/20">
              {config.columns.map(col => (
                <th key={col.key} className={cn('px-5 py-2 text-xs font-bold text-slate-500', col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left')}>{col.label}</th>
              ))}
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {config.data.map((row, ri) => (
              <tr key={ri} className="border-b border-border/50 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                {config.columns.map(col => (
                  <td key={col.key} className={cn('px-5 py-2.5', col.align === 'right' ? 'text-right font-mono' : col.align === 'center' ? 'text-center' : '', col.key === 'name' || col.key === 'item' ? 'font-medium' : '')}>{String(row[col.key] || '')}</td>
                ))}
                <td className="px-3 py-2.5"><Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Eye className="w-3 h-3" /></Button></td>
              </tr>
            ))}
          </tbody>
          {config.footer && (
            <tfoot>
              <tr className="bg-slate-100 dark:bg-slate-800 font-bold">
                <td colSpan={config.columns.length - 1} className="px-5 py-2 text-xs">{config.footer.label}</td>
                <td className="px-5 py-2 text-right font-mono text-xs">{config.footer.value}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
