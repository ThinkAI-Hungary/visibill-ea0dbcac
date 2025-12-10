import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export function useUnsavedChanges(hasChanges: boolean) {
  const [showDialog, setShowDialog] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

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

  // Intercept link clicks only when there are unsaved changes
  useEffect(() => {
    if (!hasChanges) return; // Don't add listener if no changes
    
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a');
      
      if (link && link.href) {
        const url = new URL(link.href);
        // Only intercept internal navigation
        if (url.origin === window.location.origin && url.pathname !== location.pathname) {
          e.preventDefault();
          e.stopPropagation();
          setPendingPath(url.pathname);
          setShowDialog(true);
        }
      }
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [hasChanges, location.pathname]);

  const confirmNavigation = useCallback(() => {
    setShowDialog(false);
    if (pendingPath) {
      navigate(pendingPath);
      setPendingPath(null);
    }
  }, [navigate, pendingPath]);

  const cancelNavigation = useCallback(() => {
    setShowDialog(false);
    setPendingPath(null);
  }, []);

  // Helper to navigate with check
  const safeNavigate = useCallback((path: string) => {
    if (hasChanges) {
      setPendingPath(path);
      setShowDialog(true);
    } else {
      navigate(path);
    }
  }, [hasChanges, navigate]);

  return {
    showDialog,
    confirmNavigation,
    cancelNavigation,
    safeNavigate,
  };
}
