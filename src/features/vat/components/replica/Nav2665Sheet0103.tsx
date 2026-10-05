import React from 'react';
import { Nav2665TableRow } from './Nav2665TableRow';

interface Nav2665Sheet0103Props {
  getVal: (row: string, col: 'base' | 'tax') => number;
}

/**
 * 2665A-01-03 lap: Levonható folytatás (72 - 79), Elszámolás (82 - 86) és Részletező adatok (88 - 95).
 */
export function Nav2665Sheet0103({ getVal }: Nav2665Sheet0103Props) {
  const row82 = getVal('82', 'tax');
  const row83 = getVal('83', 'tax');
  const row84 = getVal('84', 'tax');
  const row85 = getVal('85', 'tax');
  const row86 = getVal('86', 'tax');

  return (
    <div className="border border-neutral-900 bg-white select-text space-y-4">
      {/* 1. SECTION: Levonható adó folytatása (72 - 79) */}
      <div className="border border-black">
        <div className="bg-neutral-100 border-b border-black px-3 py-1 flex justify-between items-center text-[10px] font-bold">
          <span className="uppercase text-neutral-800">
            Levonható adó folytatása és göngyölése
          </span>
          <span className="text-neutral-500 font-normal italic">
            Az adatokat ezer forintban kell feltüntetni!
          </span>
        </div>

        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-neutral-100 text-[9px] font-bold text-neutral-800 text-center uppercase tracking-tight">
              <th className="w-8 sm:w-9 border-r border-b-2 border-black p-1 print:py-0.5"></th>
              <th className="border-r border-b-2 border-black p-1 font-sans print:py-0.5">a</th>
              <th className="w-28 sm:w-36 border-r border-b-2 border-black p-1 print:py-0.5">
                <div>Az adó alapja</div>
                <div className="text-[8px] font-normal text-neutral-500 italic lowercase print:text-[7.5px]">
                  (tényleges vagy helyesbített)
                </div>
              </th>
              <th className="w-28 sm:w-36 border-r border-b-2 border-black p-1 print:py-0.5">
                <div>Az adó összege</div>
                <div className="text-[8px] font-normal text-neutral-500 italic lowercase print:text-[7.5px]">
                  (tényleges vagy helyesbített)
                </div>
              </th>
              <th className="w-8 sm:w-9 border-b-2 border-black p-1 print:py-0.5"></th>
            </tr>
          </thead>
          <tbody>
            <Nav2665TableRow
              rowNum="72"
              title="7 %-os mértékű mezőgazdasági kompenzációs felár"
              baseVal={getVal('72', 'base')}
              taxVal={getVal('72', 'tax')}
            />
            <Nav2665TableRow
              rowNum="73"
              title="12 %-os mértékű mezőgazdasági kompenzációs felár"
              baseVal={getVal('73', 'base')}
              taxVal={getVal('73', 'tax')}
            />
            <Nav2665TableRow
              rowNum="74"
              title="Saját vállalkozáson belül végzett beruházás után"
              hasBase={false}
              taxVal={getVal('74', 'tax')}
            />
            <Nav2665TableRow
              rowNum="75"
              title="Egyéb"
              baseVal={getVal('75', 'base')}
              taxVal={getVal('75', 'tax')}
            />
            <Nav2665TableRow
              rowNum="76"
              title="Összesen (63-75. sorok és 111. sor összege)"
              baseVal={getVal('76', 'base')}
              taxVal={getVal('76', 'tax')}
              isSummary={true}
              className="border-t-2 border-neutral-900 bg-neutral-100"
            />
            <Nav2665TableRow
              rowNum="77"
              title="Tárgyi eszköz beszerzése után levonható adó összege a 76. sor összegéből (apport nélkül)"
              baseVal={getVal('77', 'base')}
              taxVal={getVal('77', 'tax')}
            />
            <Nav2665TableRow
              rowNum="78"
              title="Apportbeszerzés után levonható adó összege a 76. sor összegéből"
              hasBase={false}
              taxVal={getVal('78', 'tax')}
            />
            <Nav2665TableRow
              rowNum="79"
              title="Saját vállalkozásban megvalósuló, még nem aktivált beruházás összege a 76. sor összegéből"
              hasBase={false}
              taxVal={getVal('79', 'tax')}
            />
          </tbody>
        </table>
      </div>

      {/* 2. SECTION: Általános forgalmi adó elszámolása (82 - 86) */}
      <div className="border-2 border-neutral-900 bg-white">
        <div className="bg-neutral-800 text-white font-bold text-xs uppercase px-3 py-1.5 text-center tracking-wide">
          Általános forgalmi adó elszámolása
        </div>

        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-neutral-100 text-[9px] font-bold text-neutral-800 text-center uppercase tracking-tight">
              <th className="w-8 sm:w-9 border-r border-b-2 border-black p-1 print:py-0.5"></th>
              <th className="border-r border-b-2 border-black p-1 font-sans print:py-0.5">a</th>
              <th className="w-28 sm:w-36 border-r border-b-2 border-black p-1 print:py-0.5">
                Önellenőrzés esetén
              </th>
              <th className="w-28 sm:w-36 border-r border-b-2 border-black p-1 print:py-0.5">
                <div>Az adó összege</div>
                <div className="text-[8px] font-normal text-neutral-500 italic lowercase print:text-[7.5px]">
                  (tényleges vagy helyesbített)
                </div>
              </th>
              <th className="w-8 sm:w-9 border-b-2 border-black p-1 print:py-0.5"></th>
            </tr>
          </thead>
          <tbody>
            {/* 82. sor */}
            <tr className="border-b border-black text-[11px] hover:bg-amber-50/40 print:text-[9.5px]">
              <td className="w-8 sm:w-9 border-r border-b border-black text-center font-mono font-bold p-1 print:py-[1.5px]">
                82.
              </td>
              <td className="border-r border-b border-black p-1.5 print:py-[1.5px] print:px-1">
                <div className="flex justify-between items-center">
                  <span>
                    Előző időszakról beszámítható csökkentő tétel összege (előző időszak bevallásának a
                    "Következő időszakra átvihető követelés összege" sorából)
                  </span>
                  <div className="flex items-center gap-1 text-[9px] border border-neutral-400 px-1 py-0.5 ml-2">
                    <span>Elévült követelés:</span>
                    <div className="w-3.5 h-3.5 border border-black" />
                  </div>
                </div>
              </td>
              <td className="w-28 sm:w-36 border-r border-b border-black p-1 bg-neutral-100/80 print:bg-transparent"></td>
              <td className="w-28 sm:w-36 border-r border-b border-black p-1 text-right font-mono text-[12px] font-bold relative print:py-[1.5px]">
                <div className="flex items-center justify-end h-full px-1">
                  <span>{row82 ? Math.round(row82).toLocaleString('hu-HU') : ''}</span>
                  <span className="text-[7px] text-neutral-400 absolute bottom-0.5 right-1">ezer</span>
                </div>
              </td>
              <td className="w-8 sm:w-9 border-b border-black text-center font-mono font-bold p-1 print:py-[1.5px]">82.</td>
            </tr>

            {/* 83. sor: Különbözet */}
            <tr className="border-b border-black text-[11px] bg-neutral-50 font-bold hover:bg-amber-50/40 print:text-[9.5px]">
              <td className="w-8 sm:w-9 border-r border-b border-black text-center font-mono font-bold p-1 print:py-[1.5px]">
                83.
              </td>
              <td className="border-r border-b border-black p-1.5 print:py-[1.5px] print:px-1">
                Tárgyidőszakban megállapított fizetendő adó együttes összegének és a levonható előzetesen
                felszámított adónak a különbözete (36. sor - 76. sor - 82. sor)
              </td>
              <td className="w-28 sm:w-36 border-r border-b border-black p-1 bg-neutral-100/80 print:bg-transparent"></td>
              <td className="w-28 sm:w-36 border-r border-b border-black p-1 text-right font-mono text-[13px] font-black relative print:py-[1.5px]">
                <div className="flex items-center justify-end h-full px-1 text-neutral-900">
                  <span>{row83 ? Math.round(row83).toLocaleString('hu-HU') : (row83 === 0 ? '0' : '')}</span>
                  <span className="text-[7px] text-neutral-400 absolute bottom-0.5 right-1">ezer</span>
                </div>
              </td>
              <td className="w-8 sm:w-9 border-b border-black text-center font-mono font-bold p-1 print:py-[1.5px]">83.</td>
            </tr>

            {/* 84. sor: Befizetendő */}
            <tr className="border-b border-black text-[11px] hover:bg-amber-50/40 print:text-[9.5px]">
              <td className="w-8 sm:w-9 border-r border-b border-black text-center font-mono font-bold p-1 print:py-[1.5px]">
                84.
              </td>
              <td className="border-r border-b border-black p-1.5 font-medium print:py-[1.5px] print:px-1">
                Befizetendő adó összege (ha a 83. sor adata, ha előjel nélküli és pozitív)
              </td>
              <td className="w-28 sm:w-36 border-r border-b border-black p-1 bg-neutral-100/80 print:bg-transparent"></td>
              <td className="w-28 sm:w-36 border-r border-b border-black p-1 text-right font-mono text-[12px] font-bold text-red-700 relative print:py-[1.5px]">
                <div className="flex items-center justify-end h-full px-1">
                  <span>{row84 ? Math.round(row84).toLocaleString('hu-HU') : ''}</span>
                  <span className="text-[7px] text-neutral-400 absolute bottom-0.5 right-1">ezer</span>
                </div>
              </td>
              <td className="w-8 sm:w-9 border-b border-black text-center font-mono font-bold p-1 print:py-[1.5px]">84.</td>
            </tr>

            {/* 85. sor: Visszaigényelhető */}
            <tr className="border-b border-black text-[11px] hover:bg-amber-50/40 print:text-[9.5px]">
              <td className="w-8 sm:w-9 border-r border-b border-black text-center font-mono font-bold p-1 print:py-[1.5px]">
                85.
              </td>
              <td className="border-r border-b border-black p-1.5 font-medium print:py-[1.5px] print:px-1">
                Visszaigényelhető adó összege (a negatív előjelű 83. sor, ha visszaigénylésre egyébként jogosult)
              </td>
              <td className="w-28 sm:w-36 border-r border-b border-black p-1 bg-neutral-100/80 print:bg-transparent"></td>
              <td className="w-28 sm:w-36 border-r border-b border-black p-1 text-right font-mono text-[12px] font-bold text-emerald-700 relative print:py-[1.5px]">
                <div className="flex items-center justify-end h-full px-1">
                  <span>{row85 ? Math.round(row85).toLocaleString('hu-HU') : ''}</span>
                  <span className="text-[7px] text-neutral-400 absolute bottom-0.5 right-1">ezer</span>
                </div>
              </td>
              <td className="w-8 sm:w-9 border-b border-black text-center font-mono font-bold p-1 print:py-[1.5px]">85.</td>
            </tr>

            {/* 86. sor: Átvihető követelés */}
            <tr className="border-b border-black text-[11px] hover:bg-amber-50/40 print:text-[9.5px]">
              <td className="w-8 sm:w-9 border-r border-b border-black text-center font-mono font-bold p-1 print:py-[1.5px]">
                86.
              </td>
              <td className="border-r border-b border-black p-1.5 print:py-[1.5px] print:px-1">
                Következő időszakra átvihető követelés összege
              </td>
              <td className="w-28 sm:w-36 border-r border-b border-black p-1 bg-neutral-100/80 print:bg-transparent"></td>
              <td className="w-28 sm:w-36 border-r border-b border-black p-1 text-right font-mono text-[12px] font-bold relative print:py-[1.5px]">
                <div className="flex items-center justify-end h-full px-1">
                  <span>{row86 ? Math.round(row86).toLocaleString('hu-HU') : ''}</span>
                  <span className="text-[7px] text-neutral-400 absolute bottom-0.5 right-1">ezer</span>
                </div>
              </td>
              <td className="w-8 sm:w-9 border-b border-black text-center font-mono font-bold p-1 print:py-[1.5px]">86.</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 3. SECTION: Részletező adatok (88 - 95) */}
      <div className="border border-neutral-900">
        <div className="bg-neutral-100 border-b border-neutral-900 px-3 py-1 text-[10px] font-bold uppercase text-neutral-800 text-center">
          A bevallás részletező adatai
        </div>

        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-neutral-900 bg-neutral-100 text-[9px] font-bold text-neutral-800 text-center uppercase tracking-tight">
              <th className="w-9 border-r border-neutral-900 p-1"></th>
              <th className="border-r border-neutral-900 p-1 font-sans">a</th>
              <th className="w-48 sm:w-64 border-r border-neutral-900 p-1">
                Számított ellenérték (b)
              </th>
              <th className="w-9 p-1"></th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-neutral-900 text-[11px] hover:bg-amber-50/40">
              <td className="w-9 border-r border-neutral-900 text-center font-mono font-bold p-1">88.</td>
              <td className="border-r border-neutral-900 p-1.5">
                Közösségen belüli ún. "háromszögügyletben" közbenső vevőként továbbértékesítési célból beszerzett termékek adó nélkül számított értéke
              </td>
              <td className="w-48 sm:w-64 border-r border-neutral-900 p-1 text-right font-mono font-bold pr-2">
                {getVal('88', 'base') ? Math.round(getVal('88', 'base')).toLocaleString('hu-HU') : ''}
              </td>
              <td className="w-9 text-center font-mono font-bold p-1">88.</td>
            </tr>
            <tr className="border-b border-neutral-900 text-[11px] hover:bg-amber-50/40">
              <td className="w-9 border-r border-neutral-900 text-center font-mono font-bold p-1">90.</td>
              <td className="border-r border-neutral-900 p-1.5">
                Az Áfa tv. területi hatályán kívül teljesített termékértékesítések adó nélkül számított ellenértéke
              </td>
              <td className="w-48 sm:w-64 border-r border-neutral-900 p-1 text-right font-mono font-bold pr-2">
                {getVal('90', 'base') ? Math.round(getVal('90', 'base')).toLocaleString('hu-HU') : ''}
              </td>
              <td className="w-9 text-center font-mono font-bold p-1">90.</td>
            </tr>
            <tr className="border-b border-neutral-900 text-[11px] hover:bg-amber-50/40">
              <td className="w-9 border-r border-neutral-900 text-center font-mono font-bold p-1">91.</td>
              <td className="border-r border-neutral-900 p-1.5">
                Az Áfa tv. területi hatályán kívül teljesített szolgáltatásnyújtások adó nélkül számított ellenértéke (SZOLGÁLTATÁSOK)
              </td>
              <td className="w-48 sm:w-64 border-r border-neutral-900 p-1 text-right font-mono font-bold pr-2">
                {getVal('91', 'base') ? Math.round(getVal('91', 'base')).toLocaleString('hu-HU') : ''}
              </td>
              <td className="w-9 text-center font-mono font-bold p-1">91.</td>
            </tr>
            <tr className="text-[11px] hover:bg-amber-50/40">
              <td className="w-9 border-r border-neutral-900 text-center font-mono font-bold p-1">92.</td>
              <td className="border-r border-neutral-900 p-1.5">
                Az Áfa tv. területi hatályán kívül, közösségi adóalany felé teljesített, az áfa tv. 37. § (1) bekezdése alá tartozó szolgáltatásnyújtás adó nélkül számított ellenértéke a 91. sor összegéből
              </td>
              <td className="w-48 sm:w-64 border-r border-neutral-900 p-1 text-right font-mono font-bold pr-2">
                {getVal('92', 'base') ? Math.round(getVal('92', 'base')).toLocaleString('hu-HU') : ''}
              </td>
              <td className="w-9 text-center font-mono font-bold p-1">92.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
