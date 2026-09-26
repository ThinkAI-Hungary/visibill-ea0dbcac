import React from 'react';
import { Globe, FileCheck2, AlertCircle, CheckCircle2, ArrowUpRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { VatScope } from '../types';

export interface VatScopeRadioGroupProps {
  value: VatScope;
  onChange: (value: VatScope) => void;
  totalCount: number;
  withImageCount: number;
  missingCount: number;
  isLoading?: boolean;
  onOpenOsaCheck?: () => void;
  className?: string;
}

/**
 * VatScopeRadioGroup
 * ============================================================================
 * Prominent 2-Card Segmented Radio Selector for VAT Scope:
 * - "all": Process all invoices reported in NAV OSA even without uploaded scans
 * - "with_image": Strictly process only invoices backed by uploaded image scans
 * ============================================================================
 */
export function VatScopeRadioGroup({
  value,
  onChange,
  totalCount,
  withImageCount,
  missingCount,
  isLoading = false,
  onOpenOsaCheck,
  className,
}: VatScopeRadioGroupProps) {
  const isAll = value === 'all';
  const isWithImage = value === 'with_image';

  return (
    <div
      className={cn(
        'w-full bg-gradient-to-b from-card via-card/95 to-muted/20 border border-border/80 shadow-sm rounded-2xl p-3 sm:p-4 transition-all duration-200',
        className
      )}
    >
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold tracking-wide uppercase bg-primary/10 text-primary border border-primary/20">
            Adatkör & Bizonylat-kezelés
          </span>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Válaszd ki, hogy az analitikák és a bevallás mely számlákat tartalmazzák:
          </span>
        </div>

        {missingCount > 0 && onOpenOsaCheck && (
          <button
            type="button"
            onClick={onOpenOsaCheck}
            className="text-xs font-medium text-amber-700 dark:text-amber-400 hover:underline inline-flex items-center gap-1 transition-colors"
          >
            <span>OSA egyeztetés megnyitása</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Large 2-Card Radio Grid */}
      <div
        role="radiogroup"
        aria-label="ÁFA Bizonylatköri Adatkör"
        className="grid grid-cols-1 md:grid-cols-2 gap-3"
      >
        {/* Card 1: Minden számla könyvelése (NAV OSA + Számlakép) */}
        <div
          role="radio"
          aria-checked={isAll}
          tabIndex={0}
          onClick={() => onChange('all')}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              onChange('all');
            }
          }}
          className={cn(
            'group relative flex flex-col justify-between p-4 sm:p-5 rounded-xl border transition-all duration-200 cursor-pointer select-none outline-none',
            isAll
              ? 'border-primary ring-2 ring-primary/30 bg-primary/[0.04] dark:bg-primary/[0.08] shadow-md'
              : 'border-border/70 hover:border-border hover:bg-muted/40 bg-card/60'
          )}
        >
          <div>
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center transition-colors',
                    isAll
                      ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/30'
                      : 'bg-muted text-muted-foreground group-hover:text-foreground'
                  )}
                >
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-foreground tracking-tight leading-tight">
                    Minden számla könyvelése
                  </h3>
                  <span className="text-xs text-primary font-medium">NAV Online Számla (OSA) + Kép</span>
                </div>
              </div>

              {/* Radio Indicator */}
              <div
                className={cn(
                  'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all',
                  isAll
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-muted-foreground/40 group-hover:border-muted-foreground'
                )}
              >
                {isAll && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed mt-2">
              Minden bejelentett számla bekerül a bevallásba és az analitikákba, azok is, amelyekhez az ügyfél még nem küldött be számlaképet.
            </p>
          </div>

          {/* Card Footer badges */}
          <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-border/50 text-xs">
            <Badge
              variant="outline"
              className={cn(
                'font-mono font-medium',
                isAll ? 'border-primary/40 bg-primary/10 text-primary' : 'bg-muted/50'
              )}
            >
              {isLoading ? '...' : `${totalCount} bejövő számla`}
            </Badge>
            <span className="text-[11px] text-muted-foreground">Teljes adóhatósági teljesség</span>
          </div>
        </div>

        {/* Card 2: Csak számlaképpel rendelkező számlák */}
        <div
          role="radio"
          aria-checked={isWithImage}
          tabIndex={0}
          onClick={() => onChange('with_image')}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              onChange('with_image');
            }
          }}
          className={cn(
            'group relative flex flex-col justify-between p-4 sm:p-5 rounded-xl border transition-all duration-200 cursor-pointer select-none outline-none',
            isWithImage
              ? 'border-emerald-600 dark:border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-500/[0.04] dark:bg-emerald-500/[0.08] shadow-md'
              : 'border-border/70 hover:border-border hover:bg-muted/40 bg-card/60'
          )}
        >
          <div>
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center transition-colors',
                    isWithImage
                      ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                      : 'bg-muted text-muted-foreground group-hover:text-foreground'
                  )}
                >
                  <FileCheck2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-foreground tracking-tight leading-tight">
                    Csak számlaképpel rendelkező számlák
                  </h3>
                  <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                    Szigorú számviteli bizonylatolt mód
                  </span>
                </div>
              </div>

              {/* Radio Indicator */}
              <div
                className={cn(
                  'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all',
                  isWithImage
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-muted-foreground/40 group-hover:border-muted-foreground'
                )}
              >
                {isWithImage && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed mt-2">
              Kizárólag azok a szállítói számlák és tételek szerepelnek a kalkulációkban, amelyekhez igazolt, csatolt számlakép (PDF vagy szkennelt fájl) áll rendelkezésre.
            </p>
          </div>

          {/* Card Footer badges */}
          <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-border/50 text-xs">
            <Badge
              variant="outline"
              className={cn(
                'font-mono font-medium',
                isWithImage
                  ? 'border-emerald-600/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                  : 'bg-muted/50'
              )}
            >
              {isLoading ? '...' : `${withImageCount} számlaképes`}
            </Badge>
            {missingCount > 0 && (
              <Badge
                variant="outline"
                className="font-mono text-[11px] border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
              >
                {`-${missingCount} számlakép hiányzik`}
              </Badge>
            )}
            <span className="text-[11px] text-muted-foreground">Kizárólag igazolt költségek</span>
          </div>
        </div>
      </div>

      {/* Bottom Information Bar */}
      <div className="mt-3 pt-2.5 px-1 flex flex-wrap items-center justify-between gap-2 text-xs border-t border-border/40">
        {missingCount > 0 ? (
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>
              <strong>{missingCount} db</strong> bejövő számlához még nem érkezett feltöltött számlakép az Online Számlából.
              {isWithImage && ' Ezek a tételek a szigorú beállítás miatt jelenleg nem szerepelnek a levonható adóban.'}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>
              <strong>Tökéletes egyezés:</strong> Minden Online Számlából érkező bejövő számlához rendelkezésre áll a feltöltött bizonylatkép.
            </span>
          </div>
        )}

        <div className="text-[11px] text-muted-foreground ml-auto">
          Aktív szűrő: <strong className="text-foreground">{isAll ? 'Minden számla (OSA + Kép)' : 'Csak számlaképes'}</strong>
        </div>
      </div>
    </div>
  );
}
