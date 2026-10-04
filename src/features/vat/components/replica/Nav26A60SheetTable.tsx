import React from 'react';
import { Nav2665CharBox } from './Nav2665CharBox';

export interface A60AggregatedPartnerItem {
  countryCode: string;
  vatNumber: string;
  fullTaxNumber: string;
  partnerName: string;
  amountEft: number;
  invoiceCount?: number;
}

export type A60SubSheetType = '01' | '02' | '03' | '04' | '05';

interface Nav26A60SheetTableProps {
  sheetType: A60SubSheetType;
  items: A60AggregatedPartnerItem[];
  pageNumber?: number;
}

/**
 * Authentic replica of the NAV 26A60 sub-sheets:
 * - 26A60-01: Közösségi termékértékesítések részletezése
 * - 26A60-02: Közösségi termékbeszerzések részletezése
 * - 26A60-03: Közösségi szolgáltatásnyújtások részletezése
 * - 26A60-04: Közösségi szolgáltatás igénybevételek részletezése
 * - 26A60-05: Közösségi vevői készlet átmozgatás
 *
 * Each sheet contains exactly 24 data rows (01-24) and row 25 is "Összesen".
 */
export function Nav26A60SheetTable({
  sheetType,
  items = [],
  pageNumber = 1,
}: Nav26A60SheetTableProps) {
  // Max 24 data rows per ÁNYK 26A60 page
  const displayRows = Array.from({ length: 24 }, (_, i) => items[i] || null);
  const totalAmountEft = items.reduce((sum, item) => sum + (item.amountEft || 0), 0);

  const isGoods = sheetType === '01' || sheetType === '02';
  const isServices = sheetType === '03' || sheetType === '04';
  const isCallOff = sheetType === '05';

  const partnerColTitle = (() => {
    switch (sheetType) {
      case '01':
        return 'Vevő közösségi adószáma';
      case '02':
        return 'Eladó közösségi adószáma';
      case '03':
        return 'Szolgáltatást igénybevevő közösségi adószáma';
      case '04':
        return 'Szolgáltatást nyújtó közösségi adószáma';
      case '05':
        return 'Partner közösségi adószáma';
      default:
        return 'Közösségi adószám';
    }
  })();

  const amountColTitle = (() => {
    switch (sheetType) {
      case '01':
        return 'A Közösség területén belül történt termékértékesítés áfa nélkül számított ellenértéke';
      case '02':
        return 'A Közösség területén belül történt termékbeszerzés áfa nélkül számított ellenértéke';
      case '03':
        return 'A Közösség területén belül történt szolgáltatásnyújtás áfa nélkül számított ellenértéke';
      case '04':
        return 'A Közösség területén belül történt szolgáltatásigénybevétel áfa nélkül számított ellenértéke';
      default:
        return 'Áfa nélkül számított ellenérték';
    }
  })();

  return (
    <div className="border border-neutral-900 bg-white select-text overflow-hidden">
      {/* Table */}
      <table className="w-full table-fixed border-collapse text-[10px]">
        {isGoods && (
          <colgroup>
            {/* Ssz */}
            <col className="w-7 sm:w-8" />
            {/* (a) Országkód */}
            <col className="w-14 sm:w-16" />
            {/* (b) Adószám */}
            <col className="w-[180px] sm:w-[200px]" />
            {/* (c) Ellenérték */}
            <col />
            {/* (d) Egyedi jelölés */}
            <col className="w-12 sm:w-14" />
            {/* (e) T/U */}
            <col className="w-10 sm:w-12" />
            {/* (f) Helyesbítés oka (1-5) */}
            <col className="w-24 sm:w-28" />
          </colgroup>
        )}

        {isServices && (
          <colgroup>
            {/* Ssz */}
            <col className="w-7 sm:w-8" />
            {/* (a) Országkód */}
            <col className="w-14 sm:w-16" />
            {/* (b) Adószám */}
            <col className="w-[200px] sm:w-[230px]" />
            {/* (c) Ellenérték */}
            <col />
            {/* (d) T/U */}
            <col className="w-10 sm:w-12" />
            {/* (e) Helyesbítés oka (1-3) */}
            <col className="w-20 sm:w-24" />
          </colgroup>
        )}

        {isCallOff && (
          <colgroup>
            <col className="w-8" />
            <col className="w-16" />
            <col className="w-[180px]" />
            <col className="w-14" />
            <col className="w-[180px]" />
            <col />
          </colgroup>
        )}

        {/* TABLE HEADERS */}
        <thead>
          <tr className="border-b-2 border-neutral-900 bg-neutral-100 text-center font-bold text-[8.5px] uppercase">
            <th className="border-r border-neutral-900 p-0.5" rowSpan={2}>
              <div>Ssz.</div>
            </th>
            <th className="border-r border-neutral-900 p-1" rowSpan={2}>
              <div>Ország kód</div>
              <div className="text-[7.5px] font-normal lowercase">(a)</div>
            </th>
            <th className="border-r border-neutral-900 p-1" rowSpan={2}>
              <div>{partnerColTitle}</div>
              <div className="text-[7.5px] font-normal lowercase">(b)</div>
            </th>
            {!isCallOff && (
              <th className="border-r border-neutral-900 p-1" rowSpan={2}>
                <div className="leading-tight">{amountColTitle}</div>
                <div className="text-[7.5px] font-normal lowercase">(c)</div>
              </th>
            )}

            {isGoods && (
              <>
                <th className="border-r border-neutral-900 p-1" rowSpan={2}>
                  <div className="leading-tight">Egyedi jelölés</div>
                  <div className="text-[7.5px] font-normal lowercase">(d)</div>
                </th>
                <th className="border-r border-neutral-900 p-1" rowSpan={2}>
                  <div>T/U</div>
                  <div className="text-[7.5px] font-normal lowercase">(e)</div>
                </th>
                <th className="border-r border-neutral-900 p-0.5" colSpan={5}>
                  <div>Helyesbítés oka</div>
                  <div className="text-[7.5px] font-normal lowercase">(f)</div>
                </th>
              </>
            )}

            {isServices && (
              <>
                <th className="border-r border-neutral-900 p-1" rowSpan={2}>
                  <div>T/U</div>
                  <div className="text-[7.5px] font-normal lowercase">(d)</div>
                </th>
                <th className="p-0.5" colSpan={3}>
                  <div>Helyesbítés oka</div>
                  <div className="text-[7.5px] font-normal lowercase">(e)</div>
                </th>
              </>
            )}

            {isCallOff && (
              <>
                <th className="border-r border-neutral-900 p-1" rowSpan={2}>
                  <div>T/U/A</div>
                  <div className="text-[7.5px] font-normal lowercase">(c)</div>
                </th>
                <th className="border-r border-neutral-900 p-1" rowSpan={2}>
                  <div>Új partner közösségi adószáma</div>
                  <div className="text-[7.5px] font-normal lowercase">(d)</div>
                </th>
                <th className="p-1" rowSpan={2}>
                  <div className="leading-tight">Ügylet típusa (vevői készletre kivitel/behozatal)</div>
                  <div className="text-[7.5px] font-normal lowercase">(e)</div>
                </th>
              </>
            )}
          </tr>

          {/* Subheaders for helyesbítés oka columns */}
          {(isGoods || isServices) && (
            <tr className="border-b-2 border-neutral-900 bg-neutral-100 text-center font-bold text-[7.5px]">
              {isGoods && (
                <>
                  <th className="border-r border-neutral-900 p-0.5">1</th>
                  <th className="border-r border-neutral-900 p-0.5">2</th>
                  <th className="border-r border-neutral-900 p-0.5">3</th>
                  <th className="border-r border-neutral-900 p-0.5">4</th>
                  <th className="border-r border-neutral-900 p-0.5">5</th>
                </>
              )}
              {isServices && (
                <>
                  <th className="border-r border-neutral-900 p-0.5">1</th>
                  <th className="border-r border-neutral-900 p-0.5">2</th>
                  <th className="p-0.5">3</th>
                </>
              )}
            </tr>
          )}
        </thead>

        {/* 24 DATA ROWS */}
        <tbody>
          {displayRows.map((item, idx) => {
            const rowNumber = String(idx + 1).padStart(2, '0');
            return (
              <tr
                key={idx}
                className="border-b border-neutral-900 hover:bg-amber-50/30 h-6 transition-colors"
              >
                {/* Ssz. */}
                <td className="border-r border-neutral-900 text-center font-mono font-bold text-[9.5px] p-0.5">
                  {rowNumber}.
                </td>

                {/* (a) Országkód */}
                <td className="border-r border-neutral-900 p-0.5 text-center">
                  {item ? (
                    <div className="flex justify-center">
                      <Nav2665CharBox
                        value={item.countryCode}
                        length={2}
                        className="scale-90 origin-center"
                      />
                    </div>
                  ) : (
                    <div className="flex justify-center">
                      <Nav2665CharBox value="" length={2} className="scale-90 origin-center" />
                    </div>
                  )}
                </td>

                {/* (b) Közösségi adószám */}
                <td className="border-r border-neutral-900 px-1.5 py-0.5 font-mono text-[10px] truncate max-w-0">
                  {item ? (
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold tracking-wider">{item.vatNumber}</span>
                      {item.partnerName && (
                        <span className="text-[8.5px] text-neutral-500 font-sans truncate" title={item.partnerName}>
                          ({item.partnerName})
                        </span>
                      )}
                    </div>
                  ) : null}
                </td>

                {/* (c) Ellenérték ezer Ft */}
                {!isCallOff && (
                  <td className="border-r border-neutral-900 px-2 py-0.5 text-right font-mono font-bold text-[10.5px]">
                    {item ? item.amountEft.toLocaleString('hu-HU') : ''}
                  </td>
                )}

                {/* GOODS: (d) Egyedi jelölés, (e) T/U, (f) 1-5 */}
                {isGoods && (
                  <>
                    <td className="border-r border-neutral-900 p-0.5 text-center">
                      <Nav2665CharBox value="" length={1} className="scale-80 origin-center" />
                    </td>
                    <td className="border-r border-neutral-900 p-0.5 text-center">
                      <Nav2665CharBox value="" length={1} className="scale-80 origin-center" />
                    </td>
                    <td className="border-r border-neutral-900 p-0.5 text-center">
                      <Nav2665CharBox value="" length={1} className="scale-75 origin-center" />
                    </td>
                    <td className="border-r border-neutral-900 p-0.5 text-center">
                      <Nav2665CharBox value="" length={1} className="scale-75 origin-center" />
                    </td>
                    <td className="border-r border-neutral-900 p-0.5 text-center">
                      <Nav2665CharBox value="" length={1} className="scale-75 origin-center" />
                    </td>
                    <td className="border-r border-neutral-900 p-0.5 text-center">
                      <Nav2665CharBox value="" length={1} className="scale-75 origin-center" />
                    </td>
                    <td className="border-r border-neutral-900 p-0.5 text-center">
                      <Nav2665CharBox value="" length={1} className="scale-75 origin-center" />
                    </td>
                  </>
                )}

                {/* SERVICES: (d) T/U, (e) 1-3 */}
                {isServices && (
                  <>
                    <td className="border-r border-neutral-900 p-0.5 text-center">
                      <Nav2665CharBox value="" length={1} className="scale-80 origin-center" />
                    </td>
                    <td className="border-r border-neutral-900 p-0.5 text-center">
                      <Nav2665CharBox value="" length={1} className="scale-75 origin-center" />
                    </td>
                    <td className="border-r border-neutral-900 p-0.5 text-center">
                      <Nav2665CharBox value="" length={1} className="scale-75 origin-center" />
                    </td>
                    <td className="p-0.5 text-center">
                      <Nav2665CharBox value="" length={1} className="scale-75 origin-center" />
                    </td>
                  </>
                )}

                {/* CALL-OFF */}
                {isCallOff && (
                  <>
                    <td className="border-r border-neutral-900 p-0.5 text-center">
                      <Nav2665CharBox value="" length={1} className="scale-80 origin-center" />
                    </td>
                    <td className="border-r border-neutral-900 px-1 py-0.5 font-mono text-[9px]"></td>
                    <td className="p-0.5 text-center">
                      <Nav2665CharBox value="" length={1} className="scale-80 origin-center" />
                    </td>
                  </>
                )}
              </tr>
            );
          })}

          {/* ROW 25: ÖSSZESEN (except call-off) */}
          {!isCallOff && (
            <tr className="border-t-2 border-neutral-900 bg-neutral-100 font-bold h-7">
              <td className="border-r border-neutral-900 text-center font-mono text-[9.5px] p-0.5">
                25.
              </td>
              <td
                colSpan={2}
                className="border-r border-neutral-900 px-2 py-0.5 text-left uppercase text-[9.5px] tracking-wide"
              >
                Összesen
              </td>
              <td className="border-r border-neutral-900 px-2 py-0.5 text-right font-mono text-[11px] font-black">
                {totalAmountEft.toLocaleString('hu-HU')}
              </td>
              <td
                colSpan={isGoods ? 7 : 4}
                className="bg-neutral-200/50"
              />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
