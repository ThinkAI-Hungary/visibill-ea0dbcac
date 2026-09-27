import React from 'react';
import { Nav2665TableRow } from './Nav2665TableRow';

interface Nav2665Sheet0102Props {
  getVal: (row: string, col: 'base' | 'tax') => number;
}

/**
 * 2665A-01-02 lap: Tájékoztató adatok (37 - 62) és Levonható ÁFA (63 - 71. sorok).
 */
export function Nav2665Sheet0102({ getVal }: Nav2665Sheet0102Props) {
  const row66FadTax = getVal('66_fad', 'tax') || getVal('29', 'tax');

  return (
    <div className="border border-neutral-900 bg-white select-text">
      {/* Subheader */}
      <div className="bg-neutral-100 border-b border-neutral-900 px-3 py-1 flex justify-between items-center text-[10px] font-bold">
        <span className="uppercase text-neutral-800">Tájékoztató adatok és Levonható ÁFA</span>
        <span className="text-neutral-500 font-normal italic">
          Az adatokat ezer forintban kell feltüntetni!
        </span>
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-neutral-900 bg-neutral-100 text-[9px] font-bold text-neutral-800 text-center uppercase tracking-tight">
            <th className="w-9 border-r border-neutral-900 p-1"></th>
            <th className="border-r border-neutral-900 p-1 font-sans">a</th>
            <th className="w-32 sm:w-36 border-r border-neutral-900 p-1">
              <div>Az adó alapja</div>
              <div className="text-[8px] font-normal text-neutral-500 italic lowercase">
                (tényleges vagy helyesbített)
              </div>
            </th>
            <th className="w-32 sm:w-36 border-r border-neutral-900 p-1">
              <div>Az adó összege</div>
              <div className="text-[8px] font-normal text-neutral-500 italic lowercase">
                (tényleges vagy helyesbített)
              </div>
            </th>
            <th className="w-9 p-1"></th>
          </tr>
        </thead>
        <tbody>
          {/* Tájékoztató adatok sorok */}
          <Nav2665TableRow
            rowNum="37"
            title="Az Áfa tv. 98. §-a szerinti termékexport ellenértéke a 01. sorból"
            baseVal={getVal('37', 'base')}
            hasTax={false}
          />
          <Nav2665TableRow
            rowNum="43"
            title="Tárgyieszköz-értékesítés a 36. sor összegéből (apport nélkül)"
            baseVal={getVal('43', 'base')}
            hasTax={false}
          />
          <Nav2665TableRow
            rowNum="45"
            title="Előleg címén kapott összeg a 05-07. és a 110. sorok összegéből"
            baseVal={getVal('45', 'base')}
            hasTax={false}
          />
          <Nav2665TableRow
            rowNum="46"
            title="Előleg címén kapott összeg a 01. és 04. sorok összegéből"
            baseVal={getVal('46', 'base')}
            hasTax={false}
          />
          <Nav2665TableRow
            rowNum="51"
            title="A fordított adózás szabályai szerint ingatlan után fizetendő adó a 29. sor összegéből"
            hasBase={false}
            taxVal={getVal('51', 'tax')}
          />
          <Nav2665TableRow
            rowNum="52"
            title="A fordított adózás szabályai szerint hulladék után fizetendő adó a 29. sor összegéből"
            hasBase={false}
            taxVal={getVal('52', 'tax')}
          />
          <Nav2665TableRow
            rowNum="53"
            title="A fordított adózás szabályai szerint az üvegházhatású gáz kibocsátására jogosító vagyoni értékű jog átruházása után fizetendő adó a 29. sor összegéből"
            hasBase={false}
            taxVal={getVal('53', 'tax')}
          />
          <Nav2665TableRow
            rowNum="54"
            title="Az Áfa tv. 142. §-ban meghatározott fordított adózás szabályai szerinti szolgáltatás igénybevétele esetén fizetendő adó a 29. sor összegéből"
            hasBase={false}
            taxVal={getVal('54', 'tax')}
          />

          {/* Szekció cím: Levonható adó */}
          <tr className="border-t-2 border-b-2 border-neutral-900 bg-neutral-100">
            <td colSpan={5} className="p-1.5 font-bold text-[10px] uppercase text-neutral-800 tracking-wide text-center">
              Beszerzést terhelő, előzetesen felszámított, levonható általános forgalmi adó
            </td>
          </tr>

          <Nav2665TableRow
            rowNum="63"
            title="Adómentes belföldi termékbeszerzés adóalapja"
            baseVal={getVal('63', 'base')}
            hasTax={false}
          />
          <Nav2665TableRow
            rowNum="111"
            title="0 %-os kulcs alá tartozó belföldi termékbeszerzés, szolgáltatás után"
            baseVal={getVal('111', 'base')}
            hasTax={false}
          />
          <Nav2665TableRow
            rowNum="64"
            title="5 %-os kulcs alá tartozó belföldi termékbeszerzés, szolgáltatás után"
            baseVal={getVal('64', 'base')}
            taxVal={getVal('64', 'tax')}
          />
          <Nav2665TableRow
            rowNum="65"
            title="18 %-os kulcs alá tartozó belföldi termékbeszerzés, szolgáltatás után"
            baseVal={getVal('65', 'base')}
            taxVal={getVal('65', 'tax')}
          />

          {/* 66. sor: 27 %-os kulcs + mellette FAD doboz, mint a minta PDF-ben */}
          <tr className="border-b border-neutral-900 text-[11px] leading-tight select-none bg-white transition-colors hover:bg-amber-50/40">
            <td className="w-9 border-r border-neutral-900 text-center font-mono text-[11px] font-bold text-neutral-900 p-1">
              66.
            </td>
            <td className="border-r border-neutral-900 p-1.5 text-neutral-900 font-sans">
              <div className="flex flex-col gap-1">
                <span className="font-bold text-[11px]">
                  27 %-os kulcs alá tartozó belföldi termékbeszerzés, szolgáltatás után
                </span>
                <div className="flex items-center gap-2 pt-1 border-t border-neutral-200 text-[10px]">
                  <span className="text-neutral-600 font-medium">
                    fordított adózás alá eső ügylet után levont adó:
                  </span>
                  <div className="border border-neutral-900 bg-neutral-50 px-2 py-0.5 font-mono font-bold text-xs">
                    {row66FadTax ? Math.round(row66FadTax).toLocaleString('hu-HU') : ''}
                  </div>
                  <span className="text-[8px] text-neutral-400">ezer</span>
                </div>
              </div>
            </td>
            <td className="w-32 sm:w-36 border-r border-neutral-900 p-1 text-right font-mono text-[12px] tabular-nums relative">
              <div className="flex items-center justify-end h-full px-1">
                <span className="font-bold text-neutral-900">
                  {getVal('66', 'base') ? Math.round(getVal('66', 'base')).toLocaleString('hu-HU') : ''}
                </span>
                <span className="text-[7px] text-neutral-400 absolute bottom-0.5 right-1 select-none">ezer</span>
              </div>
            </td>
            <td className="w-32 sm:w-36 border-r border-neutral-900 p-1 text-right font-mono text-[12px] tabular-nums relative">
              <div className="flex items-center justify-end h-full px-1">
                <span className="font-bold text-neutral-900">
                  {getVal('66', 'tax') ? Math.round(getVal('66', 'tax')).toLocaleString('hu-HU') : ''}
                </span>
                <span className="text-[7px] text-neutral-400 absolute bottom-0.5 right-1 select-none">ezer</span>
              </div>
            </td>
            <td className="w-9 text-center font-mono text-[11px] font-bold text-neutral-900 p-1">
              66.
            </td>
          </tr>

          <Nav2665TableRow
            rowNum="67"
            title="Harmadik országbeli és közösségi adóalanytól igénybe vett szolgáltatás után, illetve terméket saját nevében beszerzőként fizetett adóból levonható összeg"
            baseVal={getVal('67', 'base')}
            taxVal={getVal('67', 'tax')}
          />
          <Nav2665TableRow
            rowNum="68"
            title="Arányosítás alkalmazásával levonható adórész (Eredeti adóalap, arányosított adó)"
            baseVal={getVal('68', 'base')}
            taxVal={getVal('68', 'tax')}
          />
          <Nav2665TableRow
            rowNum="69"
            title="Közösségen belüli termékbeszerzés után levonható adó összege"
            hasBase={false}
            taxVal={getVal('69', 'tax')}
          />
          <Nav2665TableRow
            rowNum="70"
            title="Importált termék után (kivetéssel) megfizetett adó levonható része"
            hasBase={false}
            taxVal={getVal('70', 'tax')}
          />
          <Nav2665TableRow
            rowNum="71"
            title="Importált termék után (önadózással) megfizetett adó levonható része"
            hasBase={false}
            taxVal={getVal('71', 'tax')}
          />
        </tbody>
      </table>
    </div>
  );
}
