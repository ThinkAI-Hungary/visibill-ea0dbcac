import React from 'react';
import { Nav2665CoatOfArms } from './Nav2665CoatOfArms';
import { Nav2665CharBox } from './Nav2665CharBox';
import { formatAnykPhoneNumber } from '@/lib/vatReturnXml';

interface Nav26A60SheetFolapProps {
  selectedCompany: any;
  year: number;
  month: number;
  frequency: string;
  representativeName?: string;
  representativePhone?: string;
}

/**
 * Authentic replica of the NAV 26A60 official Főlap (Page 1 of the A60 summary declaration).
 */
export function Nav26A60SheetFolap({
  selectedCompany,
  year,
  month,
  frequency,
  representativeName,
  representativePhone,
}: Nav26A60SheetFolapProps) {
  // Extract first 8 digits of Hungarian tax number for community VAT ID (e.g. HU 14160877)
  const rawTaxNumber = (selectedCompany?.tax_number || '').replace(/[^0-9]/g, '');
  const baseVatNumber = rawTaxNumber.slice(0, 8);

  const repName =
    representativeName ||
    selectedCompany?.representative_name ||
    '';

  const repPhone =
    representativePhone ||
    formatAnykPhoneNumber(selectedCompany?.phone) ||
    '';

  const freqCode = (() => {
    const f = (frequency || 'H').toUpperCase();
    if (f.startsWith('N') || f === 'QUARTERLY') return 'N';
    if (f.startsWith('É') || f === 'ANNUAL' || f === 'YEARLY') return 'É';
    return 'H';
  })();

  const startDateStr = (() => {
    const y = String(year);
    if (freqCode === 'H') {
      const m = String(month).padStart(2, '0');
      return { y, m, d: '01' };
    }
    if (freqCode === 'N') {
      const startM = String((month - 1) * 3 + 1).padStart(2, '0');
      return { y, m: startM, d: '01' };
    }
    return { y, m: '01', d: '01' };
  })();

  const endDateStr = (() => {
    const y = year;
    if (freqCode === 'H') {
      const lastDay = new Date(y, month, 0).getDate();
      return { y: String(y), m: String(month).padStart(2, '0'), d: String(lastDay).padStart(2, '0') };
    }
    if (freqCode === 'N') {
      const endM = month * 3;
      const lastDay = new Date(y, endM, 0).getDate();
      return { y: String(y), m: String(endM).padStart(2, '0'), d: String(lastDay).padStart(2, '0') };
    }
    return { y: String(y), m: '12', d: '31' };
  })();

  const formCode = `${String(year).slice(-2)}A60`;

  return (
    <div className="border border-neutral-900 bg-white p-4 sm:p-6 text-neutral-900 text-[11px] leading-tight select-text space-y-4">
      {/* 1. TOP HEADER: COAT OF ARMS | 26A60 TITLE | SUBMISSION NOTE */}
      <div className="border-2 border-neutral-900">
        <div className="grid grid-cols-12 border-b-2 border-neutral-900">
          {/* Left: Coat of Arms + NAV */}
          <div className="col-span-3 border-r-2 border-neutral-900 p-2.5 flex flex-col items-center justify-center text-center">
            <Nav2665CoatOfArms width={36} height={52} className="h-12 w-auto max-h-[50px]" />
            <span className="text-[9px] font-bold text-neutral-900 mt-1 uppercase tracking-tight">
              Nemzeti Adó- és Vámhivatal
            </span>
          </div>

          {/* Center: Title & Subtitle */}
          <div className="col-span-9 p-3 flex flex-col items-center justify-center text-center">
            <div className="flex items-center justify-center gap-3">
              <span className="font-mono font-black text-2xl sm:text-3xl tracking-tight px-2 py-0.5 border-2 border-neutral-900 bg-neutral-50">
                {formCode}
              </span>
              <h1 className="font-serif font-black text-lg sm:text-xl tracking-wider text-neutral-900 uppercase">
                Összesítő nyilatkozat
              </h1>
            </div>
            <p className="text-[9.5px] text-neutral-800 font-medium tracking-tight mt-1.5 max-w-[540px] leading-snug">
              az Európai Közösség területén belül történő közösségi termékértékesítésekről és szolgáltatásnyújtásokról,
              valamint az Európai Közösség területéről történő termékbeszerzésekről és szolgáltatás igénybevételekről
            </p>
          </div>
        </div>

        {/* Subheader banner */}
        <div className="bg-neutral-100 py-1 px-3 text-center border-t border-neutral-300">
          <span className="text-[10px] font-semibold text-neutral-700 italic">
            Benyújtandó az állami adó- és vámhatósághoz
          </span>
        </div>
      </div>

      {/* 2. ROVAT B: AZONOSÍTÁS (B) */}
      <div className="flex border-2 border-neutral-900">
        {/* Left vertical header */}
        <div className="w-7 sm:w-8 bg-neutral-100 border-r-2 border-neutral-900 flex items-center justify-center text-center font-bold text-[10px] sm:text-[11px] uppercase tracking-widest [writing-mode:vertical-lr] rotate-180 py-3">
          A Z O N O S Í T Á S (B)
        </div>

        {/* Form fields */}
        <div className="flex-1 p-3 sm:p-4 space-y-3">
          {/* Row 1: Adóazonosító jel & Vonalkód */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-2 border-b border-neutral-300">
            <div>
              <span className="text-[9px] text-neutral-600 block mb-1">
                Adózó adóazonosító jele
              </span>
              <Nav2665CharBox value="" length={10} />
            </div>
            <div>
              <span className="text-[9px] text-neutral-600 block mb-1">
                Hibásnak minősített összesítő nyilatkozat vonalkódja
              </span>
              <Nav2665CharBox value="" length={10} />
            </div>
          </div>

          {/* Row 2: Adózó közösségi adószáma & Jogelőd */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-2 border-b border-neutral-300">
            <div>
              <span className="text-[9.5px] font-bold text-neutral-800 block mb-1">
                Adózó közösségi adószáma
              </span>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="font-bold text-sm bg-neutral-100 px-2 py-0.5 border border-neutral-800">
                  HU
                </span>
                <Nav2665CharBox value={baseVatNumber} length={8} />
              </div>
            </div>
            <div>
              <span className="text-[9px] text-neutral-600 block mb-1">
                Jogelőd közösségi adószáma
              </span>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="font-bold text-sm bg-neutral-100 px-2 py-0.5 border border-neutral-800">
                  HU
                </span>
                <Nav2665CharBox value="" length={8} />
              </div>
            </div>
          </div>

          {/* Row 3: Adózó neve */}
          <div className="pb-2 border-b border-neutral-300">
            <span className="text-[9px] text-neutral-600 block mb-0.5">Adózó neve</span>
            <div className="font-mono font-bold text-sm sm:text-base border-b-2 border-neutral-900 pb-0.5 tracking-wide uppercase">
              {selectedCompany?.name || 'TAXOLOGY Kft.'}
            </div>
          </div>

          {/* Row 4: Ügyintéző neve & Telefonszáma */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <span className="text-[9px] text-neutral-600 block mb-0.5">Ügyintéző neve</span>
              <div className="font-mono font-bold text-xs sm:text-sm border-b border-neutral-900 pb-0.5">
                {repName}
              </div>
            </div>
            <div>
              <span className="text-[9px] text-neutral-600 block mb-0.5">telefonszáma</span>
              <div className="font-mono font-bold text-xs sm:text-sm border-b border-neutral-900 pb-0.5 tracking-wider">
                {repPhone}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. ROVAT C: IDŐSZAK (C) */}
      <div className="flex border-2 border-neutral-900">
        {/* Left vertical header */}
        <div className="w-7 sm:w-8 bg-neutral-100 border-r-2 border-neutral-900 flex items-center justify-center text-center font-bold text-[10px] sm:text-[11px] uppercase tracking-widest py-3">
          (C)
        </div>

        {/* Content */}
        <div className="flex-1 p-3 sm:p-4 space-y-3">
          <div>
            <span className="text-[9.5px] font-bold text-neutral-800 block mb-1.5 uppercase tracking-wide">
              Összesítő nyilatkozat időszaka
            </span>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs font-mono">
              <Nav2665CharBox value={startDateStr.y} length={4} />
              <span className="font-sans text-[10px] text-neutral-600">év</span>
              <Nav2665CharBox value={startDateStr.m} length={2} />
              <span className="font-sans text-[10px] text-neutral-600">hó</span>
              <Nav2665CharBox value={startDateStr.d} length={2} />
              <span className="font-sans text-[10px] text-neutral-600 font-bold">naptól</span>

              <span className="mx-1 text-neutral-400 font-bold">—</span>

              <Nav2665CharBox value={endDateStr.y} length={4} />
              <span className="font-sans text-[10px] text-neutral-600">év</span>
              <Nav2665CharBox value={endDateStr.m} length={2} />
              <span className="font-sans text-[10px] text-neutral-600">hó</span>
              <Nav2665CharBox value={endDateStr.d} length={2} />
              <span className="font-sans text-[10px] text-neutral-600 font-bold">napig</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-neutral-300">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-neutral-700">Összesítő nyilatkozat jellege</span>
              <Nav2665CharBox value="" length={1} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-neutral-700">Összesítő nyilatkozat gyakorisága</span>
              <Nav2665CharBox value={freqCode} length={1} />
              <span className="text-[9px] text-neutral-500 font-sans">
                ({freqCode === 'H' ? 'Havi' : freqCode === 'N' ? 'Negyedéves' : 'Éves'})
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
