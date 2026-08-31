import React from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { fmtEft } from '../types';

interface VatNav65ReplicaProps {
  selectedCompany: any;
  year: number;
  month: number;
  frequency: string;
  getVal: (row: string, col: 'base' | 'tax') => number;
}

export function VatNav65Replica({
  selectedCompany,
  year,
  month,
  frequency,
  getVal,
}: VatNav65ReplicaProps) {
  const periodLabel =
    frequency === 'H'
      ? `${year}. ${month}. hó`
      : frequency === 'N'
      ? `${year}. Q${month}`
      : `${year}. év`;

  const fields = [
    {
      num: '01',
      type: 'Fizetendő',
      label: '27%-os kulcsú belföldi értékesítés adóalapja',
      val: getVal('01', 'base'),
      isBase: true,
    },
    {
      num: '01',
      type: 'Fizetendő',
      label: '27%-os kulcsú belföldi értékesítés fizetendő ÁFA',
      val: getVal('01', 'tax'),
      isBase: false,
    },
    {
      num: '17',
      type: 'Fizetendő',
      label: '5%-os kulcsú belföldi értékesítés adóalapja',
      val: getVal('17', 'base'),
      isBase: true,
    },
    {
      num: '17',
      type: 'Fizetendő',
      label: '5%-os kulcsú belföldi értékesítés fizetendő ÁFA',
      val: getVal('17', 'tax'),
      isBase: false,
    },
    {
      num: '36',
      type: 'Fizetendő',
      label: 'Összes fizetendő adó (Összesítő sor)',
      val: getVal('36', 'tax'),
      isBase: false,
      isSummary: true,
    },
    {
      num: '63',
      type: 'Levonható',
      label: '27%-os belföldi beszerzés adóalapja',
      val: getVal('63', 'base'),
      isBase: true,
    },
    {
      num: '63',
      type: 'Levonható',
      label: '27%-os belföldi beszerzés levonható ÁFA',
      val: getVal('63', 'tax'),
      isBase: false,
    },
    {
      num: '76',
      type: 'Levonható',
      label: 'Összes levonható adó (Összesítő sor)',
      val: getVal('76', 'tax'),
      isBase: false,
      isSummary: true,
    },
    {
      num: '82',
      type: 'Elszámolás',
      label: 'Előző időszakról áthozott követelés (82. sor)',
      val: getVal('82', 'tax'),
      isBase: false,
    },
    {
      num: '83',
      type: 'Elszámolás',
      label: 'Különbözet / nettó egyenleg (83. sor)',
      val: getVal('83', 'tax'),
      isBase: false,
    },
    {
      num: '84',
      type: 'Elszámolás',
      label: 'Befizetendő adó (Költségvetési tartozás)',
      val: getVal('84', 'tax'),
      isBase: false,
      isSummary: true,
    },
    {
      num: '86',
      type: 'Elszámolás',
      label: 'Következő időszakra átvihető követelés (86. sor)',
      val: getVal('86', 'tax'),
      isBase: false,
      isSummary: true,
    },
  ];

  return (
    <Card className="border border-stone-300 shadow-lg bg-[#fefbf0] text-stone-900 rounded-xl overflow-hidden">
      <CardHeader className="bg-stone-100 border-b border-stone-200 p-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h3 className="font-serif font-black text-xl tracking-tight text-stone-800">
              2665-A Bevallási Lap Mock
            </h3>
            <p className="text-[11px] text-stone-500 font-mono">
              Nemzeti Adó- és Vámhivatal hivatalos nyomtatvány replika
            </p>
          </div>
          <div className="bg-amber-100 border border-amber-300 text-amber-800 text-xs font-mono font-bold px-3 py-1 rounded select-none">
            2665-A LAP
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono border-b border-stone-200 pb-4">
          <div className="space-y-1">
            <span className="text-[10px] text-stone-500 block">Adózó neve:</span>
            <span className="font-bold text-stone-800 uppercase">{selectedCompany?.name}</span>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] text-stone-500 block">Adószáma:</span>
            <span className="font-bold text-stone-800">{selectedCompany?.tax_number}</span>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] text-stone-500 block">Bevallási időszak:</span>
            <span className="font-bold text-stone-800">{periodLabel}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {fields.map((f, idx) => (
            <div
              key={idx}
              className={cn(
                'p-3.5 rounded-lg border flex flex-col justify-between min-h-[120px] transition-all hover:shadow-sm',
                f.isSummary
                  ? 'bg-stone-200/90 border-stone-300 text-stone-800'
                  : 'bg-amber-50/70 border-amber-200 text-amber-900'
              )}
            >
              <div className="flex items-start justify-between">
                <span
                  className={cn(
                    'font-mono font-black text-xs px-2 py-0.5 rounded',
                    f.isSummary ? 'bg-stone-300 text-stone-800' : 'bg-amber-200 text-amber-800'
                  )}
                >
                  {f.num}. sor
                </span>
                <span className="text-[9px] font-bold text-stone-400 uppercase tracking-wider">
                  {f.type}
                </span>
              </div>
              <p className="text-[11px] font-medium leading-normal my-2.5">{f.label}</p>
              <div className="flex justify-between items-end border-t pt-2 border-stone-200/50">
                <span className="text-[9px] text-stone-400">
                  {f.isBase ? 'adóalap (eFt)' : 'adó összege (eFt)'}
                </span>
                <span className="font-mono text-xs font-black tabular-nums">
                  {fmtEft(f.val)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
