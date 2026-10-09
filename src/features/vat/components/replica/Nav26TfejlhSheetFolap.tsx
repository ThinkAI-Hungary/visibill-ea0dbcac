import React from 'react';
import { Nav2665CoatOfArms } from './Nav2665CoatOfArms';
import {
  Nav2665CharBox,
  Nav2665TaxNumberBoxes,
  Nav2665DateBoxes,
} from './Nav2665CharBox';

export interface Nav26TfejlhSheetFolapProps {
  selectedCompany?: any;
  year: number;
  month: number;
  frequency: string; // 'H' | 'N' | 'E'
  baseEtkezohely: number;
  baseEtterem: number;
  baseSzallas: number;
  baseBusz: number;
  agentName?: string;
  agentPhone?: string;
  isSelfRevision?: boolean;
  isRepeatedSelfRevision?: boolean;
  selfRevisionTaxDiff?: number;
  selfRevisionSurcharge?: number;
}

/**
 * Format helper for values in thousand HUF (ezer Ft), as required by NAV 26TFEJLH
 */
function toEzerFt(val: number): number {
  if (!val) return 0;
  return Math.round(val / 1000);
}

function formatEzer(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '0';
  const rounded = Math.round(val);
  return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * Authentic replica of the official NAV 26TFEJLH tax return form
 * (BEVALLÁS a turizmusfejlesztési hozzájárulásról), matching the official ÁNYK layout 1:1.
 */
export function Nav26TfejlhSheetFolap({
  selectedCompany,
  year,
  month,
  frequency,
  baseEtkezohely,
  baseEtterem,
  baseSzallas,
  baseBusz,
  agentName = '',
  agentPhone = '',
  isSelfRevision = false,
  isRepeatedSelfRevision = false,
  selfRevisionTaxDiff = 0,
  selfRevisionSurcharge = 0,
}: Nav26TfejlhSheetFolapProps) {
  const formCode = `${year % 100}TFEJLH`;

  // Compute period dates
  const { startDateStr, endDateStr } = React.useMemo(() => {
    const y = String(year);
    if (frequency === 'H') {
      const m = String(month).padStart(2, '0');
      const lastDay = new Date(year, month, 0).getDate();
      return {
        startDateStr: `${y}${m}01`,
        endDateStr: `${y}${m}${String(lastDay).padStart(2, '0')}`,
      };
    }
    if (frequency === 'N') {
      const startM = String((month - 1) * 3 + 1).padStart(2, '0');
      const endM = month * 3;
      const lastDay = new Date(year, endM, 0).getDate();
      return {
        startDateStr: `${y}${startM}01`,
        endDateStr: `${y}${String(endM).padStart(2, '0')}${String(lastDay).padStart(2, '0')}`,
      };
    }
    return {
      startDateStr: `${y}0101`,
      endDateStr: `${y}1231`,
    };
  }, [year, month, frequency]);

  // Current print timestamp
  const [printDate] = React.useState(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())} ${pad(now.getHours())}.${pad(now.getMinutes())}.${pad(now.getSeconds())}`;
  });

  // Calculate base in thousand HUF
  const ezerEtkezohely = toEzerFt(baseEtkezohely);
  const ezerEtterem = toEzerFt(baseEtterem);
  const ezerSzallas = toEzerFt(baseSzallas);
  const ezerBusz = toEzerFt(baseBusz);
  const ezerTotalBase = ezerEtkezohely + ezerEtterem + ezerSzallas + ezerBusz;
  const ezerTaxPayable = Math.round(ezerTotalBase * 0.04);

  const ezerDiff = toEzerFt(selfRevisionTaxDiff);
  const ezerPotlek = toEzerFt(selfRevisionSurcharge);

  return (
    <div className="border border-neutral-900 bg-white p-3 sm:p-5 text-neutral-900 text-[11px] leading-tight select-text font-sans">
      {/* 1. TOP HEADER: LOGO | TITLE | SUBMISSION TARGET */}
      <div className="border-2 border-neutral-900 mb-2">
        <div className="grid grid-cols-12 border-b border-neutral-900">
          {/* Left: Coat of Arms + NAV */}
          <div className="col-span-3 border-r-2 border-neutral-900 p-2 flex flex-col items-center justify-center text-center">
            <Nav2665CoatOfArms width={34} height={48} className="h-11 w-auto max-h-[46px]" />
            <span className="text-[8.5px] font-bold text-neutral-900 mt-1 uppercase tracking-tight">
              Nemzeti Adó- és Vámhivatal
            </span>
          </div>

          {/* Center: Title */}
          <div className="col-span-9 p-3 flex flex-col items-center justify-center text-center">
            <div className="flex items-center justify-center gap-4 w-full">
              <span className="font-mono font-black text-2xl sm:text-3xl tracking-tight text-neutral-900">
                {formCode}
              </span>
              <h1 className="font-serif font-black text-xl sm:text-2xl tracking-wider text-neutral-900">
                BEVALLÁS
              </h1>
            </div>
            <span className="text-xs font-bold text-neutral-800 tracking-wide mt-1">
              a turizmusfejlesztési hozzájárulásról
            </span>
          </div>
        </div>

        {/* Bottom bar of header */}
        <div className="py-1 px-3 text-center bg-neutral-50/50 text-[10.5px] font-medium text-neutral-700">
          Benyújtandó az állami adó- és vámhatósághoz
        </div>
      </div>

      {/* 2. SECTION (B): AZONOSÍTÁS */}
      <div className="flex border-2 border-neutral-900 mb-2">
        <div className="w-6 sm:w-7 bg-neutral-100 border-r-2 border-neutral-900 flex items-center justify-center text-center font-bold text-[9.5px] sm:text-[10px] uppercase tracking-wider [writing-mode:vertical-lr] rotate-180 py-2">
          AZONOSÍTÁS (B)
        </div>

        <div className="flex-1 p-2 sm:p-2.5 space-y-2">
          {/* Row 1: Adószám, Adóazonosító jel, Vonalkód */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-start">
            <div className="md:col-span-4 space-y-0.5">
              <span className="text-[9px] text-neutral-600 block">Adózó adószáma</span>
              <Nav2665TaxNumberBoxes taxNumber={selectedCompany?.tax_number} compact boxClassName="h-5 w-4 text-xs" />
            </div>

            <div className="md:col-span-4 space-y-0.5">
              <span className="text-[9px] text-neutral-600 block">Adózó adóazonosító jele</span>
              <Nav2665CharBox value="" length={10} compact boxClassName="h-5 w-4 text-xs" />
            </div>

            <div className="md:col-span-4 space-y-0.5">
              <span className="text-[9px] text-neutral-600 block">Hibásnak minősített bevallás vonalkódja</span>
              <div className="border border-neutral-900 h-5 w-full bg-white flex items-center px-1 text-[10px] font-mono text-neutral-400">
                &nbsp;
              </div>
            </div>
          </div>

          {/* Row 2: Jogelőd adószáma */}
          <div className="space-y-0.5">
            <span className="text-[9px] text-neutral-600 block">Jogelőd adószáma</span>
            <Nav2665TaxNumberBoxes taxNumber="" compact boxClassName="h-5 w-4 text-xs" />
          </div>

          {/* Row 3: Adózó neve */}
          <div className="flex items-center gap-2 pt-1 border-t border-neutral-200">
            <span className="text-[10px] font-bold text-neutral-800 whitespace-nowrap min-w-[70px]">
              Adózó neve
            </span>
            <div className="border-b border-neutral-900 flex-1 px-1 py-0.5 font-bold text-xs uppercase tracking-wide">
              {selectedCompany?.name || 'VÁLLALKOZÁS NEVE'}
            </div>
          </div>

          {/* Row 4: Ügyintéző neve és telefonszáma */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-1 border-t border-neutral-200">
            <div className="md:col-span-6 flex items-center gap-2">
              <span className="text-[10px] text-neutral-700 whitespace-nowrap">Ügyintéző neve</span>
              <div className="border-b border-neutral-900 flex-1 px-1 py-0.5 font-semibold text-xs">
                {agentName || selectedCompany?.representative_name || ''}
              </div>
            </div>

            <div className="md:col-span-6 flex items-center gap-2">
              <span className="text-[10px] text-neutral-700 whitespace-nowrap">telefonszáma</span>
              <div className="border-b border-neutral-900 flex-1 px-1 py-0.5 font-mono text-xs">
                {agentPhone || selectedCompany?.phone || ''}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. SECTION (C): BEVALLÁSI IDŐSZAK & JELLEMZŐK */}
      <div className="flex border-2 border-neutral-900 mb-2">
        <div className="w-6 sm:w-7 bg-neutral-100 border-r-2 border-neutral-900 flex items-center justify-center text-center font-bold text-[10px] uppercase tracking-wider [writing-mode:vertical-lr] rotate-180 py-2">
          (C)
        </div>

        <div className="flex-1 p-2 sm:p-2.5 space-y-2">
          {/* Row 1: Időszak & Előtársaság */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-[9px] text-neutral-600 block">Bevallási időszak</span>
              <div className="inline-flex items-center gap-2">
                <Nav2665DateBoxes dateStr={startDateStr} compact labels={['év', 'hó', 'naptól']} boxClassName="h-5 w-4 text-xs" />
                <span className="font-bold text-sm text-neutral-900">-</span>
                <Nav2665DateBoxes dateStr={endDateStr} compact labels={['év', 'hó', 'napig']} boxClassName="h-5 w-4 text-xs" />
              </div>
            </div>

            <div className="flex items-center gap-2 border border-neutral-300 p-1.5 rounded bg-neutral-50/50">
              <span className="text-[9.5px] text-neutral-700">
                A bevallás az előtársasági időszakot is magában foglalja
              </span>
              <div className="w-4 h-4 border border-neutral-900 bg-white flex items-center justify-center font-bold text-[10px]">
                {/* empty checkbox */}
              </div>
            </div>
          </div>

          {/* Row 2: Bevallás jellege, típusa, fajtája, gyakorisága */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-neutral-200">
            <div className="flex items-center justify-between border border-neutral-200 p-1">
              <span className="text-[9px] text-neutral-700">Bevallás jellege</span>
              <div className="w-5 h-5 border border-neutral-900 bg-white flex items-center justify-center font-mono font-bold text-xs">
                {isSelfRevision ? 'O' : ''}
              </div>
            </div>

            <div className="flex items-center justify-between border border-neutral-200 p-1">
              <span className="text-[9px] text-neutral-700">Bevallás típusa</span>
              <div className="w-5 h-5 border border-neutral-900 bg-white flex items-center justify-center font-mono font-bold text-xs">
                {/* empty */}
              </div>
            </div>

            <div className="flex items-center justify-between border border-neutral-200 p-1">
              <span className="text-[9px] text-neutral-700">Bevallás fajtája</span>
              <div className="w-5 h-5 border border-neutral-900 bg-white flex items-center justify-center font-mono font-bold text-xs">
                {/* empty */}
              </div>
            </div>

            <div className="flex items-center justify-between border border-neutral-200 p-1">
              <span className="text-[9px] text-neutral-700">Bevallás gyakorisága</span>
              <div className="w-5 h-5 border border-neutral-900 bg-white flex items-center justify-center font-mono font-bold text-xs bg-neutral-50">
                {frequency}
              </div>
            </div>
          </div>

          {/* Row 3: Checkboxes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[9px] text-neutral-700">
            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-3.5 border border-neutral-900 bg-white shrink-0" />
              <span>Küszöbérték túllépés éves adózó esetén</span>
            </div>

            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-3.5 border border-neutral-900 bg-white shrink-0" />
              <span>Adóhatósági engedéllyel évközi gyakoriság váltás</span>
            </div>

            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-3.5 border border-neutral-900 bg-white shrink-0" />
              <span>Közösségi adószám évközi megállapítása miatt törtidőszaki bevallás</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. SECTION (D): TÁBLÁZAT - HOZZÁJÁRULÁS LEVEZETÉSE */}
      <div className="flex border-2 border-neutral-900 mb-2">
        <div className="w-6 sm:w-7 bg-neutral-100 border-r-2 border-neutral-900 flex items-center justify-center text-center font-bold text-[10px] uppercase tracking-wider [writing-mode:vertical-lr] rotate-180 py-2">
          (D)
        </div>

        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-left border-collapse text-[10px] sm:text-[10.5px]">
            <thead>
              <tr className="border-b-2 border-neutral-900 bg-neutral-50">
                <th className="py-1.5 px-2 border-r border-neutral-900 text-center w-8 font-bold">
                  Ssz.
                </th>
                <th className="py-1.5 px-2 border-r border-neutral-900 font-bold">
                  Megnevezés
                </th>
                <th className="py-1.5 px-2 border-r border-neutral-900 text-center w-16 font-bold">
                  Adónemkód
                </th>
                <th className="py-1.5 px-2 border-r border-neutral-900 text-right w-36 font-bold">
                  <div>Hozzájárulás alapja</div>
                  <div className="text-[9px] font-normal text-neutral-600">a)</div>
                </th>
                <th className="py-1.5 px-2 text-right w-32 font-bold">
                  <div>Hozzájárulás</div>
                  <div className="text-[9px] font-normal text-neutral-600">b)</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {/* 1. sor: Étkezőhelyi vendéglátás */}
              <tr className="border-b border-neutral-900 hover:bg-neutral-50/50">
                <td className="py-1.5 px-2 border-r border-neutral-900 text-center font-mono font-bold">
                  1.
                </td>
                <td className="py-1.5 px-2 border-r border-neutral-900 leading-tight">
                  Étkezőhelyi vendéglátásban az étel- és a helyben készített, nem alkoholtartalmú italforgalom
                </td>
                <td className="py-1.5 px-2 border-r border-neutral-900 text-center font-mono font-bold">
                  310
                </td>
                <td className="py-1.5 px-2 border-r border-neutral-900 text-right font-mono font-bold text-xs">
                  <div>{formatEzer(ezerEtkezohely)}</div>
                  <div className="text-[8px] font-sans text-neutral-500 font-normal">ezer</div>
                </td>
                <td className="py-1.5 px-2 text-right bg-neutral-50">
                  {/* Üres a NAV minta szerint */}
                </td>
              </tr>

              {/* 5. sor: Étterem, cukrászda */}
              <tr className="border-b border-neutral-900 hover:bg-neutral-50/50">
                <td className="py-1.5 px-2 border-r border-neutral-900 text-center font-mono font-bold">
                  5.
                </td>
                <td className="py-1.5 px-2 border-r border-neutral-900 leading-tight">
                  Étterem, cukrászda vendéglátással kapcsolatos szolgáltatásai
                </td>
                <td className="py-1.5 px-2 border-r border-neutral-900 text-center font-mono font-bold">
                  310
                </td>
                <td className="py-1.5 px-2 border-r border-neutral-900 text-right font-mono font-bold text-xs">
                  <div>{formatEzer(ezerEtterem)}</div>
                  <div className="text-[8px] font-sans text-neutral-500 font-normal">ezer</div>
                </td>
                <td className="py-1.5 px-2 text-right bg-neutral-50">
                  {/* Üres a NAV minta szerint */}
                </td>
              </tr>

              {/* 2. sor: Szálláshely */}
              <tr className="border-b border-neutral-900 hover:bg-neutral-50/50">
                <td className="py-1.5 px-2 border-r border-neutral-900 text-center font-mono font-bold">
                  2.
                </td>
                <td className="py-1.5 px-2 border-r border-neutral-900 leading-tight">
                  Kereskedelmi szálláshely-szolgáltatás
                </td>
                <td className="py-1.5 px-2 border-r border-neutral-900 text-center font-mono font-bold">
                  310
                </td>
                <td className="py-1.5 px-2 border-r border-neutral-900 text-right font-mono font-bold text-xs">
                  <div>{formatEzer(ezerSzallas)}</div>
                  <div className="text-[8px] font-sans text-neutral-500 font-normal">ezer</div>
                </td>
                <td className="py-1.5 px-2 text-right bg-neutral-50">
                  {/* Üres a NAV minta szerint */}
                </td>
              </tr>

              {/* 3. sor: Buszos városnézés */}
              <tr className="border-b border-neutral-900 hover:bg-neutral-50/50">
                <td className="py-1.5 px-2 border-r border-neutral-900 text-center font-mono font-bold">
                  3.
                </td>
                <td className="py-1.5 px-2 border-r border-neutral-900 leading-tight">
                  „Hop on hop off” jellegű menetrend szerinti buszos városnéző turisztikai szolgáltatás
                </td>
                <td className="py-1.5 px-2 border-r border-neutral-900 text-center font-mono font-bold">
                  310
                </td>
                <td className="py-1.5 px-2 border-r border-neutral-900 text-right font-mono font-bold text-xs">
                  <div>{formatEzer(ezerBusz)}</div>
                  <div className="text-[8px] font-sans text-neutral-500 font-normal">ezer</div>
                </td>
                <td className="py-1.5 px-2 text-right bg-neutral-50">
                  {/* Üres a NAV minta szerint */}
                </td>
              </tr>

              {/* 4. sor: ÖSSZESEN */}
              <tr className="bg-neutral-100/70 font-bold border-t-2 border-neutral-900">
                <td className="py-2 px-2 border-r border-neutral-900 text-center font-mono text-xs">
                  4.
                </td>
                <td className="py-2 px-2 border-r border-neutral-900 uppercase tracking-tight text-xs">
                  Turizmusfejlesztési hozzájárulás összesen
                </td>
                <td className="py-2 px-2 border-r border-neutral-900 text-center font-mono text-xs">
                  310
                </td>
                <td className="py-2 px-2 border-r border-neutral-900 text-right font-mono text-xs bg-white">
                  <div className="text-sm font-black">{formatEzer(ezerTotalBase)}</div>
                  <div className="text-[8px] font-sans text-neutral-600 font-normal">ezer</div>
                </td>
                <td className="py-2 px-2 text-right font-mono text-xs bg-white text-neutral-900">
                  <div className="text-sm font-black text-amber-700 dark:text-amber-900">{formatEzer(ezerTaxPayable)}</div>
                  <div className="text-[8px] font-sans text-neutral-600 font-normal">ezer</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. SECTION (E): ÖNELLENŐRZÉS */}
      <div className="flex border-2 border-neutral-900 mb-2">
        <div className="w-6 sm:w-7 bg-neutral-100 border-r-2 border-neutral-900 flex items-center justify-center text-center font-bold text-[10px] uppercase tracking-wider [writing-mode:vertical-lr] rotate-180 py-2">
          (E)
        </div>

        <div className="flex-1">
          {/* Header of Section E */}
          <div className="p-2 border-b border-neutral-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-neutral-50">
            <span className="font-bold text-xs uppercase tracking-wide">
              Önellenőrzés
            </span>

            <div className="flex items-center gap-2">
              <span className="text-[9.5px] text-neutral-700">
                Ismételt önellenőrzés jelölése (x)
              </span>
              <div className="w-4 h-4 border border-neutral-900 bg-white flex items-center justify-center font-mono font-bold text-[10px]">
                {isRepeatedSelfRevision ? 'X' : ''}
              </div>
            </div>
          </div>

          <div className="py-1 px-3 text-center bg-neutral-100 text-[10px] font-bold tracking-wider uppercase border-b border-neutral-900">
            Az adatokat EZER FORINTBAN kell megadni
          </div>

          <table className="w-full text-left border-collapse text-[10px] sm:text-[10.5px]">
            <thead>
              <tr className="border-b border-neutral-900 bg-neutral-50">
                <th className="py-1 px-2 border-r border-neutral-900 text-center w-8 font-bold">
                  Ssz.
                </th>
                <th className="py-1 px-2 border-r border-neutral-900 font-bold">
                  Megnevezés
                </th>
                <th className="py-1 px-2 border-r border-neutral-900 text-center w-16 font-bold">
                  Adónemkód
                </th>
                <th className="py-1 px-2 border-r border-neutral-900 text-right w-36 font-bold">
                  <div>Adókötelezettség változása (+/-)</div>
                  <div className="text-[9px] font-normal text-neutral-600">a)</div>
                </th>
                <th className="py-1 px-2 text-right w-32 font-bold">
                  <div>Önellenőrzési pótlék összege</div>
                  <div className="text-[9px] font-normal text-neutral-600">b)</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {/* 11. sor */}
              <tr className="border-b border-neutral-900">
                <td className="py-1.5 px-2 border-r border-neutral-900 text-center font-mono font-bold">
                  11.
                </td>
                <td className="py-1.5 px-2 border-r border-neutral-900">
                  Turizmusfejlesztési hozzájárulás
                </td>
                <td className="py-1.5 px-2 border-r border-neutral-900 text-center font-mono font-bold">
                  310
                </td>
                <td className="py-1.5 px-2 border-r border-neutral-900 text-right font-mono font-bold">
                  {isSelfRevision ? (
                    <div>
                      <div>{formatEzer(ezerDiff)}</div>
                      <div className="text-[8px] font-sans text-neutral-500 font-normal">ezer</div>
                    </div>
                  ) : null}
                </td>
                <td className="py-1.5 px-2 text-right bg-neutral-50">
                  {/* üres */}
                </td>
              </tr>

              {/* 12. sor */}
              <tr>
                <td className="py-1.5 px-2 border-r border-neutral-900 text-center font-mono font-bold">
                  12.
                </td>
                <td className="py-1.5 px-2 border-r border-neutral-900">
                  Önellenőrzési pótlék összege
                </td>
                <td className="py-1.5 px-2 border-r border-neutral-900 text-center font-mono font-bold">
                  215
                </td>
                <td className="py-1.5 px-2 border-r border-neutral-900 text-right bg-neutral-50">
                  {/* üres */}
                </td>
                <td className="py-1.5 px-2 text-right font-mono font-bold">
                  {isSelfRevision ? (
                    <div>
                      <div>{formatEzer(ezerPotlek)}</div>
                      <div className="text-[8px] font-sans text-neutral-500 font-normal">ezer</div>
                    </div>
                  ) : null}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. FOOTER: VERZIÓ & NYOMTATÁSI IDŐPÉCSÉT */}
      <div className="flex items-center justify-between text-[9px] text-neutral-700 pt-1 font-mono">
        <div>Ny.v.:3.0 A nyomtatvány papír alapon nem küldhető be!</div>
        <div>Nyomtatva: {printDate}</div>
      </div>
    </div>
  );
}
