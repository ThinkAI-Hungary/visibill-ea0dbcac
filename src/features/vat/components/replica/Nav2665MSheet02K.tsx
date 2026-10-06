import React from 'react';
import { cn } from '@/lib/utils';
import { Nav2665CharBox, Nav2665TaxNumberBoxes } from './Nav2665CharBox';
import { Nav65MPartnerSheetData, Nav65M02KPageData } from '../../utils/nav65MPaginationHelper';

export interface Nav2665MSheet02KProps {
  sheetData: Nav65MPartnerSheetData;
  pageData: Nav65M02KPageData;
  className?: string;
}

/**
 * Authentic NAV 2665M-02-K Módosító Lap Digital Replica.
 * Renders correction and storno invoices with official E (original) and KT (current period modification)
 * row pairings, negative numbers for storno deductions, and 37. row page totals in HUF.
 */
export function Nav2665MSheet02K({ sheetData, pageData, className }: Nav2665MSheet02KProps) {
  const [{ currentDate, currentTime }] = React.useState(() => {
    const d = new Date();
    return {
      currentDate: d.toISOString().slice(0, 10).replace(/-/g, '.'),
      currentTime: d.toTimeString().slice(0, 8),
    };
  });

  const formYear = String(sheetData.periodYear).slice(-2);
  const formCode = `${formYear}65M-02-K`;

  const formatHuf = (val: number, showSign = false) => {
    if (val === 0) return '';
    if (showSign && val > 0) return `+${val.toLocaleString('hu-HU')}`;
    return val.toLocaleString('hu-HU');
  };

  // Build a fixed 36-row array matching official 36 rows
  const rows = Array.from({ length: 36 }, (_, idx) => {
    const rowNum = idx + 1;
    const item = pageData.items.find((it) => it.rowNumber === rowNum);
    return { rowNum, item };
  });

  return (
    <div
      className={cn(
        'nav2665-sheet02k-frame w-full max-w-[880px] mx-auto bg-white text-neutral-900 border-2 border-black shadow-xl print:shadow-none print:border-black p-3 sm:p-5 relative font-sans transition-all print:max-w-none print:w-full print:p-1.5 print:m-0 my-4 select-text',
        className
      )}
      style={{
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
      }}
    >
      {/* 1. Header Row: Form Code, MÓDOSÍTÓ LAP, Lapszám */}
      <div className="flex justify-between items-center border-b-2 border-black pb-2 mb-2 print:pb-1 print:mb-1">
        <div>
          <span className="font-mono font-black text-2xl sm:text-3xl tracking-tight text-neutral-950">
            {formCode}
          </span>
        </div>

        <div className="text-center">
          <span className="font-serif font-black text-sm sm:text-base uppercase tracking-wider text-neutral-950 border-2 border-black px-3 py-0.5 bg-neutral-100">
            MÓDOSÍTÓ LAP
          </span>
        </div>

        <div className="flex items-center gap-1.5 border-2 border-black px-2 py-0.5 bg-neutral-50 text-xs font-mono font-bold">
          <span className="text-[10px] uppercase font-sans text-neutral-600">Lapszám</span>
          <div className="flex items-center gap-1">
            <span className="w-6 h-5 border border-black flex items-center justify-center bg-white text-xs font-black">
              {pageData.pageNumber}
            </span>
            <span className="text-neutral-400 font-normal">/</span>
            <span className="text-neutral-600 text-[11px] font-normal">
              {pageData.totalPages}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Identification Block */}
      <div className="border border-neutral-900 p-2 sm:p-2.5 mb-2.5 print:mb-1.5 space-y-1.5 bg-neutral-50/40">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
          <div>
            <span className="text-[9px] text-neutral-600 block leading-tight">
              Adózó adószáma / csoportazonosító száma
            </span>
            <Nav2665TaxNumberBoxes
              taxNumber={sheetData.companyTaxNumber}
              compact
              boxClassName="w-[14px] h-[18px] text-[10px]"
            />
          </div>

          <div>
            <span className="text-[9px] text-neutral-600 block leading-tight">
              Adózó adóazonosító jele
            </span>
            <Nav2665CharBox
              value=""
              length={10}
              compact
              boxClassName="w-[13px] h-[18px] text-[10px]"
            />
          </div>

          <div>
            <span className="text-[9px] text-neutral-600 block leading-tight">
              Partner adószáma / Partner csoportazonosító száma
            </span>
            <Nav2665CharBox
              value={sheetData.partnerTax8}
              length={8}
              compact
              boxClassName="w-[14px] h-[18px] text-[10px] font-bold"
            />
          </div>
        </div>

        <div className="flex items-baseline gap-2 pt-0.5">
          <span className="text-[10px] font-medium text-neutral-700 shrink-0">Partner neve:</span>
          <div className="grow border-b border-neutral-800 pb-0.5 font-bold text-xs sm:text-sm text-neutral-950 truncate px-1">
            {sheetData.partnerName}
          </div>
        </div>
      </div>

      {/* 3. Title & Notice */}
      <div className="text-center my-1 print:my-0.5">
        <h2 className="font-sans font-bold text-xs sm:text-[13px] uppercase tracking-tight text-neutral-950 leading-tight">
          Partnerrel bonyolított belföldi, egyenes adózás alá tartozó
          <br />
          termékbeszerzés / szolgáltatás igénybevétel korrekcióinak tételes részletezése
        </h2>
      </div>

      <div className="text-right text-[9.5px] sm:text-[10px] font-bold text-neutral-900 mb-1 pr-1">
        Az adatokat forintban kell feltüntetni!
      </div>

      {/* 4. 36-Row Authentic ÁNYK Grid Table */}
      <div className="border-2 border-black overflow-x-auto select-text">
        <table className="w-full border-collapse text-left font-sans text-xs">
          <thead>
            <tr className="bg-neutral-100 border-b-2 border-black text-[8px] sm:text-[8.5px] font-bold text-neutral-900 text-center leading-tight">
              <th className="p-0.5 border-r border-black w-[4%] text-center">Ssz.</th>
              <th className="p-0.5 border-r border-black w-[17%] text-center">
                Számla sorszáma
                <span className="block text-[7px] font-normal text-neutral-500">(a)</span>
              </th>
              <th className="p-0.5 border-r border-black w-[5%] text-center">
                Szla típ.
                <span className="block text-[7px] font-normal text-neutral-500">(b)</span>
              </th>
              <th className="p-0.5 border-r border-black w-[17%] text-center">
                Előzmény számla sorszáma
                <span className="block text-[7px] font-normal text-neutral-500">(c)</span>
              </th>
              <th className="p-0.5 border-r border-black w-[11%] text-center">
                Számla kibocs. kelte
                <span className="block text-[7px] font-normal text-neutral-500">(d)</span>
              </th>
              <th className="p-0.5 border-r border-black w-[11%] text-center">
                Teljesítés dátuma
                <span className="block text-[7px] font-normal text-neutral-500">(e)</span>
              </th>
              <th className="p-0.5 border-r border-black w-[10%] text-center">
                Adóalap
                <span className="block text-[7px] font-normal text-neutral-500">(f)</span>
              </th>
              <th className="p-0.5 border-r border-black w-[10%] text-center">
                Adó
                <span className="block text-[7px] font-normal text-neutral-500">(g)</span>
              </th>
              <th colSpan={4} className="p-0.5 border-r border-black w-[21%] text-center">
                Levonásba helyezett adó, változása
                <span className="block text-[6.5px] font-normal text-neutral-500">(Önkéntesen tölthető)</span>
                <div className="grid grid-cols-4 border-t border-neutral-300 mt-0.5 text-[7px] font-normal">
                  <span className="border-r border-neutral-300">5% (h1)</span>
                  <span className="border-r border-neutral-300">18% (h2)</span>
                  <span className="border-r border-neutral-300">27% (h3)</span>
                  <span>arány. (h4)</span>
                </div>
              </th>
              <th className="p-0.5 w-[4%] text-center">Ssz.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 border-black font-mono text-[8.5px] sm:text-[9px]">
            {rows.map(({ rowNum, item }) => {
              const rowStr = String(rowNum).padStart(2, '0');
              const isE = item?.rowType === 'E';
              const isKT = item?.rowType === 'KT';
              const isNegative = (item?.baseAmountHuf || 0) < 0 || (item?.taxAmountHuf || 0) < 0;

              return (
                <tr
                  key={rowNum}
                  className={cn(
                    'h-[19px] sm:h-[21px] transition-colors',
                    isE ? 'bg-neutral-50/40 hover:bg-neutral-100/50' : isKT ? 'bg-white hover:bg-neutral-50' : 'bg-white'
                  )}
                >
                  {/* Left row number */}
                  <td className="p-0 border-r border-black text-center font-bold text-neutral-800 bg-neutral-50/50 select-none text-[8px]">
                    {rowStr}.
                  </td>

                  {/* (a) Számla sorszáma */}
                  <td className="p-0.5 px-1 border-r border-black font-sans truncate font-medium text-neutral-900 max-w-[120px]">
                    {item ? item.modInvoiceNumber : ''}
                  </td>

                  {/* (b) Szla típ. (E / KT) */}
                  <td className="p-0.5 border-r border-black text-center font-sans">
                    {item ? (
                      <span
                        className={cn(
                          'px-1 py-0.2 rounded font-black text-[8px] uppercase',
                          isE ? 'bg-neutral-200 text-neutral-800' : 'bg-amber-100 text-amber-900 border border-amber-300'
                        )}
                      >
                        {item.rowType}
                      </span>
                    ) : (
                      ''
                    )}
                  </td>

                  {/* (c) Előzmény számla sorszáma */}
                  <td className="p-0.5 px-1 border-r border-black font-sans truncate text-neutral-700 max-w-[120px]">
                    {item ? item.originalInvoiceNumber : ''}
                  </td>

                  {/* (d) Számla kibocs kelte */}
                  <td className="p-0.5 border-r border-black text-center font-sans text-[8px] text-neutral-800">
                    {item ? item.issueDateFormatted : ''}
                  </td>

                  {/* (e) Teljesítés dátuma */}
                  <td className="p-0.5 border-r border-black text-center font-sans text-[8px] text-neutral-800">
                    {item ? item.fulfillmentDateFormatted : ''}
                  </td>

                  {/* (f) Adóalap */}
                  <td
                    className={cn(
                      'p-0.5 px-1 border-r border-black text-right font-medium tabular-nums',
                      isNegative ? 'text-rose-700 font-bold' : 'text-neutral-900'
                    )}
                  >
                    {item ? formatHuf(item.baseAmountHuf) : <span className="text-[7px] text-neutral-300 font-sans select-none">forint</span>}
                  </td>

                  {/* (g) Adó */}
                  <td
                    className={cn(
                      'p-0.5 px-1 border-r border-black text-right font-medium tabular-nums',
                      isNegative ? 'text-rose-700 font-bold' : 'text-neutral-900'
                    )}
                  >
                    {item ? formatHuf(item.taxAmountHuf) : <span className="text-[7px] text-neutral-300 font-sans select-none">forint</span>}
                  </td>

                  {/* (h1) 5% */}
                  <td className="p-0.5 border-r border-neutral-300 text-right tabular-nums text-[8px]">
                    {item && item.vat5Huf ? formatHuf(item.vat5Huf) : ''}
                  </td>

                  {/* (h2) 18% */}
                  <td className="p-0.5 border-r border-neutral-300 text-right tabular-nums text-[8px]">
                    {item && item.vat18Huf ? formatHuf(item.vat18Huf) : ''}
                  </td>

                  {/* (h3) 27% */}
                  <td className="p-0.5 border-r border-neutral-300 text-right tabular-nums text-[8px]">
                    {item && item.vat27Huf ? formatHuf(item.vat27Huf) : ''}
                  </td>

                  {/* (h4) arányosítás */}
                  <td className="p-0.5 border-r border-black text-right tabular-nums text-[8px]">
                    {item && item.proRataHuf ? formatHuf(item.proRataHuf) : ''}
                  </td>

                  {/* Right row number */}
                  <td className="p-0 border-l border-black text-center font-bold text-neutral-800 bg-neutral-50/50 select-none text-[8px]">
                    {rowStr}.
                  </td>
                </tr>
              );
            })}

            {/* Row 37: Összesen row */}
            <tr className="bg-neutral-100/90 font-black border-t-2 border-black h-[22px] sm:h-[24px]">
              <td className="p-0 border-r border-black text-center font-black text-neutral-900 bg-neutral-200 select-none text-[8.5px]">
                37.
              </td>
              <td colSpan={5} className="p-1 px-2 border-r border-black font-sans text-[10px] text-neutral-950 font-black">
                Összesen:
              </td>
              <td
                className={cn(
                  'p-1 border-r border-black text-right tabular-nums font-black',
                  pageData.pageBaseTotalHuf < 0 ? 'text-rose-700' : 'text-neutral-950'
                )}
              >
                {formatHuf(pageData.pageBaseTotalHuf)}
              </td>
              <td
                className={cn(
                  'p-1 border-r border-black text-right tabular-nums font-black',
                  pageData.pageTaxTotalHuf < 0 ? 'text-rose-700' : 'text-neutral-950'
                )}
              >
                {formatHuf(pageData.pageTaxTotalHuf)}
              </td>
              <td className="p-0.5 border-r border-neutral-300 text-right tabular-nums text-[8px]">
                {formatHuf(pageData.pageVat5TotalHuf)}
              </td>
              <td className="p-0.5 border-r border-neutral-300 text-right tabular-nums text-[8px]">
                {formatHuf(pageData.pageVat18TotalHuf)}
              </td>
              <td className="p-0.5 border-r border-neutral-300 text-right tabular-nums text-[8px]">
                {formatHuf(pageData.pageVat27TotalHuf)}
              </td>
              <td className="p-0.5 border-r border-black text-right tabular-nums text-[8px]">
                {formatHuf(pageData.pageProRataTotalHuf)}
              </td>
              <td className="p-0 text-center font-black text-neutral-900 bg-neutral-200 select-none text-[8.5px]">
                37.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Note under table */}
      <div className="mt-1 text-[8.5px] text-neutral-600 font-sans italic">
        A kitöltésre vonatkozó előírások az áfa-bevallás kitöltési útmutatójában találhatók.
      </div>

      {/* Official ÁNYK Footer Banner */}
      <div className="mt-4 pt-1.5 border-t border-black flex flex-col sm:flex-row justify-between items-start sm:items-center text-[8.5px] text-neutral-600 font-mono gap-1 select-none print:mt-1.5 print:pt-1 print:text-[8px]">
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
