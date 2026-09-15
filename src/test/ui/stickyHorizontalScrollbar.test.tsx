import { describe, it, expect, vi, beforeAll } from 'vitest';
import React, { useRef } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { StickyHorizontalScrollbar } from '@/components/ui/sticky-horizontal-scrollbar';

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

function TestHarness({
  scrollWidth = 2000,
  clientWidth = 1000,
  top = 100,
  bottom = 1200, // window.innerHeight defaults to 768 in jsdom, so 1200 is offscreen
  bottomOffset = 0,
}: {
  scrollWidth?: number;
  clientWidth?: number;
  top?: number;
  bottom?: number;
  bottomOffset?: number;
}) {
  const targetRef = useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    if (targetRef.current) {
      Object.defineProperty(targetRef.current, 'scrollWidth', { value: scrollWidth, configurable: true });
      Object.defineProperty(targetRef.current, 'clientWidth', { value: clientWidth, configurable: true });
      Object.defineProperty(targetRef.current, 'scrollLeft', { value: 0, writable: true, configurable: true });
      targetRef.current.getBoundingClientRect = vi.fn().mockReturnValue({
        top,
        bottom,
        left: 200,
        right: 1200,
        width: clientWidth,
        height: bottom - top,
      });
      targetRef.current.scrollBy = vi.fn();
      targetRef.current.scrollTo = vi.fn();
    }
  }, [scrollWidth, clientWidth, top, bottom]);

  return (
    <div>
      <div ref={targetRef} data-testid="target-container" style={{ width: clientWidth, overflowX: 'auto' }}>
        <div style={{ width: scrollWidth, height: 50 }}>Table Content</div>
      </div>
      <StickyHorizontalScrollbar targetRef={targetRef} bottomOffset={bottomOffset} />
    </div>
  );
}

describe('StickyHorizontalScrollbar', () => {
  it('does not render when target has no horizontal overflow', () => {
    render(<TestHarness scrollWidth={1000} clientWidth={1000} />);
    expect(screen.queryByTestId('sticky-horizontal-scrollbar')).not.toBeInTheDocument();
  });

  it('does not render when target is completely scrolled outside viewport', () => {
    // top is below window.innerHeight (e.g. 1500)
    render(<TestHarness scrollWidth={2000} clientWidth={1000} top={1500} bottom={2500} />);
    expect(screen.queryByTestId('sticky-horizontal-scrollbar')).not.toBeInTheDocument();
  });

  it('renders when target has overflow and bottom extends below viewport', () => {
    render(<TestHarness scrollWidth={2000} clientWidth={1000} bottom={1200} />);
    const bar = screen.getByTestId('sticky-horizontal-scrollbar');
    expect(bar).toBeInTheDocument();
    expect(bar).toHaveStyle({ left: '200px', width: '1000px', bottom: '0px' });
  });

  it('applies custom bottomOffset when passed (e.g. for bulk actions bar)', () => {
    render(<TestHarness scrollWidth={2000} clientWidth={1000} bottom={1200} bottomOffset={76} />);
    const bar = screen.getByTestId('sticky-horizontal-scrollbar');
    expect(bar).toBeInTheDocument();
    expect(bar).toHaveStyle({ bottom: '76px' });
  });

  it('calls scrollBy on target when right scroll button is clicked', () => {
    render(<TestHarness scrollWidth={2000} clientWidth={1000} bottom={1200} />);
    const rightBtn = screen.getByTitle('Görgetés jobbra (Tételek, Számlakép)');
    expect(rightBtn).toBeInTheDocument();
    fireEvent.click(rightBtn);

    const target = screen.getByTestId('target-container');
    expect(target.scrollBy).toHaveBeenCalledWith({ left: 250, behavior: 'smooth' });
  });

  it('calls scrollTo edge on target when jump to end button is clicked', () => {
    render(<TestHarness scrollWidth={2000} clientWidth={1000} bottom={1200} />);
    const jumpEndBtn = screen.getByTitle('Ugrás a végére (Tételek, Számlakép)');
    expect(jumpEndBtn).toBeInTheDocument();
    fireEvent.click(jumpEndBtn);

    const target = screen.getByTestId('target-container');
    expect(target.scrollTo).toHaveBeenCalledWith({ left: 1000, behavior: 'smooth' });
  });
});
