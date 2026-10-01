import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { UploadChartOfAccountsModal } from '../UploadChartOfAccountsModal';

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

vi.mock('@/contexts/CompanyContext', () => ({
  useCompany: () => ({
    selectedCompany: { id: 'test-comp-1', name: 'Mandala Fogadó Kft' },
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultVal?: string) => defaultVal || key,
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'mock-preset-1' }, error: null }),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
    })),
  },
}));

describe('UploadChartOfAccountsModal', () => {
  const onOpenChange = vi.fn();
  const onSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders DialogContent with wider sm:max-w-lg class', () => {
    const { getByRole } = render(
      <UploadChartOfAccountsModal open={true} onOpenChange={onOpenChange} onSuccess={onSuccess} />
    );

    const dialog = getByRole('dialog');
    expect(dialog.className).toContain('sm:max-w-lg');
  });

  it('initially has the upload/save button disabled when no file and name are set', () => {
    render(
      <UploadChartOfAccountsModal open={true} onOpenChange={onOpenChange} onSuccess={onSuccess} />
    );

    const submitBtn = screen.getByRole('button', { name: /upload_save/i });
    expect(submitBtn).toBeDisabled();
  });

  it('auto-populates preset name and enables submit button when a file is selected', async () => {
    const { container } = render(
      <UploadChartOfAccountsModal open={true} onOpenChange={onOpenChange} onSuccess={onSuccess} />
    );

    const fileInput = document.body.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).not.toBeNull();

    const longFileName = 'Számlaszámok Mandala Fogadó Kft 20260930_094657.xlsx';
    const fakeFile = new File(['mock content'], longFileName, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    fireEvent.change(fileInput, { target: { files: [fakeFile] } });

    // Verify name input is auto-filled
    const nameInput = screen.getByLabelText(/preset_name/i) as HTMLInputElement;
    expect(nameInput.value).toBe('Számlaszámok Mandala Fogadó Kft 20260930_094657');

    // Verify file preview is rendered with min-w-0 for flex truncation
    const fileTextEl = screen.getByText(longFileName);
    expect(fileTextEl).toBeInTheDocument();
    expect(fileTextEl.closest('.min-w-0')).not.toBeNull();

    // Verify submit button is now enabled
    const submitBtn = screen.getByRole('button', { name: /upload_save/i });
    expect(submitBtn).not.toBeDisabled();
  });
});
