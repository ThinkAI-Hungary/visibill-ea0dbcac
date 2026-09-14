import { describe, it, expect, vi, beforeAll } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { FloatingBulkBar, FloatingBulkBarSeparator } from '@/components/ui/floating-bulk-bar';

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

describe('FloatingBulkBar', () => {
  it('does not render when count is 0 and open is undefined', () => {
    const { container } = render(
      <FloatingBulkBar count={0} onCancel={vi.fn()} />
    );
    expect(screen.queryByTestId('floating-bulk-bar')).not.toBeInTheDocument();
    expect(container.firstChild).toBeNull();
  });

  it('does not render when open is explicitly false even if count > 0', () => {
    render(
      <FloatingBulkBar open={false} count={5} onCancel={vi.fn()} />
    );
    expect(screen.queryByTestId('floating-bulk-bar')).not.toBeInTheDocument();
  });

  it('renders correctly with count, default label and itemUnit', () => {
    render(
      <FloatingBulkBar count={3} onCancel={vi.fn()} />
    );

    expect(screen.getByTestId('floating-bulk-bar')).toBeInTheDocument();
    expect(screen.getByText(/Kijelölt elemek:/i)).toBeInTheDocument();
    expect(screen.getByText('3 db')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mégse/i })).toBeInTheDocument();
  });

  it('supports custom label, itemUnit, and details summary', () => {
    render(
      <FloatingBulkBar
        count={7}
        label="Kijelölt tételek:"
        itemUnit="db"
        details={<span>Összesen: 45 000 Ft</span>}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText(/Kijelölt tételek:/i)).toBeInTheDocument();
    expect(screen.getByText('7 db')).toBeInTheDocument();
    expect(screen.getByText(/Összesen: 45 000 Ft/i)).toBeInTheDocument();
  });

  it('calls onCancel when Mégse button is clicked', () => {
    const handleCancel = vi.fn();
    render(
      <FloatingBulkBar count={2} onCancel={handleCancel} />
    );

    const cancelBtn = screen.getByRole('button', { name: /Mégse/i });
    fireEvent.click(cancelBtn);

    expect(handleCancel).toHaveBeenCalledTimes(1);
  });

  it('hides Save button by default when isDirty is false', () => {
    render(
      <FloatingBulkBar
        count={2}
        onSave={vi.fn()}
        isDirty={false}
        onCancel={vi.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: /Mentés/i })).not.toBeInTheDocument();
  });

  it('renders disabled Save button when isDirty is false and showSaveButton is always', () => {
    const handleSave = vi.fn();
    render(
      <FloatingBulkBar
        count={2}
        onSave={handleSave}
        isDirty={false}
        showSaveButton="always"
        onCancel={vi.fn()}
      />
    );

    const saveBtn = screen.getByRole('button', { name: /Mentés/i });
    expect(saveBtn).toBeInTheDocument();
    expect(saveBtn).toBeDisabled();

    fireEvent.click(saveBtn);
    expect(handleSave).not.toHaveBeenCalled();
  });

  it('enables Save button and executes onSave when isDirty is true', () => {
    const handleSave = vi.fn();
    render(
      <FloatingBulkBar
        count={2}
        onSave={handleSave}
        isDirty={true}
        onCancel={vi.fn()}
      />
    );

    const saveBtn = screen.getByRole('button', { name: /Mentés/i });
    expect(saveBtn).toBeEnabled();

    fireEvent.click(saveBtn);
    expect(handleSave).toHaveBeenCalledTimes(1);
  });

  it('disables Save button and shows spinner when isSaving is true', () => {
    render(
      <FloatingBulkBar
        count={2}
        onSave={vi.fn()}
        isDirty={true}
        isSaving={true}
        onCancel={vi.fn()}
      />
    );

    const saveBtn = screen.getByRole('button', { name: /Mentés/i });
    expect(saveBtn).toBeDisabled();
  });

  it('hides Save button when hideSaveButton is true', () => {
    render(
      <FloatingBulkBar
        count={2}
        onSave={vi.fn()}
        hideSaveButton={true}
        onCancel={vi.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: /Mentés/i })).not.toBeInTheDocument();
  });

  it('renders custom children and separator', () => {
    render(
      <FloatingBulkBar count={2} onCancel={vi.fn()}>
        <button type="button">Egyedi Gomb</button>
        <FloatingBulkBarSeparator />
      </FloatingBulkBar>
    );

    expect(screen.getByRole('button', { name: 'Egyedi Gomb' })).toBeInTheDocument();
  });

  describe('FloatingBulkSelect', () => {
    const testOptions = [
      { value: 'cat-1', label: 'Irodaszer' },
      { value: 'cat-2', label: 'Informatika' },
      { value: 'cat-3', label: 'Marketing' },
    ];

    it('renders trigger with placeholder and opens search bar on click', () => {
      render(
        <FloatingBulkBar.Select
          value={null}
          onValueChange={vi.fn()}
          placeholder="Kategória..."
          searchPlaceholder="Keresés kategóriára..."
          options={testOptions}
        />
      );

      const trigger = screen.getByRole('combobox');
      expect(trigger).toHaveTextContent('Kategória...');

      fireEvent.click(trigger);

      expect(screen.getByPlaceholderText('Keresés kategóriára...')).toBeInTheDocument();
      expect(screen.getByText('Irodaszer')).toBeInTheDocument();
      expect(screen.getByText('Informatika')).toBeInTheDocument();
      expect(screen.getByText('Marketing')).toBeInTheDocument();
    });

    it('displays selected option label when value matches', () => {
      render(
        <FloatingBulkBar.Select
          value="cat-2"
          onValueChange={vi.fn()}
          placeholder="Kategória..."
          options={testOptions}
        />
      );

      const trigger = screen.getByRole('combobox');
      expect(trigger).toHaveTextContent('Informatika');
    });

    it('calls onValueChange when an option is clicked', () => {
      const handleChange = vi.fn();
      render(
        <FloatingBulkBar.Select
          value={null}
          onValueChange={handleChange}
          placeholder="Kategória..."
          options={testOptions}
        />
      );

      fireEvent.click(screen.getByRole('combobox'));
      fireEvent.click(screen.getByText('Irodaszer'));

      expect(handleChange).toHaveBeenCalledWith('cat-1');
    });
  });
});

