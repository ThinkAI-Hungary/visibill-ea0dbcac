import { useState, useEffect } from 'react';
import { Cookie, X, Settings, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const COOKIE_CONSENT_KEY = 'accounty_cookie_consent';
const COOKIE_CONSENT_VERSION = '1.0';

export interface CookiePreferences {
  necessary: boolean; // Always true
  analytics: boolean;
  functional: boolean;
  version: string;
  acceptedAt: string;
}

function getStoredConsent(): CookiePreferences | null {
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.version !== COOKIE_CONSENT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

function storeConsent(prefs: CookiePreferences) {
  localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(prefs));
}

/** Check if cookie consent has been given (for GDPR auto-detect) */
export function hasCookieConsent(): boolean {
  return getStoredConsent() !== null;
}

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [functional, setFunctional] = useState(true);

  useEffect(() => {
    const existing = getStoredConsent();
    if (!existing) {
      // Small delay so banner slides in smoothly
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  const accept = (all: boolean) => {
    const prefs: CookiePreferences = {
      necessary: true,
      analytics: all ? true : analytics,
      functional: all ? true : functional,
      version: COOKIE_CONSENT_VERSION,
      acceptedAt: new Date().toISOString(),
    };
    storeConsent(prefs);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className={cn(
      "fixed bottom-0 left-0 right-0 z-[9999] p-4 transition-all duration-500",
      visible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
    )}>
      <div className="max-w-2xl mx-auto bg-slate-900 dark:bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden">
        {/* Main bar */}
        <div className="p-5">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-amber-500/20 rounded-xl shrink-0">
              <Cookie className="w-5 h-5 text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-white">Süti beállítások</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Az eaisybooks sütiket használ a működéshez és a felhasználói élmény javításához.
                Az „Összes elfogadása" gombra kattintva hozzájárulsz az összes süti használatához.
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 mt-4">
            <button
              onClick={() => accept(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-white text-xs font-bold rounded-lg transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              Összes elfogadása
            </button>
            <button
              onClick={() => accept(false)}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-bold rounded-lg transition-colors"
            >
              Csak szükségesek
            </button>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-1.5 px-3 py-2 text-slate-400 hover:text-white text-xs font-medium transition-colors ml-auto"
            >
              <Settings className="w-3.5 h-3.5" />
              Testreszabás
            </button>
          </div>
        </div>

        {/* Detailed settings */}
        <div className={cn(
          "overflow-hidden transition-all duration-300",
          showDetails ? "max-h-[400px]" : "max-h-0"
        )}>
          <div className="px-5 pb-5 pt-3 border-t border-slate-700 space-y-3">
            {[
              { id: 'necessary', label: 'Szükséges sütik', desc: 'Az alkalmazás alapvető működéséhez szükséges (pl. bejelentkezés, munkamenet)', checked: true, disabled: true },
              { id: 'functional', label: 'Funkcionális sütik', desc: 'Felhasználói beállítások megjegyzése (pl. téma, nyelv, szűrők)', checked: functional, disabled: false },
              { id: 'analytics', label: 'Analitikai sütik', desc: 'Használati statisztikák gyűjtése a termék fejlesztéséhez', checked: analytics, disabled: false },
            ].map(cookie => (
              <label
                key={cookie.id}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer",
                  cookie.checked
                    ? "bg-slate-800 border-primary/30"
                    : "bg-slate-800/50 border-slate-700 hover:border-slate-600",
                  cookie.disabled && "cursor-default"
                )}
              >
                <input
                  type="checkbox"
                  checked={cookie.checked}
                  disabled={cookie.disabled}
                  onChange={() => {
                    if (cookie.id === 'functional') setFunctional(!functional);
                    if (cookie.id === 'analytics') setAnalytics(!analytics);
                  }}
                  className="mt-0.5 accent-primary"
                />
                <div>
                  <p className="text-xs font-bold text-white flex items-center gap-2">
                    {cookie.label}
                    {cookie.disabled && <span className="text-[9px] text-slate-500 font-normal">(kötelező)</span>}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{cookie.desc}</p>
                </div>
              </label>
            ))}

            <button
              onClick={() => accept(false)}
              className="w-full px-4 py-2 bg-primary hover:bg-primary/90 text-white text-xs font-bold rounded-lg transition-colors"
            >
              Kiválasztottak mentése
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
