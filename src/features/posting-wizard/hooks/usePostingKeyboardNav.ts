import { useEffect, useCallback } from 'react';
import type { PostingItem } from '../types';

interface KeyboardNavProps {
  items: PostingItem[];
  focusedItemId: string | null;
  setFocusedItemId: (id: string | null) => void;
  onToggleApproval: (itemId: string) => void;
  onBatchSubmit: () => void;
  isBatchFullyApproved: boolean;
  enabled?: boolean;
}

export function usePostingKeyboardNav({
  items,
  focusedItemId,
  setFocusedItemId,
  onToggleApproval,
  onBatchSubmit,
  isBatchFullyApproved,
  enabled = true,
}: KeyboardNavProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      // Do not intercept keystrokes if the user is typing in an input or select
      const activeEl = document.activeElement;
      const isInput =
        activeEl?.tagName === 'INPUT' ||
        activeEl?.tagName === 'TEXTAREA' ||
        activeEl?.getAttribute('role') === 'combobox' ||
        activeEl?.tagName === 'SELECT';

      // 1. Ctrl + Enter: Trigger batch confirmation dialog
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        onBatchSubmit();
        return;
      }

      // If user is inside an input, let regular keys pass
      if (isInput) return;

      // 2. Space: Toggle approval on currently focused item
      if (e.key === ' ' || e.code === 'Space') {
        if (focusedItemId) {
          e.preventDefault();
          onToggleApproval(focusedItemId);
        }
        return;
      }

      // 3. ArrowDown: Navigate down to next item
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (items.length === 0) return;
        if (!focusedItemId) {
          setFocusedItemId(items[0].item_id);
          return;
        }
        const currentIndex = items.findIndex((i) => i.item_id === focusedItemId);
        if (currentIndex < items.length - 1) {
          setFocusedItemId(items[currentIndex + 1].item_id);
        }
        return;
      }

      // 4. ArrowUp: Navigate up to previous item
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (items.length === 0) return;
        if (!focusedItemId) {
          setFocusedItemId(items[0].item_id);
          return;
        }
        const currentIndex = items.findIndex((i) => i.item_id === focusedItemId);
        if (currentIndex > 0) {
          setFocusedItemId(items[currentIndex - 1].item_id);
        }
        return;
      }
    },
    [enabled, items, focusedItemId, setFocusedItemId, onToggleApproval, onBatchSubmit]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}
