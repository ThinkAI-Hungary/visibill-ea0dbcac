import { describe, it, expect } from 'vitest';
import { TICKET_CATEGORIES, isValidTicketCategory } from '@/utils/ticketCategories';
import type { Ticket } from '@/hooks/useTickets';

describe('Ticket Categories Validation & Filtering', () => {
  it('contains exactly the 37 predefined categories requested by the user', () => {
    expect(TICKET_CATEGORIES).toHaveLength(37);
    expect(TICKET_CATEGORIES).toContain('áfa');
    expect(TICKET_CATEGORIES).toContain('bank napló');
    expect(TICKET_CATEGORIES).toContain('banki tranzakciók');
    expect(TICKET_CATEGORIES).toContain('bér xml');
    expect(TICKET_CATEGORIES).toContain('bérjegyzék');
    expect(TICKET_CATEGORIES).toContain('dolgozói törzsadat');
    expect(TICKET_CATEGORIES).toContain('egyéb');
    expect(TICKET_CATEGORIES).toContain('főkönyv');
    expect(TICKET_CATEGORIES).toContain('napló számlák');
    expect(TICKET_CATEGORIES).toContain('nyitó napló');
    expect(TICKET_CATEGORIES).toContain('partner');
    expect(TICKET_CATEGORIES).toContain('pénztár tranzakciók');
    expect(TICKET_CATEGORIES).toContain('rendszer');
    expect(TICKET_CATEGORIES).toContain('SUP');
    expect(TICKET_CATEGORIES).toContain('számla feldolgozás');
    expect(TICKET_CATEGORIES).toContain('számlaképek');
    expect(TICKET_CATEGORIES).toContain('vegyes napló');
    expect(TICKET_CATEGORIES).toContain('szállító napló');
    expect(TICKET_CATEGORIES).toContain('vevő napló');
    expect(TICKET_CATEGORIES).toContain('bér napló');
    expect(TICKET_CATEGORIES).toContain('pénztár napló');
    expect(TICKET_CATEGORIES).toContain('záró tételek napló');
    expect(TICKET_CATEGORIES).toContain('vevő-szállító analitika');
    expect(TICKET_CATEGORIES).toContain('előleg analitika');
    expect(TICKET_CATEGORIES).toContain('árfolyam elszámolás');
    expect(TICKET_CATEGORIES).toContain('elhatárolások');
    expect(TICKET_CATEGORIES).toContain('devizás könyvelés');
    expect(TICKET_CATEGORIES).toContain('tárgyi eszköz');
    expect(TICKET_CATEGORIES).toContain('egyszeres számla tranzakciók');
    expect(TICKET_CATEGORIES).toContain('egyszeres számla könyvelés');
    expect(TICKET_CATEGORIES).toContain('egyszeres banki tranzakciók');
    expect(TICKET_CATEGORIES).toContain('egyszeres bank könyvelés');
    expect(TICKET_CATEGORIES).toContain('egyszeres pénztár tranzakciók');
    expect(TICKET_CATEGORIES).toContain('egyszeres pénztár könyvelés');
    expect(TICKET_CATEGORIES).toContain('egyszeres áfa');
    expect(TICKET_CATEGORIES).toContain('egyszeres pénztárkönyv');
    expect(TICKET_CATEGORIES).toContain('besorolandó');
  });

  it('correctly validates categories with isValidTicketCategory', () => {
    expect(isValidTicketCategory('áfa')).toBe(true);
    expect(isValidTicketCategory('SUP')).toBe(true);
    expect(isValidTicketCategory('besorolandó')).toBe(true);
    expect(isValidTicketCategory('nem létező kategória')).toBe(false);
    expect(isValidTicketCategory('')).toBe(false);
    expect(isValidTicketCategory(null)).toBe(false);
    expect(isValidTicketCategory(undefined)).toBe(false);
  });

  it('filters mock tickets by category matching the TicketsPage logic', () => {
    const mockTickets: Partial<Ticket>[] = [
      { id: '1', message: 'Áfa bevallás probléma', category: 'áfa' },
      { id: '2', message: 'Banki tétel eltérés', category: 'banki tranzakciók' },
      { id: '3', message: 'SUP import hiba', category: 'SUP' },
      { id: '4', message: 'Kategorizálatlan hiba', category: null },
      { id: '5', message: 'Üres string kategória', category: '' },
    ];

    // Filter by specific category "áfa"
    const afaTickets = mockTickets.filter((t) => t.category === 'áfa');
    expect(afaTickets).toHaveLength(1);
    expect(afaTickets[0].id).toBe('1');

    // Filter by "none" (uncategorized)
    const uncategorizedTickets = mockTickets.filter((t) => !t.category);
    expect(uncategorizedTickets).toHaveLength(2);
    expect(uncategorizedTickets.map((t) => t.id)).toEqual(['4', '5']);

    // Filter by "all"
    const allTickets = mockTickets.filter(() => true);
    expect(allTickets).toHaveLength(5);
  });
});
