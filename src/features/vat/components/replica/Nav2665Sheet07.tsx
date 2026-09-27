import React from 'react';
import { Nav2665TaxNumberBoxes, Nav2665DateBoxes } from './Nav2665CharBox';

export interface ReverseChargeSteelItem {
  id: string;
  partnerTaxNumber: string;
  deliveryDate: string;
  productName: string;
  vtsz: string;
  quantityKg: number;
  netAmountHuf: number;
}

interface Nav2665Sheet07Props {
  items: ReverseChargeSteelItem[];
}

/**
 * 2665A-07 lap: Fordított adózás keretében történt ÉRTÉKESÍTÉSRE vonatkozó nyilatkozat.
 * Az adatokat forintban kell feltüntetni (max 36 tétel laponként).
 */
export function Nav2665Sheet07({ items = [] }: Nav2665Sheet07Props) {
  const displayRows = Array.from({ length: 36 }, (_, i) => items[i] || null);
  const totalAmount = items.reduce((sum, item) => sum + (item.netAmountHuf || 0), 0);

  return (
    <div className="border border-neutral-900 bg-white select-text">
      {/* Title banner */}
      <div className="bg-neutral-100 border-b border-neutral-900 p-2 text-center">
        <h2 className="text-[11px] font-bold uppercase text-neutral-900 leading-tight">
          Az Áfa tv. 6/A., 6/B. és a 6/C. számú mellékletei szerint a fordított adózás keretében történt értékesítésre vonatkozó nyilatkozat
        </h2>
        <span className="text-[9px] text-neutral-500 italic block mt-0.5">
          Az adatokat forintban kell feltüntetni!
        </span>
      </div>

      {/* Table */}
      <table className="w-full border-collapse text-[10px]">
        <thead>
          <tr className="border-b-2 border-neutral-900 bg-neutral-100 text-center font-bold text-[9px] uppercase">
            <th className="w-7 border-r border-neutral-900 p-1"></th>
            <th className="w-48 border-r border-neutral-900 p-1">Vevő adószáma (a)</th>
            <th className="w-28 border-r border-neutral-900 p-1">Teljesítés napja (b)</th>
            <th className="border-r border-neutral-900 p-1">Termék megnevezése (c)</th>
            <th className="w-16 border-r border-neutral-900 p-1">Vámtarifaszám (d)</th>
            <th className="w-20 border-r border-neutral-900 p-1">Mennyiség (kg) (e)</th>
            <th className="w-28 border-r border-neutral-900 p-1">Adóalap (Ft) (f)</th>
            <th className="w-7 p-1"></th>
          </tr>
        </thead>
        <tbody>
          {displayRows.map((item, idx) => {
            const num = String(idx + 1).padStart(2, '0');
            return (
              <tr key={idx} className="border-b border-neutral-900 hover:bg-amber-50/30 h-6">
                <td className="w-7 border-r border-neutral-900 text-center font-mono font-bold text-[10px] p-0.5">
                  {num}.
                </td>
                <td className="w-48 border-r border-neutral-900 p-0.5 text-center">
                  {item ? (
                    <Nav2665TaxNumberBoxes taxNumber={item.partnerTaxNumber} className="scale-75 origin-center" />
                  ) : null}
                </td>
                <td className="w-28 border-r border-neutral-900 p-0.5 text-center">
                  {item ? (
                    <Nav2665DateBoxes dateStr={item.deliveryDate} className="scale-75 origin-center" />
                  ) : null}
                </td>
                <td className="border-r border-neutral-900 px-1 py-0.5 text-[9px] truncate max-w-[160px]">
                  {item ? item.productName || 'Más rúd vasból vagy ötvözetlen acélból' : ''}
                </td>
                <td className="w-16 border-r border-neutral-900 p-0.5 text-center font-mono text-[10px]">
                  {item ? item.vtsz || '7215' : ''}
                </td>
                <td className="w-20 border-r border-neutral-900 px-1 py-0.5 text-right font-mono text-[10px]">
                  {item && item.quantityKg ? Math.round(item.quantityKg).toLocaleString('hu-HU') : ''}
                </td>
                <td className="w-28 border-r border-neutral-900 px-1 py-0.5 text-right font-mono font-bold text-[10px]">
                  {item && item.netAmountHuf ? Math.round(item.netAmountHuf).toLocaleString('hu-HU') : ''}
                </td>
                <td className="w-7 text-center font-mono font-bold text-[10px] p-0.5">
                  {num}.
                </td>
              </tr>
            );
          })}

          {/* Row 37: Összesen */}
          <tr className="bg-neutral-100 font-bold border-t-2 border-neutral-900">
            <td className="w-7 border-r border-neutral-900 text-center font-mono p-1">37.</td>
            <td colSpan={5} className="border-r border-neutral-900 p-1 text-right uppercase tracking-wider pr-4">
              Összesen:
            </td>
            <td className="w-28 border-r border-neutral-900 px-1.5 py-1 text-right font-mono text-[11px] font-black">
              {totalAmount ? Math.round(totalAmount).toLocaleString('hu-HU') : '0'}
            </td>
            <td className="w-7"></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
