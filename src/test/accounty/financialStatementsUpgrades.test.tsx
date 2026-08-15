import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PnlAiAssistant } from '@/components/pnl/PnlAiAssistant';
import { PnlSankeyChart } from '@/components/pnl/PnlSankeyChart';
import { BalanceSheetWidgets } from '@/components/balance-sheet/BalanceSheetWidgets';

describe('Financial Statements Upgrades', () => {
  describe('BalanceSheetWidgets Calculations', () => {
    it('calculates liquidity ratios correctly', () => {
      const { container } = render(
        <BalanceSheetWidgets
          totalAssets={1000000}
          totalLiabilities={1000000}
          difference={0}
          isBalanced={true}
          selectedCurrency="HUF"
          inThousands={false}
          currentAssets={500000}
          inventories={100000}
          shortTermLiabilities={200000}
          cashAssets={50000}
          unmappedAccountsCount={0}
          conversionFactor={1}
        />
      );

      // Current Ratio = 500k / 200k = 2.50
      // Quick Ratio = (500k - 100k) / 200k = 2.00
      expect(container.textContent).toContain('2.50');
      expect(container.textContent).toContain('2.00');
    });

    it('applies currency consolidation conversion factor correctly', () => {
      const { container } = render(
        <BalanceSheetWidgets
          totalAssets={1000000}
          totalLiabilities={1000000}
          difference={0}
          isBalanced={true}
          selectedCurrency="EUR"
          inThousands={false}
          currentAssets={500000}
          inventories={100000}
          shortTermLiabilities={200000}
          cashAssets={50000}
          unmappedAccountsCount={0}
          conversionFactor={1 / 400} // EUR rate is 400 HUF
        />
      );

      // Total Assets: 1,000,000 / 400 = 2500 EUR
      expect(container.textContent).toContain('2500');
    });
  });

  describe('PnlAiAssistant health diagnostics', () => {
    it('renders startup state successfully', () => {
      render(
        <PnlAiAssistant
          revenue={12000000}
          materials={4000000}
          personnel={5000000}
          depreciation={1000000}
          otherExpenses={500000}
          taxes={300000}
          netProfit={1200000}
          inThousands={true}
        />
      );

      expect(screen.getByText('AI Pénzügyi Asszisztens')).toBeDefined();
      expect(screen.getByText('Elemzés indítása')).toBeDefined();
    });
  });

  describe('PnlSankeyChart rendering', () => {
    it('renders SVG structure with node elements', () => {
      const { container } = render(
        <PnlSankeyChart
          revenue={10000000}
          otherIncome={500000}
          materials={3000000}
          personnel={4000000}
          depreciation={1000000}
          otherExpenses={500000}
          taxes={300000}
          netProfit={1200000}
          inThousands={false}
        />
      );

      const svgElement = container.querySelector('svg');
      expect(svgElement).not.toBeNull();
      expect(svgElement?.getAttribute('width')).toBe('580');
    });
  });
});
