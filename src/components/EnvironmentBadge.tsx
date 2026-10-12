import React, { useState } from 'react';
import { SUPABASE_URL } from '@/integrations/supabase/client';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Database } from 'lucide-react';

/**
 * EnvironmentBadge — Displays active Supabase database target and local port.
 * ONLY rendered in local development (localhost / 127.0.0.1 or import.meta.env.DEV).
 * Never shown in production deployments (Vercel, Droplet).
 */
export function EnvironmentBadge() {
  const [collapsed, setCollapsed] = useState(false);

  // Only show on localhost / local development
  if (typeof window === 'undefined') return null;
  const isLocalhost =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    import.meta.env.DEV;

  if (!isLocalhost) return null;

  const isProdDb = SUPABASE_URL.includes('vxxgvdlqvvchtlmqnrqf');
  const isDevDb = SUPABASE_URL.includes('qhvcdqkqpgpdxogqqvyr');
  const projectRef = isProdDb
    ? 'vxxgvdlqvvchtlmqnrqf'
    : isDevDb
    ? 'qhvcdqkqpgpdxogqqvyr'
    : SUPABASE_URL.replace(/https?:\/\/([^.]+).*/, '$1');

  const currentPort = window.location.port || '80';

  if (collapsed) {
    return (
      <div className="fixed bottom-3 left-3 z-[99999] print:hidden">
        <button
          onClick={() => setCollapsed(false)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold shadow-lg border backdrop-blur-md transition-all ${
            isProdDb
              ? 'bg-red-950/90 text-red-200 border-red-500/60 hover:bg-red-900'
              : 'bg-emerald-950/90 text-emerald-200 border-emerald-500/60 hover:bg-emerald-900'
          }`}
          title="Kattints a részletekért"
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isProdDb ? 'bg-red-400 animate-pulse' : 'bg-emerald-400'
            }`}
          />
          <span>{isProdDb ? 'PROD DB' : 'DEV DB'}</span>
          <ChevronUp className="w-3 h-3 opacity-70" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-3 left-3 z-[99999] print:hidden">
      <div
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs shadow-2xl border backdrop-blur-md transition-all ${
          isProdDb
            ? 'bg-red-950/95 text-red-100 border-red-500/80 shadow-red-950/50'
            : 'bg-slate-900/95 text-slate-200 border-emerald-500/50 shadow-slate-950/50'
        }`}
      >
        <div className="flex items-center gap-1.5 font-semibold tracking-wide">
          {isProdDb ? (
            <>
              <AlertCircle className="w-3.5 h-3.5 text-red-400 animate-pulse" />
              <span className="text-red-300 font-extrabold">🔴 ÉLES (PROD) DB</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-300 font-bold">🟢 DEV DB</span>
            </>
          )}
        </div>

        <div className="h-3 w-px bg-white/20 mx-0.5" />

        <div className="flex items-center gap-1 font-mono text-[11px] opacity-90">
          <Database className="w-3 h-3 opacity-70" />
          <span>{projectRef}</span>
          <span className="opacity-50">:{currentPort}</span>
        </div>

        {isProdDb && (
          <span className="hidden sm:inline text-[10px] bg-red-800/80 text-white font-medium px-1.5 py-0.5 rounded">
            Valós ügyféladatok!
          </span>
        )}

        <button
          onClick={() => setCollapsed(true)}
          className="ml-1 opacity-60 hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-white/10"
          title="Minimalizálás"
        >
          <ChevronDown className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
