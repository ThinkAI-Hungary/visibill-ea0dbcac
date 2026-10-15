import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { NavInvoiceVatSummaryCard } from '@/components/nav/NavInvoiceVatSummaryCard';
import type { InvoiceSummaryDetails } from '../../../supabase/functions/_shared/nav/types';

describe('NavInvoiceVatSummaryCard Component Tests', () => {
  it('renders normal VAT categories correctly (27% and ATK)', () => {
    const vatSummary: InvoiceSummaryDetails = {
      vatSummaries: [
        {
          vatPercentage: 0.27,
          vatRateLiteral: '27%',
          category: 'percentage',
          netAmount: 100000,
          vatAmount: 27000,
          grossAmount: 127000,
        },
        {
          category: 'out_of_scope',
          vatRateLiteral: 'Hatályon kívüli (ATK)',
          outOfScopeCase: 'ATK',
          netAmount: 48850,
          vatAmount: 0,
          grossAmount: 48850,
        },
      ],
      invoiceNetAmount: 148850,
      invoiceVatAmount: 27000,
      invoiceGrossAmount: 175850,
    };

    render(<NavInvoiceVatSummaryCard vatSummary={vatSummary} defaultExpanded={true} />);

    expect(screen.getAllByText('27%').length).toBeGreaterThan(0);
    expect(screen.getAllByText('ATK').length).toBeGreaterThan(0);
    expect(screen.queryByText('18%')).toBeNull();
  });

  it('safely handles legacy malformed summaries where vatAmount is 0 but vatPercentage was mistakenly set to 18%', () => {
    // The exact bug: 0 Ft VAT with historical blended rate of 18%
    const legacyMalformedSummary: InvoiceSummaryDetails = {
      vatSummaries: [
        {
          vatPercentage: 0.27,
          vatRateLiteral: '27%',
          category: 'percentage',
          netAmount: 100000,
          vatAmount: 27000,
          grossAmount: 127000,
        },
        {
          vatPercentage: 0.18,
          vatRateLiteral: '18%',
          category: 'percentage',
          netAmount: 48850,
          vatAmount: 0,
          grossAmount: 48850,
        },
      ],
      invoiceNetAmount: 148850,
      invoiceVatAmount: 27000,
      invoiceGrossAmount: 175850,
    };

    render(<NavInvoiceVatSummaryCard vatSummary={legacyMalformedSummary} defaultExpanded={true} />);

    // Must NOT display 18% badge
    expect(screen.queryByText('18%')).toBeNull();
    // Must display fallback safe badge
    expect(screen.getAllByText('Hatályon kívüli / Mentes (0%)').length).toBeGreaterThan(0);
  });
});
