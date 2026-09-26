import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { GlKpiBar } from '../GlKpiBar';

describe('GlKpiBar', () => {
  const sampleStats = {
    accountCount: 42,
    leafCount: 18,
    totalDebit: 1250000,
    totalCredit: 1250000,
    classifiedItems: 90,
    totalItems: 100,
  };

  beforeEach(() => {
    localStorage.clear();
  });

  it('renders compact mode by default with key financial metrics', () => {
    render(
      <GlKpiBar
        glStats={sampleStats}
        isTableLoading={false}
        currencyLabel="Ft"
        isCroatia={false}
        companyId="test-company-1"
      />
    );

    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();
    expect(screen.getByText('Főkönyvi számok:')).toBeInTheDocument();
    expect(screen.getByText('Analitikus számlák:')).toBeInTheDocument();
    expect(screen.getByText('Részletek')).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
  });

  it('toggles to expanded mode when clicking Részletek and back when clicking Kompakt nézet', () => {
    render(
      <GlKpiBar
        glStats={sampleStats}
        isTableLoading={false}
        currencyLabel="Ft"
        isCroatia={false}
        companyId="test-company-1"
      />
    );

    // Click Részletek to expand
    fireEvent.click(screen.getByText('Részletek'));

    expect(screen.getByText('Főkönyvi Összesítés')).toBeInTheDocument();
    expect(screen.getByText('Kompakt nézet')).toBeInTheDocument();
    expect(localStorage.getItem('visibill_gl_kpi_expanded_test-company-1')).toBe('true');

    // Click Kompakt nézet to collapse back
    fireEvent.click(screen.getByText('Kompakt nézet'));

    expect(screen.getByText('Részletek')).toBeInTheDocument();
    expect(localStorage.getItem('visibill_gl_kpi_expanded_test-company-1')).toBe('false');
  });

  it('renders skeleton pulse while loading', () => {
    const { container } = render(
      <GlKpiBar
        glStats={null}
        isTableLoading={true}
        currencyLabel="Ft"
        isCroatia={false}
        companyId="test-company-1"
      />
    );

    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });
});
