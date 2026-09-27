import React from 'react';
import { Nav2665CoatOfArms } from './Nav2665CoatOfArms';
import {
  Nav2665CharBox,
  Nav2665TaxNumberBoxes,
  Nav2665BankAccountBoxes,
  Nav2665DateBoxes,
} from './Nav2665CharBox';

interface Nav2665SheetFolapProps {
  selectedCompany: any;
  year: number;
  month: number;
  frequency: string;
  hasSteelItems?: boolean;
  mLineCount?: number;
  partnerCount?: number;
}

/**
 * Authentic replica of the NAV 2665A official Főlap (Page 1 in the official filing).
 */
export function Nav2665SheetFolap({
  selectedCompany,
  year,
  month,
  frequency,
  hasSteelItems = true,
  mLineCount = 5,
  partnerCount = 5,
}: Nav2665SheetFolapProps) {
  // Compute start and end dates based on frequency and month/quarter
  const startDateStr = (() => {
    const y = String(year);
    if (frequency === 'H') {
      const m = String(month).padStart(2, '0');
      return `${y}${m}01`;
    }
    if (frequency === 'N') {
      const startM = String((month - 1) * 3 + 1).padStart(2, '0');
      return `${y}${startM}01`;
    }
    return `${y}0101`;
  })();

  const endDateStr = (() => {
    const y = year;
    if (frequency === 'H') {
      const lastDay = new Date(y, month, 0).getDate();
      return `${y}${String(month).padStart(2, '0')}${String(lastDay).padStart(2, '0')}`;
    }
    if (frequency === 'N') {
      const endM = month * 3;
      const lastDay = new Date(y, endM, 0).getDate();
      return `${y}${String(endM).padStart(2, '0')}${String(lastDay).padStart(2, '0')}`;
    }
    return `${y}1231`;
  })();

  const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  return (
    <div className="border border-neutral-900 bg-white p-3 sm:p-5 text-neutral-900 text-[11px] leading-tight select-text">
      {/* 1. TOP HEADER: COAT OF ARMS | TITLE | BARCODE BOX */}
      <div className="grid grid-cols-12 border-2 border-neutral-900 mb-2">
        {/* Left: Coat of Arms + NAV */}
        <div className="col-span-3 border-r-2 border-neutral-900 p-2 flex flex-col items-center justify-center text-center">
          <Nav2665CoatOfArms width={36} height={52} className="h-12 w-auto max-h-[50px]" />
          <span className="text-[9px] font-bold text-neutral-900 mt-1 uppercase tracking-tight">
            Nemzeti Adó- és Vámhivatal
          </span>
        </div>

        {/* Center: Title */}
        <div className="col-span-6 p-3 flex flex-col items-center justify-center text-center border-r-2 border-neutral-900">
          <h1 className="font-serif font-black text-xl sm:text-2xl tracking-wider text-neutral-900">
            ÁFABEVALLÁS
          </h1>
          <span className="text-xs font-bold text-neutral-800 tracking-wide mt-0.5">
            (BEVALLÁS, ADATSZOLGÁLTATÁS)
          </span>
          <span className="text-[10px] text-neutral-600 italic mt-1">
            Benyújtandó az állami adó- és vámhatósághoz
          </span>
        </div>

        {/* Right: Barcode Box */}
        <div className="col-span-3 p-2 flex items-center justify-center text-center bg-neutral-50/50">
          <div className="border border-neutral-400 border-dashed w-full h-full min-h-[50px] flex items-center justify-center text-[10px] text-neutral-400">
            vonalkód helye
          </div>
        </div>
      </div>

      {/* 2. ROVAT A: HIVATAL (A) */}
      <div className="flex border-2 border-neutral-900 mb-2">
        <div className="w-6 sm:w-7 bg-neutral-100 border-r-2 border-neutral-900 flex items-center justify-center text-center font-bold text-[10px] sm:text-[11px] uppercase tracking-widest [writing-mode:vertical-lr] rotate-180 py-2">
          H I V A T A L (A)
        </div>
        <div className="flex-1 p-2 sm:p-2.5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="font-mono text-2xl font-black tracking-tight text-neutral-900 px-2 py-0.5 border-2 border-neutral-900 bg-neutral-50">
              2665A
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px]">Postára adás dátuma:</span>
                <Nav2665CharBox value="20" length={2} />
                <Nav2665CharBox value="" length={6} />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px]">Beérkezés dátuma:</span>
                <Nav2665CharBox value="20" length={2} />
                <Nav2665CharBox value="" length={6} />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-neutral-300 text-[10px]">
            <div className="flex items-center gap-1">
              <span>Átvevő kódja:</span>
              <Nav2665CharBox value="" length={6} />
            </div>
            <div className="flex items-center gap-1">
              <span>Átvevő szervezet kódja:</span>
              <Nav2665CharBox value="" length={8} />
            </div>
            <div className="flex items-center gap-1">
              <span className="italic text-neutral-500">átvevő aláírása:</span>
              <div className="w-24 border-b border-neutral-400" />
            </div>
          </div>
        </div>
      </div>

      {/* 3. ROVAT B: AZONOSÍTÁS (B) */}
      <div className="flex border-2 border-neutral-900 mb-2">
        <div className="w-6 sm:w-7 bg-neutral-100 border-r-2 border-neutral-900 flex items-center justify-center text-center font-bold text-[10px] sm:text-[11px] uppercase tracking-widest [writing-mode:vertical-lr] rotate-180 py-2">
          A Z O N O S Í T Á S (B)
        </div>
        <div className="flex-1 p-2 sm:p-2.5 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
            <div>
              <span className="text-[10px] font-medium text-neutral-700 block mb-0.5">
                Adózó adószáma / csoportazonosító száma
              </span>
              <Nav2665TaxNumberBoxes taxNumber={selectedCompany?.tax_number} />
            </div>
            <div>
              <span className="text-[10px] font-medium text-neutral-700 block mb-0.5">
                Adózó adóazonosító jele
              </span>
              <Nav2665CharBox value="" length={10} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 border-t border-neutral-300">
            <div>
              <span className="text-[10px] text-neutral-600 block">Jogelőd adószáma:</span>
              <Nav2665CharBox value="" length={8} />
            </div>
            <div>
              <span className="text-[10px] text-neutral-600 block">Adózó vámazonosító száma:</span>
              <Nav2665CharBox value="" length={12} />
            </div>
            <div>
              <span className="text-[10px] text-neutral-600 block">Adózói státusz:</span>
              <div className="w-7 h-6 border border-neutral-900 flex items-center justify-center font-mono font-bold bg-white" />
            </div>
          </div>

          <div className="pt-1 border-t border-neutral-300">
            <span className="text-[10px] text-neutral-600 block">Adózó neve:</span>
            <div className="border border-neutral-900 bg-white px-2 py-1 font-bold text-xs sm:text-sm uppercase tracking-wide">
              {selectedCompany?.name || 'Vállalkozás Neve'}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <span className="text-[10px] text-neutral-600 block">Ügyintéző neve:</span>
              <div className="border border-neutral-900 bg-white px-2 py-0.5 font-medium text-xs">
                {selectedCompany?.representative_name || selectedCompany?.contact_name || 'Jámbor Viktor'}
              </div>
            </div>
            <div>
              <span className="text-[10px] text-neutral-600 block">telefonszáma:</span>
              <div className="border border-neutral-900 bg-white px-2 py-0.5 font-mono text-xs">
                {selectedCompany?.phone || selectedCompany?.contact_phone || '36302491121'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. ROVAT C: BEVALLÁSI IDŐSZAK & KITÖLTÖTT LAPOK (C) */}
      <div className="flex border-2 border-neutral-900 mb-2">
        <div className="w-6 sm:w-7 bg-neutral-100 border-r-2 border-neutral-900 flex items-center justify-center text-center font-bold text-[11px] uppercase tracking-widest [writing-mode:vertical-lr] rotate-180 py-2">
          (C)
        </div>
        <div className="flex-1 p-2 sm:p-2.5 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-bold text-neutral-800 block mb-1">
                Bevallási időszak:
              </span>
              <div className="flex items-center gap-1.5">
                <Nav2665DateBoxes dateStr={startDateStr} labels={['év', 'hó', 'naptól']} />
                <span className="font-bold text-neutral-900 text-sm leading-none">-</span>
                <Nav2665DateBoxes dateStr={endDateStr} labels={['év', 'hó', 'napig']} />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
              <div className="flex flex-col items-center">
                <span className="text-[9px] font-sans text-neutral-600">Bevallás jellege</span>
                <div className="w-7 h-7 border border-neutral-900 flex items-center justify-center font-bold bg-white text-sm">
                  O
                </div>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[9px] font-sans text-neutral-600">Bevallás gyakorisága</span>
                <div className="w-7 h-7 border border-neutral-900 flex items-center justify-center font-bold bg-white text-sm">
                  {frequency || 'H'}
                </div>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[9px] font-sans text-neutral-600">Bevallás fajtája</span>
                <div className="w-7 h-7 border border-neutral-900 flex items-center justify-center font-bold bg-white text-sm" />
              </div>
            </div>
          </div>

          {/* Kitöltött lapok száma táblázat */}
          <div className="border border-neutral-900 p-2 bg-neutral-50/50">
            <span className="text-[10px] font-bold text-neutral-800 block mb-1">
              Kitöltött lapok száma:
            </span>
            <div className="grid grid-cols-11 border border-neutral-900 text-center font-mono text-[10px] bg-white">
              <div className="border-r border-b border-neutral-900 font-bold p-0.5">170</div>
              <div className="border-r border-b border-neutral-900 font-bold p-0.5">02</div>
              <div className="border-r border-b border-neutral-900 font-bold p-0.5">03</div>
              <div className="border-r border-b border-neutral-900 font-bold p-0.5">04</div>
              <div className="border-r border-b border-neutral-900 font-bold p-0.5">06</div>
              <div className="border-r border-b border-neutral-900 font-bold p-0.5">07</div>
              <div className="border-r border-b border-neutral-900 font-bold p-0.5">08</div>
              <div className="border-r border-b border-neutral-900 font-bold p-0.5">09</div>
              <div className="border-r border-b border-neutral-900 font-bold p-0.5">A88</div>
              <div className="border-r border-b border-neutral-900 font-bold p-0.5 text-[8px] leading-tight">
                Partnerek
              </div>
              <div className="border-b border-neutral-900 font-bold p-0.5">M</div>

              {/* Counts */}
              <div className="border-r border-neutral-900 p-1 font-bold">1</div>
              <div className="border-r border-neutral-900 p-1 font-bold">1</div>
              <div className="border-r border-neutral-900 p-1" />
              <div className="border-r border-neutral-900 p-1 font-bold">1</div>
              <div className="border-r border-neutral-900 p-1 font-bold">2</div>
              <div className="border-r border-neutral-900 p-1 font-bold">
                {hasSteelItems ? '1' : ''}
              </div>
              <div className="border-r border-neutral-900 p-1 font-bold">
                {hasSteelItems ? '2' : ''}
              </div>
              <div className="border-r border-neutral-900 p-1" />
              <div className="border-r border-neutral-900 p-1" />
              <div className="border-r border-neutral-900 p-1 font-bold">
                {partnerCount || 1}
              </div>
              <div className="p-1 font-bold">{mLineCount || 1}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 5. ROVAT D: PÉNZFORGALMI SZÁMLASZÁM & CÍM (D) */}
      <div className="flex border-2 border-neutral-900 mb-2">
        <div className="w-6 sm:w-7 bg-neutral-100 border-r-2 border-neutral-900 flex items-center justify-center text-center font-bold text-[11px] uppercase tracking-widest [writing-mode:vertical-lr] rotate-180 py-2">
          (D)
        </div>
        <div className="flex-1 p-2 sm:p-2.5 space-y-2">
          <div>
            <span className="text-[10px] font-medium text-neutral-700 block mb-0.5">
              Adózó belföldi pénzforgalmi vagy fizetési számlaszáma:
            </span>
            <Nav2665BankAccountBoxes
              accountNumber={selectedCompany?.bank_account_number || '104010245052696568901002'}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-neutral-300">
            <div>
              <span className="text-[10px] text-neutral-600 block">
                Számlavezető pénzforgalmi szolgáltató neve:
              </span>
              <div className="border border-neutral-900 bg-white px-2 py-0.5 font-bold text-xs uppercase">
                {selectedCompany?.bank_name || 'K&H Bank Zrt.'}
              </div>
            </div>
            <div>
              <span className="text-[10px] text-neutral-600 block">Belföldi postai utalási cím:</span>
              <div className="border border-neutral-900 bg-white px-2 py-0.5 font-medium text-xs">
                {selectedCompany?.street_address
                  ? `${selectedCompany?.postal_code || ''} ${selectedCompany?.city || ''}, ${selectedCompany.street_address}`
                  : 'Székhely címe'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-neutral-300 text-[10px]">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border border-neutral-900 flex items-center justify-center font-bold bg-white text-xs">
                X
              </div>
              <span>Átvezetési és kiutalási kérelem mellékelve</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold">Visszaigénylés jogcímkódja:</span>
              <div className="w-6 h-6 border border-neutral-900 flex items-center justify-center font-bold font-mono bg-white text-xs">
                B
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 6. ROVAT F: FELELŐSSÉGVÁLLALÁS NYILATKOZAT & ALÁÍRÁS (F) */}
      <div className="flex border-2 border-neutral-900">
        <div className="w-6 sm:w-7 bg-neutral-100 border-r-2 border-neutral-900 flex items-center justify-center text-center font-bold text-[11px] uppercase tracking-widest [writing-mode:vertical-lr] rotate-180 py-2">
          (F)
        </div>
        <div className="flex-1 p-2 sm:p-2.5 space-y-2">
          <p className="text-[10px] text-neutral-700 italic">
            Felelősségem tudatában kijelentem, hogy a bevallásban közölt adatok a valóságnak megfelelnek.
          </p>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
            <div className="flex items-center gap-2">
              <div className="border-b border-neutral-900 pb-0.5 font-bold text-xs">
                {selectedCompany?.city || 'Budapest'}
              </div>
              <span className="text-[9px] text-neutral-500">helység</span>
            </div>

            <div className="flex items-center gap-2">
              <Nav2665DateBoxes dateStr={todayStr} />
            </div>

            <div className="flex flex-col items-center">
              <div className="w-32 border-b-2 border-neutral-900 h-6 flex items-end justify-center font-serif italic text-xs text-neutral-400">
                P.H.
              </div>
              <span className="text-[9px] text-neutral-500">aláírás</span>
            </div>
          </div>

          <div className="border-t border-neutral-300 pt-1.5 flex flex-wrap justify-between items-center text-[10px] text-neutral-600 gap-2">
            <div>
              <span>Meghatalmazott, képviselő neve: </span>
              <span className="font-bold text-neutral-900">
                {selectedCompany?.representative_name || 'Vállalkozás Vezetője'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span>Adóazonosító száma: </span>
              <Nav2665CharBox value="" length={10} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
