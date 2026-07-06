import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Eye, X, Clock, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

/**
 * SupportModeBanner — Shows an orange banner at the top of the page
 * when the current user has an active support_admin impersonation session.
 * 
 * This banner is rendered via createPortal to document.body so it
 * floats above the entire app UI.
 */
export function SupportModeBanner() {
  const { user } = useAuth();
  const { companies, selectedCompany, refreshCompanies } = useCompany();
  const [impersonatedCompany, setImpersonatedCompany] = useState<{
    companyId: string;
    companyName: string;
    startedAt: string;
  } | null>(null);
  const [stopping, setStopping] = useState(false);
  const [minutesElapsed, setMinutesElapsed] = useState(0);
  const { toast } = useToast();

  // Check if any company membership is a support_admin role
  useEffect(() => {
    if (!user) {
      setImpersonatedCompany(null);
      return;
    }

    const checkImpersonation = async () => {
      const { data: rawData, error } = await supabase
        .from('company_members')
        .select('company_id')
        .eq('user_id', user.id)
        .eq('role', 'support_admin' as any)
        .limit(1)
        .maybeSingle() as { data: { company_id: string; impersonation_started_at?: string } | null; error: any };

      if (error || !rawData) {
        setImpersonatedCompany(null);
        return;
      }

      // Don't overwrite if already tracking the same company
      setImpersonatedCompany(prev => {
        if (prev && prev.companyId === rawData.company_id) return prev;

        const startedAt = rawData.impersonation_started_at || new Date().toISOString();

        // Fetch company name asynchronously
        supabase
          .from('companies')
          .select('name')
          .eq('id', rawData.company_id)
          .single()
          .then(({ data: companyData }) => {
            setImpersonatedCompany({
              companyId: rawData.company_id,
              companyName: companyData?.name || 'Unknown',
              startedAt,
            });
          });

        // Temporary until company name arrives
        return prev || {
          companyId: rawData.company_id,
          companyName: '...',
          startedAt,
        };
      });
    };

    checkImpersonation();

    // Re-check every 30s
    const interval = setInterval(checkImpersonation, 30_000);
    return () => clearInterval(interval);
  }, [user, companies]);

  // Track elapsed minutes
  useEffect(() => {
    if (!impersonatedCompany) return;
    
    const updateElapsed = () => {
      const start = new Date(impersonatedCompany.startedAt).getTime();
      const now = Date.now();
      setMinutesElapsed(Math.floor((now - start) / 60_000));
    };
    
    updateElapsed();
    const interval = setInterval(updateElapsed, 60_000);
    return () => clearInterval(interval);
  }, [impersonatedCompany?.startedAt]);

  // Auto-warning at 25 min, auto-stop at 30 min  
  useEffect(() => {
    if (!impersonatedCompany) return;
    
    if (minutesElapsed >= 30) {
      handleStop();
    } else if (minutesElapsed >= 25) {
      toast({ title: 'Support mód hamarosan lejár!', description: `${30 - minutesElapsed} perc maradt. A session automatikusan zárul.`, variant: 'destructive' });
    }
  }, [minutesElapsed]);

  const handleStop = useCallback(async () => {
    if (!impersonatedCompany || stopping) return;
    setStopping(true);

    const companyId = impersonatedCompany.companyId;

    try {
      // Call edge function to clean up all DB rows
      const resp = await supabase.functions.invoke('impersonate-company', {
        body: { action: 'stop', companyId },
      });

      if (resp.error) {
        throw new Error(resp.error.message);
      }

      // Redirect IMMEDIATELY — do NOT clear state or refresh companies.
      // The overlay stays visible until the browser navigates away,
      // preventing any flash-back to the view-mode.
      window.location.href = `/management?sa_mode=company&sa_company=${companyId}&exit_toast=1`;
    } catch (err) {
      setStopping(false);
      toast({ title: 'Hiba a support mód leállításakor', description: (err as Error).message, variant: 'destructive' });
    }
  }, [impersonatedCompany, stopping]);

  // Inject a global style that pushes the entire app (including fixed sidebar) below the banner
  const BANNER_H = 36; // px — matches py-2 + text height
  useEffect(() => {
    if (!impersonatedCompany) return;

    const style = document.createElement('style');
    style.id = 'support-banner-offset';
    style.textContent = `
      :root { --support-banner-h: ${BANNER_H}px; }
      #root { padding-top: var(--support-banner-h) !important; }
      /* Sidebar fixed wrapper: override inset-y-0 (top:0 + bottom:0) */
      .group.peer > .fixed.inset-y-0 {
        top: var(--support-banner-h) !important;
        height: calc(100svh - var(--support-banner-h)) !important;
      }
      /* Sidebar gap placeholder */
      .group.peer > .h-svh {
        height: calc(100svh - var(--support-banner-h)) !important;
      }
    `;
    document.head.appendChild(style);

    return () => { style.remove(); };
  }, [impersonatedCompany]);

  if (!impersonatedCompany) return null;

  // Full-page loading overlay during exit — white background, stays until browser navigates
  if (stopping) {
    return createPortal(
      <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-white">
        <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
        <p className="text-slate-800 text-lg font-semibold">Kilépés a support nézetből...</p>
        <p className="text-slate-500 text-sm mt-1">Ideiglenes hozzáférések eltávolítása</p>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div
      className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-between px-4 py-2 bg-primary text-primary-foreground"
      style={{
        fontSize: '13px',
        fontWeight: 600,
        boxShadow: '0 2px 8px hsl(var(--primary) / 0.3)',
      }}
    >
      <div className="flex items-center gap-2">
        <Eye className="h-4 w-4" />
        <span>Support nézet: {impersonatedCompany.companyName}</span>
        <span className="opacity-70 flex items-center gap-1 text-xs font-normal">
          <Clock className="h-3 w-3" />
          {minutesElapsed} perc
          {minutesElapsed >= 25 && (
            <AlertTriangle className="h-3 w-3 ml-1 animate-pulse" />
          )}
        </span>
      </div>
      <Button
        size="sm"
        variant="ghost"
        onClick={handleStop}
        disabled={stopping}
        className="text-primary-foreground hover:bg-white/20 border border-white/30 h-7 text-xs gap-1.5"
      >
        <X className="h-3.5 w-3.5" />
        Kilépés a support módból
      </Button>
    </div>,
    document.body
  );
}
