import React from 'react';
import { Nav2665TaxNumberBoxes, Nav2665DateBoxes } from './Nav2665CharBox';
import type { ReverseChargeSteelItem } from './Nav2665Sheet07';

interface Nav2665Sheet08Props {
  items: ReverseChargeSteelItem[];
  pageNumber?: number;
  totalPageCount?: number;
}

/**
 * 2665A-08 lap: Fordított adózás keretében történt BESZERZÉSRE vonatkozó nyilatkozat.
 * Az adatokat forintban kell feltüntetni (max 36 tétel laponként).
 */
export function Nav2665Sheet08({
  items = [],
  pageNumber = 1,
}: Nav2665Sheet08Props) {
  const displayRows = Array.from({ length: 36 }, (_, i) => items[i] || null);
  const totalAmount = items.reduce((sum, item) => sum + (item.netAmountHuf || 0), 0);

  return (
    <div className="border border-neutral-900 bg-white select-text overflow-hidden">
      {/* Title banner */}
      <div className="bg-neutral-100 border-b border-neutral-900 p-2 text-center">
        <h2 className="text-[11px] font-bold uppercase text-neutral-900 leading-tight">
          Az Áfa tv. 6/A., 6/B. és a 6/C. számú mellékletei szerint a fordított adózás keretében történt beszerzésre vonatkozó nyilatkozat
        </h2>
        <span className="text-[9px] text-neutral-500 italic block mt-0.5">
          Az adatokat forintban kell feltüntetni!
        </span>
      </div>

      {/* Table */}
      <table className="w-full table-fixed border-collapse text-[10px]">
        <colgroup>
          <col className="w-6 sm:w-7" />
          <col className="w-[146px]" />
          <col className="w-[94px]" />
          <col />
          <col className="w-[66px]" />
          <col className="w-[74px]" />
          <col className="w-[94px]" />
          <col className="w-6 sm:w-7" />
        </colgroup>
        <thead>
          <tr className="border-b-2 border-neutral-900 bg-neutral-100 text-center font-bold text-[8.5px] uppercase">
            <th className="border-r border-neutral-900 p-0.5"></th>
            <th className="border-r border-neutral-900 p-1">
              <div>Eladó adószáma</div>
              <div className="text-[7.5px] font-normal lowercase">(a)</div>
            </th>
            <th className="border-r border-neutral-900 p-1">
              <div>Teljesítés napja</div>
              <div className="text-[7.5px] font-normal lowercase">(b)</div>
            </th>
            <th className="border-r border-neutral-900 p-1">
              <div>Termék megnevezése</div>
              <div className="text-[7.5px] font-normal lowercase">(c)</div>
            </th>
            <th className="border-r border-neutral-900 p-1 leading-tight">
              <div>Vámtarifaszám</div>
              <div className="text-[7.5px] font-normal lowercase">(d)</div>
            </th>
            <th className="border-r border-neutral-900 p-1 leading-tight">
              <div>Mennyiség (kg)</div>
              <div className="text-[7.5px] font-normal lowercase">(e)</div>
            </th>
            <th className="border-r border-neutral-900 p-1 leading-tight">
              <div>Adóalap (Ft)</div>
              <div className="text-[7.5px] font-normal lowercase">(f)</div>
            </th>
            <th className="p-0.5"></th>
          </tr>
        </thead>
        <tbody>
          {displayRows.map((item, idx) => {
            const num = String(idx + 1).padStart(2, '0');
            return (
              <tr key={idx} className="border-b border-neutral-900 hover:bg-amber-50/30 h-6">
                <td className="border-r border-neutral-900 text-center font-mono font-bold text-[10px] p-0.5">
                  {num}.
                </td>
                <td className="border-r border-neutral-900 p-0.5 text-center">
                  {item ? (
                    <Nav2665TaxNumberBoxes taxNumber={item.partnerTaxNumber} compact={true} />
                  ) : null}
                </td>
                <td className="border-r border-neutral-900 p-0.5 text-center">
                  {item ? (
                    <Nav2665DateBoxes dateStr={item.deliveryDate} compact={true} />
                  ) : null}
                </td>
                <td
                  className="border-r border-neutral-900 px-1.5 py-0.5 text-[9px] truncate max-w-0"
                  title={item?.productName || ''}
                >
                  {item ? item.productName || 'Más rúd vasból vagy ötvözetlen acélból' : ''}
                </td>
                <td className="border-r border-neutral-900 p-0.5 text-center font-mono text-[10px]">
                  {item ? item.vtsz || '7214' : ''}
                </td>
                <td className="border-r border-neutral-900 px-1 py-0.5 text-right font-mono text-[10px] truncate">
                  {item && item.quantityKg ? Math.round(item.quantityKg).toLocaleString('hu-HU') : ''}
                </td>
                <td className="border-r border-neutral-900 px-1.5 py-0.5 text-right font-mono font-bold text-[10px] truncate">
                  {item && item.netAmountHuf ? Math.round(item.netAmountHuf).toLocaleString('hu-HU') : ''}
                </td>
                <td className="text-center font-mono font-bold text-[10px] p-0.5">
                  {num}.
                </td>
              </tr>
            );
          })}

          {/* Row 37: Összesen (only show total on last page or summary) */}
          <tr className="bg-neutral-100 font-bold border-t-2 border-neutral-900">
            <td className="border-r border-neutral-900 text-center font-mono p-1">37.</td>
            <td colSpan={5} className="border-r border-neutral-900 p-1 text-right uppercase tracking-wider pr-3 text-[9px] sm:text-[10px]">
              Összesen {pageNumber > 1 ? `(1-${pageNumber}. lap összesen)` : ''}:
            </td>
            <td className="border-r border-neutral-900 px-1.5 py-1 text-right font-mono text-[10.5px] font-black truncate">
              {totalAmount ? Math.round(totalAmount).toLocaleString('hu-HU') : '0'}
            </td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
