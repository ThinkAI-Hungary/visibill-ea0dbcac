import { useState, useEffect, useMemo } from 'react';
import Joyride, { 
  CallBackProps, 
  STATUS, 
  Step, 
  ACTIONS,
  EVENTS
} from 'react-joyride';
import { useAuth } from '@/contexts/AuthContext';
import { ProductTourTooltip } from '../../ProductTourTooltip';

interface AccountyTourProps {
  run: boolean;
  onComplete: () => void;
}

export default function AccountyTour({ run, onComplete }: AccountyTourProps) {
  const { user } = useAuth();
  const [stepIndex, setStepIndex] = useState(0);

  // Reset step index when tour starts
  useEffect(() => {
    if (run) {
      setStepIndex(0);
    }
  }, [run]);

  // Build steps list
  const steps = useMemo<Step[]>(() => {
    return [
      {
        target: 'body',
        content: 'Üdvözlünk az eaisyBooks modulban! Ez a gyors útmutató segít megismerni az irodai könyvelőprogram legfontosabb funkcióit.',
        title: 'eaisyBooks Bemutató',
        placement: 'center',
        disableBeacon: true,
      },
      {
        target: '[data-tour="app-mode-switcher"]',
        content: 'Itt tudsz bármikor visszaváltani a eaisyBill (számlázó/pénzügyi) modulra.',
        title: 'Modulváltó',
        placement: 'right',
        disableBeacon: true,
      },
      {
        target: '[data-tour="company-selector"]',
        content: 'Itt választhatsz ki konkrét ügyfelet a portfólióból az adott cég részletes anyagainak könyveléséhez és bérindításához, vagy visszaléphetsz a teljes irodai szinthez.',
        title: 'Ügyfélválasztó',
        placement: 'right',
        disableBeacon: true,
      },
      {
        target: '[data-sidebar-nav]',
        content: 'Az oldalsávban találod a könyvelőirodai szintű áttekintést: összesített hiányzó bizonylatok, irodai naptár és határidők, riportok, és a beállítások.',
        title: 'Irodai Navigáció',
        placement: 'right',
        disableBeacon: true,
      },
      {
        target: '[data-tour="help-trigger"]',
        content: 'Bármikor segítségre van szükséged, kattints erre a súgó gombra a funkciók leírásának megtekintéséhez, vagy a bemutató újraindításához.',
        title: 'Segítség & Súgó',
        placement: 'bottom',
        disableBeacon: true,
      }
    ];
  }, []);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { action, index, status, type } = data;
    
    // Close button (X) or skip clicked → exit tour
    if (action === ACTIONS.CLOSE || action === ACTIONS.SKIP) {
      if (user) {
        localStorage.setItem(`accounty_tour_completed_${user.id}`, 'true');
      }
      onComplete();
      return;
    }
    
    // Tour finished (last step completed or tour skipped)
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      if (user) {
        localStorage.setItem(`accounty_tour_completed_${user.id}`, 'true');
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

  if (!run) return null;

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
