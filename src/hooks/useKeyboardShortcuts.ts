import { useEffect, useCallback } from 'react';

type KeyCombo = {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
};

type ShortcutHandler = {
  combo: KeyCombo;
  handler: () => void;
  /** Prevent default browser behavior */
  preventDefault?: boolean;
  /** Description for accessibility / help dialog */
  description?: string;
};

/**
 * Register keyboard shortcuts for a page.
 *
 * @example
 * useKeyboardShortcuts([
 *   { combo: { key: 's', ctrl: true }, handler: handleSave, preventDefault: true, description: 'Mentés' },
 *   { combo: { key: 'p', ctrl: true }, handler: handlePrint, preventDefault: true, description: 'Nyomtatás' },
 *   { combo: { key: 'Escape' }, handler: handleClose, description: 'Bezárás' },
 * ]);
 */
export function useKeyboardShortcuts(shortcuts: ShortcutHandler[]) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't fire shortcuts when typing in inputs/textareas
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        // Allow Escape even in inputs
        if (e.key !== 'Escape') return;
      }

      for (const shortcut of shortcuts) {
        const { combo, handler, preventDefault = true } = shortcut;

        const ctrlMatch = combo.ctrl ? (e.ctrlKey || e.metaKey) : !e.ctrlKey && !e.metaKey;
        const shiftMatch = combo.shift ? e.shiftKey : !e.shiftKey;
        const altMatch = combo.alt ? e.altKey : !e.altKey;
        const keyMatch = e.key.toLowerCase() === combo.key.toLowerCase();

        if (ctrlMatch && shiftMatch && altMatch && keyMatch) {
          if (preventDefault) e.preventDefault();
          handler();
          return;
        }
      }
    },
    [shortcuts]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
