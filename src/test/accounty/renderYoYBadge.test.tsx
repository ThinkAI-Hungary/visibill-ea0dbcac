import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderYoYBadge } from '@/pages/ProfitAndLoss';
import { render, screen } from '@testing-library/react';

// Helper to render the React element returned by renderYoYBadge and get its text content
const getBadgeText = (element: React.ReactNode) => {
  if (element === null) return null;
  const { container } = render(<>{element}</>);
  return container.textContent;
};

describe('renderYoYBadge', () => {
  // 1. Equal or zero check
  it('returns null when values are equal (no change)', () => {
    expect(renderYoYBadge(100, 100, false)).toBeNull();
    expect(renderYoYBadge(0, 0, false)).toBeNull();
  });

  it('returns null when prev is 0 (growth from zero is undefined in % terms)', () => {
    expect(renderYoYBadge(50, 0, false)).toBeNull();
  });

  // 2. Normal percentage calculations (inThousands = false)
  it('calculates positive growth correctly', () => {
    const text = getBadgeText(renderYoYBadge(150, 100, false));
    expect(text).toBe('▲50%');
  });

  it('calculates negative growth correctly', () => {
    const text = getBadgeText(renderYoYBadge(80, 100, false));
    expect(text).toBe('▼20%');
  });

  // 3. Profit / Loss transition checks (positive/negative crosses)
  it('indicates transition from loss to profit (Nyereségbe fordult)', () => {
    const text = getBadgeText(renderYoYBadge(50, -10, false));
    expect(text).toBe('Nyereségbe fordult');
  });

  it('indicates transition from profit to loss (Veszteségbe fordult)', () => {
    const text = getBadgeText(renderYoYBadge(-10, 50, false));
    expect(text).toBe('Veszteségbe fordult');
  });

  // 4. inThousands scaling checks
  it('handles inThousands = true division and rounding to zero', () => {
    // 4000 vs 2 HUF. Without scaling, 2 is not zero. With scaling inThousands, 2 HUF -> 0 E Ft.
    // Since prev scales to 0, it should return null to avoid division by zero anomalies.
    expect(renderYoYBadge(4000, 2, true)).toBeNull();
  });

  it('handles inThousands = true where both values scale to zero', () => {
    // 140 vs 120 HUF. Both scale to 0 E Ft.
    // Since they are equal, it should return null instead of displaying a YoY badge.
    expect(renderYoYBadge(140, 120, true)).toBeNull();
  });

  it('calculates correct growth when scaled values are non-zero', () => {
    // 150 000 vs 100 000 HUF. Scales to 150 vs 100 E Ft.
    const text = getBadgeText(renderYoYBadge(150000, 100000, true));
    expect(text).toBe('▲50%');
  });
});
