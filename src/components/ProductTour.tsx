import { useState, useEffect } from 'react';
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

interface ProductTourProps {
  run: boolean;
  onComplete: () => void;
}

const TOUR_STEPS: Step[] = [
  {
    target: 'body',
    content: 'Ez egy gyors bemutató, hogy megismerje a rendszer főbb funkcióit.',
    title: 'Üdvözöljük a Visibill-ben!',
    placement: 'center',
    disableBeacon: true,
  },
  {
    target: '[data-tour="company-selector"]',
    content: 'Itt kezelheti vállalkozásait. A legördülő menüvel válthat a cégek között, a \'+\' gombbal pedig újat adhat hozzá.',
    title: 'Cégválasztó',
    disableBeacon: true,
  },
  {
    target: '[data-tour="dashboard"]',
    content: 'Itt láthatja a kiválasztott cég pénzügyi helyzetét egy pillantás alatt.',
    title: 'Irányítópult',
    disableBeacon: true,
  },
  {
    target: '[data-tour="categories"]',
    content: 'Kezelje a kiadási és bevételi kategóriákat.',
    title: 'Kategóriák',
    disableBeacon: true,
  },
  {
    target: '[data-tour="projects"]',
    content: 'Kövesse nyomon a projektjei pénzügyeit.',
    title: 'Projektek',
    disableBeacon: true,
  },
  {
    target: '[data-tour="partners"]',
    content: 'Itt kezelheti az ügyfelei és beszállítói adatait.',
    title: 'Partnertörzs',
    disableBeacon: true,
  },
  {
    target: '[data-tour="invoices"]',
    content: 'Itt találja a bejövő és kimenő számláit listázva.',
    title: 'Számlák',
    disableBeacon: true,
  },
  {
    target: '[data-tour="upload"]',
    content: 'Töltsön fel új számlákat kézzel vagy emailben.',
    title: 'Feltöltés',
    disableBeacon: true,
  },
  {
    target: '[data-tour="salaries"]',
    content: 'Kezelje a bérszámfejtési adatokat és járulékokat.',
    title: 'Bérek/járulékok',
    disableBeacon: true,
  },
  {
    target: '[data-tour="integrations"]',
    content: 'Kapcsolja össze a rendszert külső szoftverekkel.',
    title: 'Integrációk',
    disableBeacon: true,
  },
  {
    target: '[data-tour="exchange-rates"]',
    content: 'Aktuális devizaárfolyamok megtekintése.',
    title: 'Árfolyamok',
    disableBeacon: true,
  },
  {
    target: '[data-tour="subscription"]',
    content: 'Itt kezelheti a csomagját és számlázási adatait.',
    title: 'Előfizetés',
    disableBeacon: true,
  },
  {
    target: 'body',
    content: 'Köszönjük hogy időt szánt a Visibill funkcióinak megismerésére. Jó munkát!',
    title: 'Készen is vagyunk!',
    placement: 'center',
    disableBeacon: true,
  },
];

const FINAL_STEP_INDEX = TOUR_STEPS.length - 1;

export function ProductTour({ run, onComplete }: ProductTourProps) {
  const { user } = useAuth();
  const [stepIndex, setStepIndex] = useState(0);

  // Reset step index when tour starts
  useEffect(() => {
    if (run) {
      setStepIndex(0);
    }
  }, [run]);

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
        } catch (error) {
          console.error('Failed to update tour status:', error);
        }
      }
      onComplete();
      return;
    }
    
    // Skip button clicked → jump to final step
    if (action === ACTIONS.SKIP) {
      setStepIndex(FINAL_STEP_INDEX);
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
        } catch (error) {
          console.error('Failed to update tour status:', error);
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
      steps={TOUR_STEPS}
      run={run}
      stepIndex={stepIndex}
      continuous
      callback={handleJoyrideCallback}
      tooltipComponent={ProductTourTooltip}
      spotlightClicks={false}
      disableOverlayClose
      scrollToFirstStep
      disableScrolling={false}
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
