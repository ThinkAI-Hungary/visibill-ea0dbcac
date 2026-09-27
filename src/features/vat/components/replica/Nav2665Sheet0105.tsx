import React from 'react';

interface Nav2665Sheet0105Props {
  getVal: (row: string, col: 'base' | 'tax') => number;
  partnerCount?: number;
  invoiceCount?: number;
  mLineTotalBase?: number;
  mLineTotalTax?: number;
}

/**
 * 2665A-01-05 lap: 6/A, 6/B acél/mezőgazdaság fordított adózás (100 - 103)
 * és a 2665M összesítő jelentés göngyölése (105 - 109. sorok).
 */
export function Nav2665Sheet0105({
  getVal,
  partnerCount = 5,
  invoiceCount = 5,
  mLineTotalBase,
  mLineTotalTax,
}: Nav2665Sheet0105Props) {
  // If not passed explicitly, use calculated/fallback values from getVal or defaults
  const base105 = mLineTotalBase != null ? mLineTotalBase : getVal('105', 'base');
  const tax105 = mLineTotalTax != null ? mLineTotalTax : getVal('105', 'tax');

  return (
    <div className="border border-neutral-900 bg-white select-text space-y-4">
      {/* SECTION 1: 6/A és 6/B melléklet (Mezőgazdasági és Vas/Acél) */}
      <div className="border border-black">
        <div className="bg-neutral-100 border-b border-black px-3 py-1.5 text-center font-bold text-[10px] uppercase text-neutral-800 tracking-tight">
          Az Áfa tv. 6/A. és 6/B. számú mellékletében felsorolt termékek értékesítése / beszerzése fordított adózás keretében
        </div>

        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr className="border-b border-black bg-neutral-100 text-center font-bold">
              <th className="w-9 border-r border-b border-black p-1"></th>
              <th className="border-r border-b border-black p-1">a</th>
              <th colSpan={2} className="border-r border-b border-black p-1 bg-amber-50/50">
                Mezőgazdasági termékek
              </th>
              <th colSpan={2} className="border-r border-b border-black p-1 bg-purple-50/50">
                Vas- és acéltermékek (6/B.)
              </th>
              <th className="w-9 border-b border-black p-1"></th>
            </tr>
            <tr className="border-b-2 border-black bg-neutral-50 text-[9px] text-center font-semibold text-neutral-600">
              <th className="w-9 border-r border-b-2 border-black"></th>
              <th className="border-r border-b-2 border-black"></th>
              <th className="w-24 border-r border-b-2 border-black p-0.5">Az adó alapja (b)</th>
              <th className="w-24 border-r border-b-2 border-black p-0.5">Az adó összege (c)</th>
              <th className="w-24 border-r border-b-2 border-black p-0.5">Az adó alapja (d)</th>
              <th className="w-24 border-r border-b-2 border-black p-0.5">Az adó összege (e)</th>
              <th className="w-9 border-b-2 border-black"></th>
            </tr>
          </thead>
          <tbody>
            {/* 100. sor: Értékesítés */}
            <tr className="border-b border-black hover:bg-amber-50/40">
              <td className="w-9 border-r border-b border-black text-center font-mono font-bold p-1">100.</td>
              <td className="border-r border-b border-black p-1.5 leading-tight">
                Fordított adózás keretében értékesített termékek adóalapja a 04. sor összegéből
              </td>
              <td className="w-24 border-r border-b border-black p-1 text-right font-mono text-[11px] pr-2">
                {getVal('100_agri', 'base') ? Math.round(getVal('100_agri', 'base')).toLocaleString('hu-HU') : ''}
              </td>
              <td className="w-24 border-r border-b border-black p-1 bg-neutral-100/80 print:bg-transparent"></td>
              <td className="w-24 border-r border-b border-black p-1 text-right font-mono font-bold text-[11px] pr-2 bg-purple-50/20">
                {getVal('100', 'base') ? Math.round(getVal('100', 'base')).toLocaleString('hu-HU') : ''}
              </td>
              <td className="w-24 border-r border-b border-black p-1 bg-neutral-100/80 print:bg-transparent"></td>
              <td className="w-9 border-b border-black text-center font-mono font-bold p-1">100.</td>
            </tr>

            {/* 101. sor: Beszerzés */}
            <tr className="border-b border-black hover:bg-amber-50/40">
              <td className="w-9 border-r border-b border-black text-center font-mono font-bold p-1">101.</td>
              <td className="border-r border-b border-black p-1.5 leading-tight">
                Fordított adózás keretében beszerzett termékekre jutó adóalap és adó a 29. sor összegéből
              </td>
              <td className="w-24 border-r border-b border-black p-1 text-right font-mono text-[11px] pr-2">
                {getVal('101_agri', 'base') ? Math.round(getVal('101_agri', 'base')).toLocaleString('hu-HU') : ''}
              </td>
              <td className="w-24 border-r border-b border-black p-1 text-right font-mono text-[11px] pr-2">
                {getVal('101_agri', 'tax') ? Math.round(getVal('101_agri', 'tax')).toLocaleString('hu-HU') : ''}
              </td>
              <td className="w-24 border-r border-b border-black p-1 text-right font-mono font-bold text-[11px] pr-2 bg-purple-50/20">
                {getVal('101', 'base') ? Math.round(getVal('101', 'base')).toLocaleString('hu-HU') : ''}
              </td>
              <td className="w-24 border-r border-b border-black p-1 text-right font-mono font-bold text-[11px] pr-2 bg-purple-50/20">
                {getVal('101', 'tax') ? Math.round(getVal('101', 'tax')).toLocaleString('hu-HU') : ''}
              </td>
              <td className="w-9 border-b border-black text-center font-mono font-bold p-1">101.</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* SECTION 2: 2665M Összesítő jelentés nyomtatvány göngyölése (105 - 109) */}
      <div className="border border-black">
        <div className="bg-neutral-100 border-b border-black px-3 py-1.5 text-center font-bold text-[10px] uppercase text-neutral-800 tracking-tight">
          A csatolt összes 2665M összesítő jelentés nyomtatványon feltüntetett - belföldi, egyenes adózás alá tartozó, a 2665M részletező lapokon számlánként kimutatott - forgalom összesen
        </div>

        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr className="border-b-2 border-black bg-neutral-100 text-center font-bold text-[9px] uppercase">
              <th className="border-r border-b-2 border-black p-1">Termékbeszerzés / Szolgáltatás igénybevétel</th>
              <th className="w-14 border-r border-b-2 border-black p-1">Partnerek (db)</th>
              <th className="w-14 border-r border-b-2 border-black p-1">Számlák (db)</th>
              <th className="w-24 border-r border-b-2 border-black p-1">Adó alapja (d)</th>
              <th className="w-24 border-r border-b-2 border-black p-1">Adó összege (e)</th>
              <th className="w-32 border-r border-b-2 border-black p-1">Levonásba helyezett adó (27%)</th>
              <th className="w-9 border-b-2 border-black p-1"></th>
            </tr>
          </thead>
          <tbody>
            {/* 105. sor */}
            <tr className="border-b border-black hover:bg-amber-50/40">
              <td className="border-r border-b border-black p-1.5 leading-tight">
                Termékbeszerzés / szolgáltatás-igénybevétel számlatételeinek összege összesen (Összes 2665M Főlap 04. sor adóalap és adó összegeinek együttes adata)
              </td>
              <td className="w-14 border-r border-b border-black p-1 text-center font-mono font-bold">
                {partnerCount || 0}
              </td>
              <td className="w-14 border-r border-b border-black p-1 text-center font-mono font-bold">
                {invoiceCount || 0}
              </td>
              <td className="w-24 border-r border-b border-black p-1 text-right font-mono font-bold pr-2">
                {base105 ? Math.round(base105).toLocaleString('hu-HU') : ''}
              </td>
              <td className="w-24 border-r border-b border-black p-1 text-right font-mono font-bold pr-2">
                {tax105 ? Math.round(tax105).toLocaleString('hu-HU') : ''}
              </td>
              <td className="w-32 border-r border-b border-black p-1 text-right font-mono font-bold pr-2">
                {tax105 ? Math.round(tax105).toLocaleString('hu-HU') : ''}
              </td>
              <td className="w-9 border-b border-black text-center font-mono font-bold p-1">105.</td>
            </tr>

            {/* 106. sor */}
            <tr className="border-b border-neutral-900 hover:bg-amber-50/40">
              <td className="border-r border-neutral-900 p-1.5 leading-tight">
                Termékbeszerzés / szolgáltatás-igénybevétel tételes részletezett korrekcióinak összege összesen (Összes 2665M Főlap 05. sor)
              </td>
              <td className="w-14 border-r border-neutral-900 p-1 text-center font-mono">0</td>
              <td className="w-14 border-r border-neutral-900 p-1 text-center font-mono">0</td>
              <td className="w-24 border-r border-neutral-900 p-1 text-right font-mono pr-2">0</td>
              <td className="w-24 border-r border-neutral-900 p-1 text-right font-mono pr-2">0</td>
              <td className="w-32 border-r border-neutral-900 p-1 text-right font-mono pr-2">0</td>
              <td className="w-9 text-center font-mono font-bold p-1">106.</td>
            </tr>

            {/* 108. sor: Összesítő sor */}
            <tr className="border-b border-neutral-900 bg-neutral-100 font-bold hover:bg-amber-50/40">
              <td className="border-r border-neutral-900 p-1.5 leading-tight">
                Összesítő jelentésekben szereplő termékbeszerzés / szolgáltatás-igénybevétel összege összesen (A 105., 106. sorok adata összesen)
              </td>
              <td className="w-14 border-r border-neutral-900 p-1 text-center font-mono">
                {partnerCount || 0}
              </td>
              <td className="w-14 border-r border-neutral-900 p-1 text-center font-mono">
                {invoiceCount || 0}
              </td>
              <td className="w-24 border-r border-neutral-900 p-1 text-right font-mono text-[11px] pr-2">
                {base105 ? Math.round(base105).toLocaleString('hu-HU') : ''}
              </td>
              <td className="w-24 border-r border-neutral-900 p-1 text-right font-mono text-[11px] pr-2">
                {tax105 ? Math.round(tax105).toLocaleString('hu-HU') : ''}
              </td>
              <td className="w-32 border-r border-neutral-900 p-1 text-right font-mono text-[11px] pr-2">
                {tax105 ? Math.round(tax105).toLocaleString('hu-HU') : ''}
              </td>
              <td className="w-9 text-center font-mono font-bold p-1">108.</td>
            </tr>

            {/* 109. sor: Különbözet ellenőrzés */}
            <tr className="hover:bg-amber-50/40">
              <td className="border-r border-neutral-900 p-1.5 leading-tight">
                A levonásba helyezett, áthárított adó számított összege meghaladja az összesítő jelentésekben szereplő összesen adó összeget (109. sor c) és a 108. sor e) mezők különbözete)
              </td>
              <td colSpan={2} className="border-r border-neutral-900 p-1 text-center text-neutral-500 italic text-[9px]">
                Levonásba helyezett:
              </td>
              <td className="w-24 border-r border-neutral-900 p-1 text-right font-mono font-bold pr-2 bg-emerald-50/30">
                {tax105 ? Math.round(tax105).toLocaleString('hu-HU') : '0'}
              </td>
              <td colSpan={2} className="border-r border-neutral-900 p-1 text-center text-[9px] font-bold text-neutral-700">
                Különbözet: <span className="font-mono text-emerald-700">0</span> eFt
              </td>
              <td className="w-9 text-center font-mono font-bold p-1">109.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
