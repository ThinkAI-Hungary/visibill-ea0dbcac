import { useState, useEffect, useMemo } from 'react';
import Joyride, { 
  CallBackProps, 
  STATUS, 
  Step, 
  ACTIONS,
  EVENTS
} from 'react-joyride';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ProductTourTooltip } from './ProductTourTooltip';
import { reportError } from '@/lib/errorReporter';
import { useUserRole } from '@/hooks/useUserRole';
import { useSidebar } from '@/components/ui/sidebar';
import { useHasAccountyAccess } from '@/hooks/useHasEaisybillAccess';
import { useEaisybillPermissions } from '@/hooks/useEaisybillPermissions';
import { useQueryClient } from '@tanstack/react-query';

interface ProductTourProps {
  run: boolean;
  onComplete: () => void;
}

export function ProductTour({ run, onComplete }: ProductTourProps) {
  const { user } = useAuth();
  const { role, isEmployee } = useUserRole();
  const { state, setOpen } = useSidebar();
  const { hasAccess: hasAccountyAccess } = useHasAccountyAccess();
  const { canAccess } = useEaisybillPermissions();
  const queryClient = useQueryClient();
  
  const [stepIndex, setStepIndex] = useState(0);

  // Dispatch custom event "visibill:tour-active" to let AppSidebar know when tour is running
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('visibill:tour-active', { detail: run }));
    return () => {
      window.dispatchEvent(new CustomEvent('visibill:tour-active', { detail: false }));
    };
  }, [run]);

  // Open sidebar if collapsed when tour starts
  useEffect(() => {
    if (run && state === "collapsed") {
      setOpen(true);
    }
  }, [run, state, setOpen]);

  // Reset step index when tour starts
  useEffect(() => {
    if (run) {
      setStepIndex(0);
    }
  }, [run]);

  // Build dynamic steps list
  const steps = useMemo<Step[]>(() => {
    const activeSteps: Step[] = [];

    // Step 1: Welcome Overlay (Center)
    activeSteps.push({
      target: 'body',
      content: 'Ez a gyors bemutató segít megismerni a rendszer főbb funkcióit és a megújult felületet.',
      title: 'Üdvözöljük a eaisyBill-ben!',
      placement: 'center',
      disableBeacon: true,
    });

    // Step 2: App Mode Switcher (only if hasAccountyAccess is true)
    if (hasAccountyAccess) {
      activeSteps.push({
        target: '[data-tour="app-mode-switcher"]',
        content: 'Itt válthat a számlázó/pénzügyi modul (eaisyBill) és a teljes körű kettős könyvviteli modul (eaisyBooks / Accounty) között.',
        title: 'Modulváltó',
        placement: 'right',
        disableBeacon: true,
      });
    }

    // Step 3: Company Selector (only if not an employee)
    if (!isEmployee) {
      activeSteps.push({
        target: '[data-tour="company-selector"]',
        content: 'Itt válthat a vállalkozásai között, vagy regisztrálhat új céget a "+" gombbal.',
        title: 'Cégválasztó',
        placement: 'right',
        disableBeacon: true,
      });
    }

    // Step 4: Dashboard
    activeSteps.push({
      target: '[data-tour="dashboard"]',
      content: 'A cég aktuális pénzügyi helyzetét (bevételek, kiadások, ÁFA becslés) követheti itt nyomon.',
      title: 'Irányítópult',
      placement: 'right',
      disableBeacon: true,
    });

    // Step 5: Invoices (Finance group)
    activeSteps.push({
      target: '[data-tour="invoices"]',
      content: 'Itt találja a NAV-ból automatikusan szinkronizált, valamint a manuálisan feltöltött számlákat.',
      title: 'Számlák',
      placement: 'right',
      disableBeacon: true,
    });

    // Step 6: Categories (Overview group)
    activeSteps.push({
      target: '[data-tour="categories"]',
      content: 'A kiadások és bevételek kategóriákba sorolásával pontosabb pénzügyi riportokat és ÁFA kalkulációkat kaphat.',
      title: 'Kategóriák',
      placement: 'right',
      disableBeacon: true,
    });

    // Step 7: Upload (standalone)
    if (canAccess('upload')) {
      activeSteps.push({
        target: '[data-tour="upload"]',
        content: 'Ide húzva vagy e-mailben is beküldheti bizonylatait, melyeket a beépített AI motorunk automatikusan felismer és feldolgoz.',
        title: 'Bizonylat Feltöltés',
        placement: 'right',
        disableBeacon: true,
      });
    }

    // Step 8: Accounting/eaisyBooks (only if hasAccountyAccess is true)
    if (hasAccountyAccess) {
      activeSteps.push({
        target: '[data-tour="general-ledger"]',
        content: 'A Főkönyv, Eredménykimutatás, Mérleg és ÁFA bevallás menükkel a könyvelő munkáját és a cégvezetés döntéseit támogatjuk.',
        title: 'Könyvelési Riportok',
        placement: 'right',
        disableBeacon: true,
      });
    }

    // Step 9: Settings (only if not an employee)
    if (!isEmployee) {
      activeSteps.push({
        target: '[data-tour="settings"]',
        content: 'Itt konfigurálhatja a NAV Online Számla kapcsolatot, a banki szinkront, a partnereket és a felhasználókat.',
        title: 'Beállítások',
        placement: 'top',
        disableBeacon: true,
      });
    }

    // Step 10: Sidebar Collapse
    activeSteps.push({
      target: '[data-tour="sidebar-trigger"]',
      content: 'Az oldalsávot bármikor összecsukhatja ikon-módba, ha nagyobb munkaterületre van szüksége.',
      title: 'Menü elrejtése',
      placement: 'top',
      disableBeacon: true,
    });

    // Step 11: Final Overlay (Center)
    activeSteps.push({
      target: 'body',
      content: 'Sikeresen megismerte a legfontosabb területeket. Jó munkát kívánunk a rendszerben!',
      title: 'Készen is vagyunk!',
      placement: 'center',
      disableBeacon: true,
    });

    return activeSteps;
  }, [hasAccountyAccess, isEmployee, canAccess]);

  const finalStepIndex = steps.length - 1;

  const handleJoyrideCallback = async (data: CallBackProps) => {
    const { action, index, status, type } = data;
    
    // Close button (X) clicked → exit tour immediately
    if (action === ACTIONS.CLOSE) {
      if (user) {
        try {
          await supabase
            .from('profiles')
            .update({ has_completed_tour: true })
            .eq('user_id', user.id);
          await queryClient.invalidateQueries({ queryKey: ['tourStatus'] });
        } catch (error) {
          reportError({ type: 'db_query', component: 'ProductTour', action: 'error', message: 'Failed to update tour status:', error: error });
        }
      }
      onComplete();
      return;
    }
    
    // Skip button clicked → complete tour immediately
    if (action === ACTIONS.SKIP) {
      if (user) {
        try {
          await supabase
            .from('profiles')
            .update({ has_completed_tour: true })
            .eq('user_id', user.id);
          await queryClient.invalidateQueries({ queryKey: ['tourStatus'] });
        } catch (error) {
          reportError({ type: 'db_query', component: 'ProductTour', action: 'error', message: 'Failed to update tour status:', error: error });
        }
      }
      onComplete();
      return;
    }
    
    // Tour finished (last step completed or tour skipped)
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      // Only save to database when user completes/finishes the tour
      if (user) {
        try {
          await supabase
            .from('profiles')
            .update({ has_completed_tour: true })
            .eq('user_id', user.id);
          await queryClient.invalidateQueries({ queryKey: ['tourStatus'] });
        } catch (error) {
          reportError({ type: 'db_query', component: 'ProductTour', action: 'error', message: 'Failed to update tour status:', error: error });
        }
      }
      onComplete();
      return;
    }
    
    // Normal navigation - next button
    if (type === EVENTS.STEP_AFTER && action === ACTIONS.NEXT) {
      setStepIndex(index + 1);
    }
    
    // Normal navigation - back button
    if (type === EVENTS.STEP_AFTER && action === ACTIONS.PREV) {
      setStepIndex(index - 1);
    }
  };

  return (
    <Joyride
      steps={steps}
      run={run}
      stepIndex={stepIndex}
      continuous
      callback={handleJoyrideCallback}
      tooltipComponent={ProductTourTooltip}
      spotlightClicks={false}
      disableOverlayClose
      scrollToFirstStep
      disableScrolling={false}
      floaterProps={{
        disableAnimation: true,
        options: {
          modifiers: [
            {
              name: 'preventOverflow',
              options: {
                boundary: 'viewport',
                padding: 16,
              },
            },
            {
              name: 'flip',
              options: {
                boundary: 'viewport',
                padding: 16,
              },
            },
          ],
        },
      }}
      styles={{
        options: {
          zIndex: 10000,
        },
        spotlight: {
          borderRadius: 12,
        },
      }}
    />
  );
}
