import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { GlToolbar } from '../GlToolbar';

describe('GlToolbar', () => {
  const defaultProps = {
    activePresetId: 'p-1',
    presets: [
      { id: 'p-1', name: 'Alapértelmezett számlatükör' },
      { id: 'p-2', name: 'számla_hr' },
    ],
    isPresetsLoading: false,
    isPresetsPending: false,
    isCroatia: false,
    selectedCompanyName: 'Acme Kft.',
    isAIRunning: false,
    onSelectPreset: vi.fn(),
    onOpenManagePresets: vi.fn(),
    onOpenUploadPreset: vi.fn(),
    onOpenAddAccount: vi.fn(),
    onOpenManualEntry: vi.fn(),
    onOpenUploadAuditXml: vi.fn(),
    onOpenAuditHistory: vi.fn(),
    onRunAI: vi.fn(),
    onShowPrintPreview: vi.fn(),
    onPrint: vi.fn(),
    onExportExcel: vi.fn(),
    onExportAnalyticalExcel: vi.fn(),
  };

  it('renders presets selector and main action buttons', () => {
    render(<GlToolbar {...defaultProps} />);

    expect(screen.getByText('Aktív Számlatükör:')).toBeInTheDocument();
    expect(screen.getByText('Vegyes bizonylat')).toBeInTheDocument();
    expect(screen.getByText('Új főkönyvi szám')).toBeInTheDocument();
    expect(screen.getByText('XML Import')).toBeInTheDocument();
    expect(screen.getByText('AI Besorolás')).toBeInTheDocument();
    expect(screen.getByText('Export')).toBeInTheDocument();
  });

  it('triggers onOpenManualEntry when clicking Vegyes bizonylat', () => {
    render(<GlToolbar {...defaultProps} />);

    fireEvent.click(screen.getByText('Vegyes bizonylat'));
    expect(defaultProps.onOpenManualEntry).toHaveBeenCalledTimes(1);
  });

  it('triggers onOpenAddAccount when clicking Új főkönyvi szám', () => {
    render(<GlToolbar {...defaultProps} />);

    fireEvent.click(screen.getByText('Új főkönyvi szám'));
    expect(defaultProps.onOpenAddAccount).toHaveBeenCalledTimes(1);
  });

  it('triggers onRunAI when clicking AI Besorolás', () => {
    render(<GlToolbar {...defaultProps} />);

    fireEvent.click(screen.getByText('AI Besorolás'));
    expect(defaultProps.onRunAI).toHaveBeenCalledTimes(1);
  });
});
