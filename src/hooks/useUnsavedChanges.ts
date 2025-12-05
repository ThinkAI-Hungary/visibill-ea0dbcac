import { useState, useEffect, useCallback, useRef } from 'react';
import { useBlocker } from 'react-router-dom';

export function useUnsavedChanges(hasChanges: boolean) {
  const [showDialog, setShowDialog] = useState(false);
  const pendingNavigation = useRef<(() => void) | null>(null);

  // Block navigation when there are unsaved changes
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hasChanges && currentLocation.pathname !== nextLocation.pathname
  );

  useEffect(() => {
    if (blocker.state === 'blocked') {
      setShowDialog(true);
    }
  }, [blocker.state]);

  // Handle browser back/forward and tab close
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges]);

  const confirmNavigation = useCallback(() => {
    setShowDialog(false);
    if (blocker.state === 'blocked') {
      blocker.proceed();
    }
  }, [blocker]);

  const cancelNavigation = useCallback(() => {
    setShowDialog(false);
    if (blocker.state === 'blocked') {
      blocker.reset();
    }
  }, [blocker]);

  return {
    showDialog,
    confirmNavigation,
    cancelNavigation,
  };
}
