import React from 'react';
import { cn } from '@/lib/utils';
import { Nav2665CharBox, Nav2665TaxNumberBoxes } from './Nav2665CharBox';
import { Nav65MPartnerSheetData, Nav65M02PageData } from '../../utils/nav65MPaginationHelper';

export interface Nav2665MSheet02Props {
  sheetData: Nav65MPartnerSheetData;
  pageData: Nav65M02PageData;
  className?: string;
}

/**
 * Authentic NAV 2665M-02 Digital Replica.
 * Renders the itemized list of standard domestic invoices (up to 36 rows per sheet),
 * with 37. "Összesen" row in HUF, matching page 2 of the official ÁNYK return.
 */
export function Nav2665MSheet02({ sheetData, pageData, className }: Nav2665MSheet02Props) {
  const [{ currentDate, currentTime }] = React.useState(() => {
    const d = new Date();
    return {
      currentDate: d.toISOString().slice(0, 10).replace(/-/g, '.'),
      currentTime: d.toTimeString().slice(0, 8),
    };
  });

  const formYear = String(sheetData.periodYear).slice(-2);
  const formCode = `${formYear}65M-02`;

  const formatHuf = (val: number) => {
    if (val === 0) return '';
    return val.toLocaleString('hu-HU');
  };

  // Build a fixed 36-row array so the grid matches the authentic ÁNYK 36-row page exactly
  const rows = Array.from({ length: 36 }, (_, idx) => {
    const rowNum = idx + 1;
    const item = pageData.items.find((it) => it.rowNumber === rowNum);
    return { rowNum, item };
  });

  return (
    <div
      className={cn(
        'nav2665-sheet02-frame w-full max-w-[880px] mx-auto bg-white text-neutral-900 border-2 border-black shadow-xl print:shadow-none print:border-black p-3 sm:p-5 relative font-sans transition-all print:max-w-none print:w-full print:p-1.5 print:m-0 my-4 select-text',
        className
      )}
      style={{
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
      }}
    >
      {/* 1. Header Row: Form Code & Lapszám */}
      <div className="flex justify-between items-start border-b-2 border-black pb-2 mb-2 print:pb-1 print:mb-1">
        <div>
          <span className="font-mono font-black text-2xl sm:text-3xl tracking-tight text-neutral-950">
            {formCode}
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
          termékbeszerzés / szolgáltatás igénybevétel tételes részletezése
        </h2>
      </div>

      <div className="text-right text-[9.5px] sm:text-[10px] font-bold text-neutral-900 mb-1 pr-1">
        Az adatokat forintban kell feltüntetni!
      </div>

      {/* 4. 36-Row Authentic ÁNYK Grid Table */}
      <div className="border-2 border-black overflow-x-auto select-text">
        <table className="w-full border-collapse text-left font-sans text-xs">
          <thead>
            <tr className="bg-neutral-100 border-b-2 border-black text-[8.5px] sm:text-[9px] font-bold text-neutral-900 text-center leading-tight">
              <th className="p-0.5 border-r border-black w-[4%] text-center">Ssz.</th>
              <th className="p-0.5 border-r border-black w-[23%] text-center">
                Számla sorszáma
                <span className="block text-[7.5px] font-normal text-neutral-500">(a)</span>
              </th>
              <th className="p-0.5 border-r border-black w-[15%] text-center">
                Teljesítés dátuma
                <span className="block text-[7.5px] font-normal text-neutral-500">(b)</span>
              </th>
              <th className="p-0.5 border-r border-black w-[12%] text-center">
                Adóalap
                <span className="block text-[7.5px] font-normal text-neutral-500">(c)</span>
              </th>
              <th className="p-0.5 border-r border-black w-[11%] text-center">
                Adó
                <span className="block text-[7.5px] font-normal text-neutral-500">(d)</span>
              </th>
              <th colSpan={4} className="p-0.5 border-r border-black w-[26%] text-center">
                Levonásba helyezett adó
                <span className="block text-[7px] font-normal text-neutral-500">(Önkéntesen tölthető)</span>
                <div className="grid grid-cols-4 border-t border-neutral-300 mt-0.5 text-[7.5px] font-normal">
                  <span className="border-r border-neutral-300">5% (f1)</span>
                  <span className="border-r border-neutral-300">18% (f2)</span>
                  <span className="border-r border-neutral-300">27% (f3)</span>
                  <span>arányos. (f4)</span>
                </div>
              </th>
              <th className="p-0.5 border-r border-black w-[5%] text-center leading-none">
                <span className="text-[7px] block leading-tight">Előlegből adókülönb.</span>
                <span className="text-[7.5px] font-normal text-neutral-500">(e)</span>
              </th>
              <th className="p-0.5 w-[4%] text-center">Ssz.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 border-black font-mono text-[9px] sm:text-[9.5px]">
            {rows.map(({ rowNum, item }) => {
              const rowStr = String(rowNum).padStart(2, '0');
              const dateRaw = item?.fulfillmentDate || '';

              return (
                <tr
                  key={rowNum}
                  className={cn(
                    'h-[19px] sm:h-[21px] transition-colors',
                    item ? 'hover:bg-neutral-50' : 'bg-white'
                  )}
                >
                  {/* Left row number */}
                  <td className="p-0 border-r border-black text-center font-bold text-neutral-800 bg-neutral-50/50 select-none text-[8.5px]">
                    {rowStr}.
                  </td>

                  {/* (a) Számla sorszáma */}
                  <td className="p-0.5 px-1 border-r border-black font-sans truncate font-medium text-neutral-900 max-w-[150px]">
                    {item ? item.invoiceNumber : ''}
                  </td>

                  {/* (b) Teljesítés dátuma segmented boxes */}
                  <td className="p-0.5 border-r border-black text-center">
                    {item && dateRaw ? (
                      <div className="inline-flex items-center justify-center gap-px select-none">
                        <Nav2665CharBox
                          value={dateRaw}
                          length={8}
                          compact
                          boxClassName="w-[10px] h-[15px] sm:w-[11px] sm:h-[17px] text-[8.5px] font-bold border-r border-neutral-800"
                        />
                      </div>
                    ) : (
                      <span className="text-[7.5px] text-neutral-300 font-sans select-none">—</span>
                    )}
                  </td>

                  {/* (c) Adóalap */}
                  <td className="p-0.5 px-1 border-r border-black text-right font-medium tabular-nums text-neutral-900">
                    {item ? formatHuf(item.baseAmountHuf) : <span className="text-[7px] text-neutral-300 font-sans select-none">forint</span>}
                  </td>

                  {/* (d) Adó */}
                  <td className="p-0.5 px-1 border-r border-black text-right font-medium tabular-nums text-neutral-900">
                    {item ? formatHuf(item.taxAmountHuf) : <span className="text-[7px] text-neutral-300 font-sans select-none">forint</span>}
                  </td>

                  {/* (f1) 5% */}
                  <td className="p-0.5 border-r border-neutral-300 text-right tabular-nums text-[8.5px]">
                    {item && item.vat5Huf ? formatHuf(item.vat5Huf) : ''}
                  </td>

                  {/* (f2) 18% */}
                  <td className="p-0.5 border-r border-neutral-300 text-right tabular-nums text-[8.5px]">
                    {item && item.vat18Huf ? formatHuf(item.vat18Huf) : ''}
                  </td>

                  {/* (f3) 27% */}
                  <td className="p-0.5 border-r border-neutral-300 text-right tabular-nums text-[8.5px]">
                    {item && item.vat27Huf ? formatHuf(item.vat27Huf) : ''}
                  </td>

                  {/* (f4) arányosítás */}
                  <td className="p-0.5 border-r border-black text-right tabular-nums text-[8.5px]">
                    {item && item.proRataHuf ? formatHuf(item.proRataHuf) : ''}
                  </td>

                  {/* (e) Előleg jelölése */}
                  <td className="p-0.5 border-r border-black text-center font-bold text-neutral-900">
                    {item?.isAdvanceDiff ? (
                      <span className="w-3.5 h-3.5 border border-black inline-flex items-center justify-center text-[9px] font-black bg-white">
                        X
                      </span>
                    ) : (
                      <span className="w-3.5 h-3.5 border border-neutral-300 inline-block bg-white" />
                    )}
                  </td>

                  {/* Right row number */}
                  <td className="p-0 border-l border-black text-center font-bold text-neutral-800 bg-neutral-50/50 select-none text-[8.5px]">
                    {rowStr}.
                  </td>
                </tr>
              );
            })}

            {/* Row 37: Összesen row */}
            <tr className="bg-neutral-100/90 font-black border-t-2 border-black h-[22px] sm:h-[24px]">
              <td className="p-0 border-r border-black text-center font-black text-neutral-900 bg-neutral-200 select-none text-[9px]">
                37.
              </td>
              <td colSpan={2} className="p-1 px-2 border-r border-black font-sans text-[10px] text-neutral-950 font-black">
                Összesen:
              </td>
              <td className="p-1 border-r border-black text-right tabular-nums font-black text-neutral-950">
                {formatHuf(pageData.pageBaseTotalHuf)}
              </td>
              <td className="p-1 border-r border-black text-right tabular-nums font-black text-neutral-950">
                {formatHuf(pageData.pageTaxTotalHuf)}
              </td>
              <td className="p-0.5 border-r border-neutral-300 text-right tabular-nums text-[8.5px]">
                {formatHuf(pageData.pageVat5TotalHuf)}
              </td>
              <td className="p-0.5 border-r border-neutral-300 text-right tabular-nums text-[8.5px]">
                {formatHuf(pageData.pageVat18TotalHuf)}
              </td>
              <td className="p-0.5 border-r border-neutral-300 text-right tabular-nums text-[8.5px]">
                {formatHuf(pageData.pageVat27TotalHuf)}
              </td>
              <td className="p-0.5 border-r border-black text-right tabular-nums text-[8.5px]">
                {formatHuf(pageData.pageProRataTotalHuf)}
              </td>
              <td className="p-0.5 border-r border-black text-center bg-neutral-200" />
              <td className="p-0 text-center font-black text-neutral-900 bg-neutral-200 select-none text-[9px]">
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
