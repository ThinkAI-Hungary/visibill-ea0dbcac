import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface StickyHorizontalScrollbarProps {
  /**
   * Ref to the scrollable container element (e.g. <div className="overflow-x-auto">).
   */
  targetRef?: React.RefObject<HTMLElement | null>;
  /**
   * Direct DOM element reference (useful with state/callback refs).
   */
  target?: HTMLElement | null;
  /**
   * Optional dependencies to trigger geometry re-evaluation (e.g. [invoices.length, loading]).
   */
  dependencies?: React.DependencyList;
  /**
   * Additional class names for the floating container.
   */
  className?: string;
  /**
   * Whether to display quick scroll arrow buttons (<, >). Default: true.
   */
  showControls?: boolean;
  /**
   * Offset in px from the bottom of the viewport. Default: 0.
   */
  bottomOffset?: number;
}

export function StickyHorizontalScrollbar({
  targetRef,
  target,
  dependencies = [],
  className,
  showControls = true,
  bottomOffset = 0,
}: StickyHorizontalScrollbarProps) {
  const dummyScrollerRef = useRef<HTMLDivElement | null>(null);
  const isSyncingRef = useRef(false);

  const [state, setState] = useState<{
    isVisible: boolean;
    scrollWidth: number;
    clientWidth: number;
    scrollLeft: number;
    left: number;
    width: number;
  }>({
    isVisible: false,
    scrollWidth: 0,
    clientWidth: 0,
    scrollLeft: 0,
    left: 0,
    width: 0,
  });

  const [dummyClientWidth, setDummyClientWidth] = useState<number>(0);

  const getElement = useCallback((): HTMLElement | null => {
    const rawEl = target || (targetRef ? targetRef.current : null);
    if (!rawEl) return null;

    // 1. If rawEl itself has horizontal scroll overflow, that's our target
    if (rawEl.scrollWidth > rawEl.clientWidth + 1) {
      return rawEl;
    }

    // 2. Otherwise, find the inner element with horizontal overflow (e.g. shadcn Table's inner div)
    const candidates = rawEl.querySelectorAll<HTMLElement>('.overflow-x-auto, div, table');
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      if (candidate.scrollWidth > candidate.clientWidth + 1) {
        return candidate;
      }
    }

    // 3. Fallback: if there is an inner .overflow-x-auto div (from shadcn Table), prefer it
    const innerOverflowDiv = rawEl.querySelector<HTMLElement>('.overflow-x-auto');
    if (innerOverflowDiv) {
      return innerOverflowDiv;
    }

    return rawEl;
  }, [target, targetRef]);

  const updateGeometry = useCallback(() => {
    const el = getElement();
    if (!el) {
      setState(prev => (prev.isVisible ? { ...prev, isVisible: false } : prev));
      return;
    }

    const rect = el.getBoundingClientRect();
    const hasOverflow = el.scrollWidth > el.clientWidth + 1;
    const windowHeight = window.innerHeight;

    // Visible in viewport if the table intersects the visible screen area
    const isInViewport = rect.top < windowHeight && rect.bottom > 60;
    const shouldShow = hasOverflow && isInViewport;

    setState({
      isVisible: shouldShow,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      scrollLeft: el.scrollLeft,
      left: Math.max(0, rect.left),
      width: rect.width,
    });

    if (dummyScrollerRef.current) {
      const dw = dummyScrollerRef.current.clientWidth;
      if (dw > 0 && dw !== dummyClientWidth) {
        setDummyClientWidth(dw);
      }
      if (!isSyncingRef.current) {
        dummyScrollerRef.current.scrollLeft = el.scrollLeft;
      }
    }
  }, [getElement, dummyClientWidth]);

  // Re-run whenever target, dependencies, or mount changes
  useEffect(() => {
    let cancelRaf = false;
    let ro: ResizeObserver | null = null;
    let mo: MutationObserver | null = null;
    let mainContainer: HTMLElement | null = null;
    let targetEl: HTMLElement | null = null;

    const setup = (el: HTMLElement) => {
      targetEl = el;

      // Initial layout update
      updateGeometry();

      // Also schedule a microtask & short timeout to catch layout after images/fonts/data render
      setTimeout(updateGeometry, 50);
      setTimeout(updateGeometry, 250);

      // Scroll listener on target itself (for trackpad / Shift + Wheel / arrow key scrolling)
      const handleTargetScroll = () => {
        if (isSyncingRef.current) return;
        isSyncingRef.current = true;
        if (dummyScrollerRef.current && targetEl) {
          dummyScrollerRef.current.scrollLeft = targetEl.scrollLeft;
        }
        setState(prev => ({
          ...prev,
          scrollLeft: targetEl ? targetEl.scrollLeft : prev.scrollLeft,
        }));
        requestAnimationFrame(() => {
          isSyncingRef.current = false;
        });
      };

      el.addEventListener('scroll', handleTargetScroll, { passive: true });

      // Viewport scroll listeners
      const handleViewportScroll = () => {
        updateGeometry();
      };

      window.addEventListener('scroll', handleViewportScroll, { passive: true });
      window.addEventListener('resize', handleViewportScroll);

      mainContainer = el.closest('main') || document.querySelector('main');
      if (mainContainer) {
        mainContainer.addEventListener('scroll', handleViewportScroll, { passive: true });
      }

      // ResizeObserver on target and inner table
      if (typeof ResizeObserver !== 'undefined') {
        ro = new ResizeObserver(() => {
          updateGeometry();
        });
        ro.observe(el);
        const innerTable = el.querySelector('table') || el.firstElementChild;
        if (innerTable) {
          ro.observe(innerTable);
        }

        if (dummyScrollerRef.current) {
          const dummyRo = new ResizeObserver(entries => {
            for (const entry of entries) {
              const width = entry.contentRect.width || (entry.target as HTMLElement).clientWidth;
              if (width > 0) setDummyClientWidth(width);
            }
          });
          dummyRo.observe(dummyScrollerRef.current);
          const origRoDisconnect = ro.disconnect.bind(ro);
          ro.disconnect = () => {
            origRoDisconnect();
            dummyRo.disconnect();
          };
        }
      }

      // MutationObserver on target to immediately catch rendered rows
      if (typeof MutationObserver !== 'undefined') {
        mo = new MutationObserver(() => {
          updateGeometry();
        });
        mo.observe(el, { childList: true, subtree: true });
      }

      return () => {
        el.removeEventListener('scroll', handleTargetScroll);
        window.removeEventListener('scroll', handleViewportScroll);
        window.removeEventListener('resize', handleViewportScroll);
        if (mainContainer) {
          mainContainer.removeEventListener('scroll', handleViewportScroll);
        }
        if (ro) ro.disconnect();
        if (mo) mo.disconnect();
      };
    };

    let cleanupFn: (() => void) | undefined;

    // Retry checking for element if targetRef is not yet attached
    const tryConnect = () => {
      if (cancelRaf) return;
      const el = getElement();
      if (el) {
        cleanupFn = setup(el);
      } else {
        requestAnimationFrame(tryConnect);
      }
    };

    tryConnect();

    return () => {
      cancelRaf = true;
      if (cleanupFn) cleanupFn();
    };
  }, [getElement, updateGeometry, ...dependencies]);

  // Handle user dragging or scrolling the sticky scrollbar
  const handleDummyScroll = () => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    const el = getElement();
    if (el && dummyScrollerRef.current) {
      el.scrollLeft = dummyScrollerRef.current.scrollLeft;
    }
    setState(prev => ({
      ...prev,
      scrollLeft: dummyScrollerRef.current ? dummyScrollerRef.current.scrollLeft : prev.scrollLeft,
    }));
    requestAnimationFrame(() => {
      isSyncingRef.current = false;
    });
  };

  // Quick scroll actions
  const scrollByAmount = (amount: number) => {
    const el = getElement();
    if (!el) return;
    el.scrollBy({ left: amount, behavior: 'smooth' });
  };

  const scrollToEdge = (edge: 'start' | 'end') => {
    const el = getElement();
    if (!el) return;
    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
    const targetScroll = edge === 'start' ? 0 : maxScroll;
    el.scrollTo({ left: targetScroll, behavior: 'smooth' });
  };

  if (!state.isVisible || typeof document === 'undefined') {
    return null;
  }

  const maxTableScroll = Math.max(0, state.scrollWidth - state.clientWidth);
  const effectiveDummyWidth = dummyClientWidth || (dummyScrollerRef.current?.clientWidth ?? (state.width > 240 ? state.width - 240 : state.width));
  const spacerWidth = effectiveDummyWidth + maxTableScroll;

  const isAtStart = state.scrollLeft <= 2;
  const isAtEnd = state.scrollLeft >= maxTableScroll - 4;

  const content = (
    <div
      data-testid="sticky-horizontal-scrollbar"
      style={{
        left: `${state.left}px`,
        width: `${state.width}px`,
        bottom: `${bottomOffset}px`,
      }}
      className={cn(
        'fixed z-40 flex items-center gap-1.5 px-3 py-1.5',
        'bg-background/95 dark:bg-card/95 backdrop-blur-md',
        'border-t border-x border-border/80 shadow-2xl rounded-t-xl',
        'transition-all duration-200 ease-out select-none',
        className
      )}
    >
      {showControls && (
        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground disabled:opacity-30"
            disabled={isAtStart}
            onClick={() => scrollToEdge('start')}
            title="Ugrás az elejére"
          >
            <ChevronsLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground disabled:opacity-30"
            disabled={isAtStart}
            onClick={() => scrollByAmount(-250)}
            title="Görgetés balra"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Sync scroller track */}
      <div
        ref={dummyScrollerRef}
        onScroll={handleDummyScroll}
        className="flex-1 overflow-x-scroll overflow-y-hidden h-5 cursor-pointer"
        style={{
          scrollbarWidth: 'auto',
        }}
      >
        <div
          style={{
            width: `${spacerWidth}px`,
            height: '1px',
            minWidth: `${spacerWidth}px`,
          }}
        />
      </div>

      {showControls && (
        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground disabled:opacity-30"
            disabled={isAtEnd}
            onClick={() => scrollByAmount(250)}
            title="Görgetés jobbra (Tételek, Számlakép)"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground disabled:opacity-30"
            disabled={isAtEnd}
            onClick={() => scrollToEdge('end')}
            title="Ugrás a végére (Tételek, Számlakép)"
          >
            <ChevronsRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Keyboard hint */}
      <div className="hidden md:flex items-center text-[10px] text-muted-foreground/70 font-medium px-1 shrink-0 border-l border-border/50 pl-2">
        <span className="bg-muted/80 px-1 py-0.5 rounded text-[9px] font-mono mr-1">Shift</span> + görgő
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
