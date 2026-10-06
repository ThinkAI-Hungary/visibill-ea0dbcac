import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { PartnerInputWithAutocomplete, type PartnerOption } from '../PartnerInputWithAutocomplete';

describe('PartnerInputWithAutocomplete', () => {
  const mockPartners: PartnerOption[] = [
    { id: 'p-1', name: 'Ganz Danubius Kft.', tax_number: '10221712-2-41', partner_type: 'customer' },
    { id: 'p-2', name: 'Auto Palace Buda Kft.', tax_number: '26508917-2-43', partner_type: 'both' },
    { id: 'p-3', name: 'Csoszó Bianka', tax_number: '90550360-1-23', partner_type: 'supplier' },
  ];

  it('renders input with value and placeholder', () => {
    const handleChange = vi.fn();
    render(
      <PartnerInputWithAutocomplete
        id="test-partner-input"
        value="Ganz"
        onChange={handleChange}
        partners={mockPartners}
        placeholder="Partner kiválasztása..."
      />
    );

    const input = screen.getByPlaceholderText('Partner kiválasztása...');
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('Ganz');
  });

  it('allows free-text typing and calls onChange', () => {
    const handleChange = vi.fn();
    render(
      <PartnerInputWithAutocomplete
        id="test-partner-input"
        value=""
        onChange={handleChange}
        partners={mockPartners}
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Új Partner Kft.' } });

    expect(handleChange).toHaveBeenCalledWith('Új Partner Kft.');
  });

  it('filters partner list by filterType customer', () => {
    const handleChange = vi.fn();
    render(
      <PartnerInputWithAutocomplete
        id="test-partner-input"
        value=""
        onChange={handleChange}
        partners={mockPartners}
        filterType="customer"
      />
    );

    // Click dropdown toggle button to open
    const toggleBtn = screen.getByTitle('Partnertörzs lista megnyitása');
    fireEvent.click(toggleBtn);

    // Customer and Both should be visible
    expect(screen.getByText('Ganz Danubius Kft.')).toBeInTheDocument();
    expect(screen.getByText('Auto Palace Buda Kft.')).toBeInTheDocument();
    // Supplier should not be visible
    expect(screen.queryByText('Csoszó Bianka')).not.toBeInTheDocument();
  });

  it('selects partner from list and calls onChange with partner name', () => {
    const handleChange = vi.fn();
    render(
      <PartnerInputWithAutocomplete
        id="test-partner-input"
        value=""
        onChange={handleChange}
        partners={mockPartners}
      />
    );

    const toggleBtn = screen.getByTitle('Partnertörzs lista megnyitása');
    fireEvent.click(toggleBtn);

    const option = screen.getByText('Ganz Danubius Kft.');
    fireEvent.click(option);

    expect(handleChange).toHaveBeenCalledWith('Ganz Danubius Kft.');
  });

  it('calls onSelectPartner with full partner option including tax_number', () => {
    const handleChange = vi.fn();
    const handleSelectPartner = vi.fn();
    render(
      <PartnerInputWithAutocomplete
        id="test-partner-input"
        value=""
        onChange={handleChange}
        onSelectPartner={handleSelectPartner}
        partners={mockPartners}
      />
    );

    const toggleBtn = screen.getByTitle('Partnertörzs lista megnyitása');
    fireEvent.click(toggleBtn);

    const option = screen.getByText('Ganz Danubius Kft.');
    fireEvent.click(option);

    expect(handleSelectPartner).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'p-1',
        name: 'Ganz Danubius Kft.',
        tax_number: '10221712-2-41',
      })
    );
  });

  it('opens suggestions when input is clicked or focused', () => {
    const handleChange = vi.fn();
    render(
      <PartnerInputWithAutocomplete
        id="test-partner-input"
        value=""
        onChange={handleChange}
        partners={mockPartners}
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    expect(screen.getByText('Partnertörzs (3)')).toBeInTheDocument();

    fireEvent.click(input);
    expect(screen.getByText('Partnertörzs (3)')).toBeInTheDocument();
  });

  it('renders clear button when value is present and clears on click', () => {
    const handleChange = vi.fn();
    render(
      <PartnerInputWithAutocomplete
        id="test-partner-input"
        value="Valami partner"
        onChange={handleChange}
        partners={mockPartners}
      />
    );

    const clearBtn = screen.getByTitle('Mező törlése');
    expect(clearBtn).toBeInTheDocument();

    fireEvent.click(clearBtn);
    expect(handleChange).toHaveBeenCalledWith('');
  });

  it('renders SearchInput in popover, filters items, and allows selecting custom new partner', () => {
    const handleChange = vi.fn();
    render(
      <PartnerInputWithAutocomplete
        id="test-partner-input"
        value=""
        onChange={handleChange}
        partners={mockPartners}
      />
    );

    // Open popover
    const toggleBtn = screen.getByTitle('Partnertörzs lista megnyitása');
    fireEvent.click(toggleBtn);

    // SearchInput should be present with placeholder
    const searchInput = screen.getByPlaceholderText('Keresés partner neve vagy adószáma alapján...');
    expect(searchInput).toBeInTheDocument();

    // Type a non-existing name
    fireEvent.change(searchInput, { target: { value: 'Teljesen Új Partner Kft.' } });

    // "Új partner használata" action button appears
    const customPartnerBtn = screen.getByRole('button', { name: /Új partner használata: "Teljesen Új Partner Kft."/i });
    expect(customPartnerBtn).toBeInTheDocument();

    fireEvent.click(customPartnerBtn);
    expect(handleChange).toHaveBeenCalledWith('Teljesen Új Partner Kft.');
  });
});


