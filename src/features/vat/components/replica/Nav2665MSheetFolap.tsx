import React from 'react';
import { cn } from '@/lib/utils';
import { Nav2665CoatOfArms } from './Nav2665CoatOfArms';
import { Nav2665CharBox, Nav2665TaxNumberBoxes } from './Nav2665CharBox';
import { Nav65MPartnerSheetData } from '../../utils/nav65MPaginationHelper';

export interface Nav2665MSheetFolapProps {
  sheetData: Nav65MPartnerSheetData;
  className?: string;
}

/**
 * Authentic NAV 2665M Főlap (Partner summary sheet) Digital Replica.
 * Conforms 100% to the official Hungarian ÁNYK 2665M layout.
 */
export function Nav2665MSheetFolap({ sheetData, className }: Nav2665MSheetFolapProps) {
  const [{ currentDate, currentTime }] = React.useState(() => {
    const d = new Date();
    return {
      currentDate: d.toISOString().slice(0, 10).replace(/-/g, '.'),
      currentTime: d.toTimeString().slice(0, 8),
    };
  });
  const formYear = String(sheetData.periodYear).slice(-2);
  const formCode = `${formYear}65M`;

  const { folap } = sheetData;

  const formatEft = (val: number) => {
    if (val === 0) return '';
    return val.toLocaleString('hu-HU');
  };

  return (
    <div
      className={cn(
        'nav2665-folap-frame w-full max-w-[880px] mx-auto bg-white text-neutral-900 border-2 border-black shadow-xl print:shadow-none print:border-black p-4 sm:p-6 relative font-sans transition-all print:max-w-none print:w-full print:p-2 print:m-0 my-4 select-text',
        className
      )}
      style={{
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
      }}
    >
      {/* 1. Header Block with Coat of Arms & Form Title */}
      <div className="border-2 border-black flex items-stretch mb-3 print:mb-2">
        <div className="border-r-2 border-black p-2 sm:p-3 flex items-center justify-center shrink-0 w-24 sm:w-28 bg-neutral-50/50">
          <Nav2665CoatOfArms className="w-12 h-14 sm:w-14 sm:h-16" />
        </div>
        <div className="border-r-2 border-black p-2 sm:p-3 flex items-center justify-center shrink-0 w-28 sm:w-36 bg-neutral-100/50">
          <span className="font-mono font-black text-2xl sm:text-3xl tracking-tight text-neutral-950">
            {formCode}
          </span>
        </div>
        <div className="p-2 sm:p-3 flex flex-col justify-center grow text-center">
          <h1 className="font-serif font-black text-sm sm:text-base uppercase tracking-tight text-neutral-950 leading-tight">
            ÖSSZESÍTŐ JELENTÉS
            <br />
            KERESKEDELMI PARTNERENKÉNT
          </h1>
          <p className="text-[10px] sm:text-[11px] text-neutral-700 font-medium mt-1 leading-tight">
            a belföldi, egyenes adózás alá tartozó forgalom számlánként részletezett tételeiről
          </p>
        </div>
      </div>

      {/* 2. Identification Block: A (Adózó) & B (Partner) */}
      <div className="border-2 border-black mb-3 print:mb-2 flex items-stretch">
        {/* Left vertical label */}
        <div className="border-r-2 border-black w-7 sm:w-8 shrink-0 flex flex-col items-center justify-center bg-neutral-100 font-bold text-[9px] sm:text-[10px] tracking-wider select-none text-neutral-700 py-2">
          <span>A</span>
          <span>Z</span>
          <span>O</span>
          <span>N</span>
          <span>O</span>
          <span>S</span>
          <span>Í</span>
          <span>T</span>
          <span>Á</span>
          <span>S</span>
          <span className="mt-1">(B)</span>
        </div>

        {/* Right content: A) and B) sections */}
        <div className="grow p-2 sm:p-3 space-y-3">
          {/* A) BEVALLÁST BENYÚJTÓ ADÓZÓ ADATAI */}
          <div className="space-y-1.5">
            <div className="text-[10px] sm:text-[11px] font-black uppercase text-neutral-950 flex items-center gap-1">
              <span>A)</span>
              <span>BEVALLÁST BENYÚJTÓ ADÓZÓ ADATAI</span>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <div>
                <span className="text-[9px] text-neutral-600 block mb-0.5">
                  Adózó adószáma / csoportazonosító száma
                </span>
                <Nav2665TaxNumberBoxes
                  taxNumber={sheetData.companyTaxNumber}
                  compact
                  boxClassName="w-[15px] h-[19px] sm:w-[17px] sm:h-[21px] text-[11px]"
                />
              </div>

              <div>
                <span className="text-[9px] text-neutral-600 block mb-0.5">
                  Adózó adóazonosító jele
                </span>
                <Nav2665CharBox
                  value=""
                  length={10}
                  compact
                  boxClassName="w-[14px] h-[19px] sm:w-[16px] sm:h-[21px] text-[11px]"
                />
              </div>

              <div>
                <span className="text-[9px] text-neutral-600 block mb-0.5">
                  Jogelőd adószáma
                </span>
                <div className="inline-flex items-center gap-0.5 select-none">
                  <Nav2665CharBox value="" length={8} compact boxClassName="w-[13px] h-[19px] text-[10px]" />
                  <span className="text-[10px] font-bold">-</span>
                  <Nav2665CharBox value="" length={1} compact boxClassName="w-[13px] h-[19px] text-[10px]" />
                  <span className="text-[10px] font-bold">-</span>
                  <Nav2665CharBox value="" length={2} compact boxClassName="w-[13px] h-[19px] text-[10px]" />
                </div>
              </div>
            </div>

            <div className="flex items-baseline gap-2 pt-0.5">
              <span className="text-[10px] font-medium text-neutral-700 shrink-0">Adózó neve:</span>
              <div className="grow border-b border-neutral-900 pb-0.5 font-bold text-xs sm:text-sm text-neutral-950 uppercase truncate px-1">
                {sheetData.companyName}
              </div>
            </div>
          </div>

          <div className="border-t border-neutral-300 pt-2" />

          {/* B) KERESKEDELMI PARTNER ADATAI */}
          <div className="space-y-1.5">
            <div className="text-[10px] sm:text-[11px] font-black uppercase text-neutral-950 flex items-center gap-1">
              <span>B)</span>
              <span>KERESKEDELMI PARTNER ADATAI</span>
            </div>

            <div>
              <span className="text-[9px] text-neutral-600 block mb-0.5">
                Partner adószáma / Partner csoportazonosító száma
              </span>
              <Nav2665CharBox
                value={sheetData.partnerTax8}
                length={8}
                compact
                boxClassName="w-[16px] h-[20px] sm:w-[18px] sm:h-[22px] text-[12px] font-bold"
              />
            </div>

            <div className="flex items-baseline gap-2 pt-0.5">
              <span className="text-[10px] font-medium text-neutral-700 shrink-0">Partner neve:</span>
              <div className="grow border-b border-neutral-900 pb-0.5 font-bold text-xs sm:text-sm text-neutral-950 truncate px-1">
                {sheetData.partnerName}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Box C: Period block */}
      <div className="border-2 border-black p-2 sm:p-2.5 mb-3 print:mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-bold text-[10px] sm:text-[11px] text-neutral-900">
            (C) Bevallási időszak:
          </span>
          <div className="flex items-center gap-1 font-mono text-xs">
            <Nav2665CharBox value={sheetData.periodFromYear} length={4} compact boxClassName="w-[13px] h-[18px] text-[10px]" />
            <span className="text-[9px] text-neutral-600 font-sans">év</span>
            <Nav2665CharBox value={sheetData.periodFromMonth} length={2} compact boxClassName="w-[13px] h-[18px] text-[10px]" />
            <span className="text-[9px] text-neutral-600 font-sans">hó</span>
            <Nav2665CharBox value={sheetData.periodFromDay} length={2} compact boxClassName="w-[13px] h-[18px] text-[10px]" />
            <span className="text-[9px] text-neutral-600 font-sans mr-2">naptól</span>

            <span className="font-bold mr-1">-</span>

            <Nav2665CharBox value={sheetData.periodToYear} length={4} compact boxClassName="w-[13px] h-[18px] text-[10px]" />
            <span className="text-[9px] text-neutral-600 font-sans">év</span>
            <Nav2665CharBox value={sheetData.periodToMonth} length={2} compact boxClassName="w-[13px] h-[18px] text-[10px]" />
            <span className="text-[9px] text-neutral-600 font-sans">hó</span>
            <Nav2665CharBox value={sheetData.periodToDay} length={2} compact boxClassName="w-[13px] h-[18px] text-[10px]" />
            <span className="text-[9px] text-neutral-600 font-sans">napig</span>
          </div>
        </div>

        <div className="text-[10px] font-mono text-neutral-500">
          Összes lap ehhez a partnerhez: <strong>{sheetData.totalSheetsCount} db</strong> (1 Főlap + {sheetData.normalPages.length} db 02 + {sheetData.correctionPages.length} db 02-K)
        </div>
      </div>

      {/* 4. Attention Notice banner */}
      <div className="text-right text-[10px] sm:text-[11px] font-bold text-neutral-900 mb-1 pr-1">
        Az adatokat ezer forintban kell feltüntetni!
      </div>

      {/* 5. Main Statutory Summary Table */}
      <div className="border-2 border-black overflow-x-auto select-text">
        <table className="w-full border-collapse text-left font-sans text-xs">
          <thead>
            {/* Top spanning banner */}
            <tr className="bg-neutral-100 border-b-2 border-black">
              <th colSpan={9} className="p-1.5 text-center text-[10px] sm:text-[11px] font-bold text-neutral-900 leading-tight">
                A kereskedelmi partnerrel bonyolított belföldi
                <br className="hidden sm:inline" />
                - egyenes adózás alá tartozó, a partnerre vonatkozó részletező lapokon számlánként tételesen nyilatkozott -
                <br className="hidden sm:inline" />
                forgalom összesen
              </th>
            </tr>
            {/* Column sub-headers */}
            <tr className="border-b-2 border-black text-[9px] sm:text-[9.5px] font-bold text-neutral-800 text-center leading-tight">
              <th className="p-1 border-r border-black w-[40%] text-left">
                Termékbeszerzés / Szolgáltatás igénybevétel
                <span className="block text-[8px] font-normal text-neutral-500 text-center">a</span>
              </th>
              <th className="p-1 border-r border-black w-[8%]">
                Számla db összesen
                <span className="block text-[8px] font-normal text-neutral-500">b</span>
              </th>
              <th className="p-1 border-r border-black w-[13%]">
                Az adó alapja (tényleges v. helyesbített)
                <span className="block text-[8px] font-normal text-neutral-500">c (ezer)</span>
              </th>
              <th className="p-1 border-r border-black w-[13%]">
                Az adó összege (tényleges v. helyesbített)
                <span className="block text-[8px] font-normal text-neutral-500">d (ezer)</span>
              </th>
              <th colSpan={4} className="p-1 border-r border-black w-[22%]">
                Levonásba helyezett adó
                <div className="grid grid-cols-4 border-t border-neutral-400 mt-0.5 text-[8px] font-normal">
                  <span className="border-r border-neutral-300">5% (e1)</span>
                  <span className="border-r border-neutral-300">18% (e2)</span>
                  <span className="border-r border-neutral-300">27% (e3)</span>
                  <span>arányos. (e4)</span>
                </div>
              </th>
              <th className="p-1 w-[4%] text-center">Sor</th>
            </tr>
          </thead>
          <tbody className="divide-y border-black font-mono text-[10px] sm:text-[11px]">
            {/* Row 04 */}
            <tr className="hover:bg-neutral-50/80">
              <td className="p-1.5 border-r border-black font-sans text-[9px] sm:text-[10px] leading-tight text-neutral-900">
                <strong>Termékbeszerzés / szolgáltatás igénybevétel</strong> számlatételeinek összege összesen
                <span className="block text-[8px] text-neutral-600 font-mono mt-0.5">
                  2665M-02. lap 37. &quot;Összesen&quot; sor adóalap és adó összegeinek - c), d) és f1 - f4) oszlopok - együttes adata
                </span>
              </td>
              <td className="p-1 border-r border-black text-right font-bold tabular-nums">
                {folap.row04.invoiceCount || ''}
              </td>
              <td className="p-1 border-r border-black text-right font-bold tabular-nums">
                {formatEft(folap.row04.baseEft)}
              </td>
              <td className="p-1 border-r border-black text-right font-bold tabular-nums">
                {formatEft(folap.row04.taxEft)}
              </td>
              <td className="p-0.5 border-r border-neutral-300 text-right tabular-nums text-[9.5px]">
                {formatEft(folap.row04.vat5Eft)}
              </td>
              <td className="p-0.5 border-r border-neutral-300 text-right tabular-nums text-[9.5px]">
                {formatEft(folap.row04.vat18Eft)}
              </td>
              <td className="p-0.5 border-r border-neutral-300 text-right tabular-nums text-[9.5px]">
                {formatEft(folap.row04.vat27Eft)}
              </td>
              <td className="p-0.5 border-r border-black text-right tabular-nums text-[9.5px]">
                {formatEft(folap.row04.proRataEft)}
              </td>
              <td className="p-1 text-center font-bold text-neutral-900 bg-neutral-100 font-sans text-[10px]">
                04.
              </td>
            </tr>

            {/* Row 05 */}
            <tr className="hover:bg-neutral-50/80">
              <td className="p-1.5 border-r border-black font-sans text-[9px] sm:text-[10px] leading-tight text-neutral-900">
                <strong>Módosító lap - Termékbeszerzés / szolgáltatás igénybevétel</strong> tételes részletezett korrekcióinak összege összesen
                <span className="block text-[8px] text-neutral-600 font-mono mt-0.5">
                  2665M-02-K. lap 37. &quot;Összesen&quot; sor adóalap és adó összegeinek - f), g) és h1) - h4) oszlopok - együttes adata
                </span>
              </td>
              <td className="p-1 border-r border-black text-right font-bold tabular-nums">
                {folap.row05.invoiceCount || ''}
              </td>
              <td className="p-1 border-r border-black text-right font-bold tabular-nums">
                {formatEft(folap.row05.baseEft)}
              </td>
              <td className="p-1 border-r border-black text-right font-bold tabular-nums">
                {formatEft(folap.row05.taxEft)}
              </td>
              <td className="p-0.5 border-r border-neutral-300 text-right tabular-nums text-[9.5px]">
                {formatEft(folap.row05.vat5Eft)}
              </td>
              <td className="p-0.5 border-r border-neutral-300 text-right tabular-nums text-[9.5px]">
                {formatEft(folap.row05.vat18Eft)}
              </td>
              <td className="p-0.5 border-r border-neutral-300 text-right tabular-nums text-[9.5px]">
                {formatEft(folap.row05.vat27Eft)}
              </td>
              <td className="p-0.5 border-r border-black text-right tabular-nums text-[9.5px]">
                {formatEft(folap.row05.proRataEft)}
              </td>
              <td className="p-1 text-center font-bold text-neutral-900 bg-neutral-100 font-sans text-[10px]">
                05.
              </td>
            </tr>

            {/* Row 07: Total row */}
            <tr className="bg-neutral-100/90 font-black border-t-2 border-black">
              <td className="p-1.5 border-r border-black font-sans text-[10px] text-neutral-950">
                07. A 04., 05. sorok adatai összesen
              </td>
              <td className="p-1 border-r border-black text-right tabular-nums">
                {folap.row07.invoiceCount || ''}
              </td>
              <td className="p-1 border-r border-black text-right tabular-nums">
                {formatEft(folap.row07.baseEft)}
              </td>
              <td className="p-1 border-r border-black text-right tabular-nums">
                {formatEft(folap.row07.taxEft)}
              </td>
              <td className="p-0.5 border-r border-neutral-300 text-right tabular-nums text-[9.5px]">
                {formatEft(folap.row07.vat5Eft)}
              </td>
              <td className="p-0.5 border-r border-neutral-300 text-right tabular-nums text-[9.5px]">
                {formatEft(folap.row07.vat18Eft)}
              </td>
              <td className="p-0.5 border-r border-neutral-300 text-right tabular-nums text-[9.5px]">
                {formatEft(folap.row07.vat27Eft)}
              </td>
              <td className="p-0.5 border-r border-black text-right tabular-nums text-[9.5px]">
                {formatEft(folap.row07.proRataEft)}
              </td>
              <td className="p-1 text-center font-black text-neutral-950 bg-neutral-200 font-sans text-[11px]">
                07.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Official ÁNYK Footer Banner */}
      <div className="mt-8 pt-2 border-t border-black flex flex-col sm:flex-row justify-between items-start sm:items-center text-[9px] text-neutral-600 font-mono gap-1 select-none print:mt-3 print:pt-1 print:text-[8px]">
        <div>
          Ny.v.:2.0 A nyomtatvány jelen kitöltöttség mellett papír alapon nem küldhető be!
        </div>
        <div className="tabular-nums">
          Nyomtatva: {currentDate} {currentTime}
        </div>
      </div>
    </div>
  );
}
