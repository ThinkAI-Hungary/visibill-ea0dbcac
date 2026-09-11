import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TicketStatusBadge } from '@/components/tickets/TicketStatusBadge';
import { TicketResolutionBanner } from '@/components/tickets/TicketResolutionBanner';

const mockRespondResolution = vi.fn();

vi.mock('@/hooks/useTickets', () => ({
  useRespondTicketResolution: () => ({
    mutate: mockRespondResolution,
    isPending: false,
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

describe('Ticket Resolution Confirmation Workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('TicketStatusBadge', () => {
    it('renders "Visszaigazolásra vár" when waitingForConfirmation is true on active ticket', () => {
      render(<TicketStatusBadge status="in_progress" waitingForConfirmation={true} />);
      expect(screen.getByText('Visszaigazolásra vár')).toBeInTheDocument();
    });

    it('renders standard status "Folyamatban" when waitingForConfirmation is false', () => {
      render(<TicketStatusBadge status="in_progress" waitingForConfirmation={false} />);
      expect(screen.getByText('Folyamatban')).toBeInTheDocument();
    });

    it('renders "Megoldva" even if waitingForConfirmation was true once resolved', () => {
      render(<TicketStatusBadge status="resolved" waitingForConfirmation={true} />);
      expect(screen.getByText('Megoldva')).toBeInTheDocument();
    });
  });

  describe('TicketResolutionBanner', () => {
    it('renders nothing if waitingForConfirmation is false', () => {
      const { container } = render(
        <TicketResolutionBanner
          ticketId="t-123"
          isReporter={true}
          isAdmin={false}
          waitingForConfirmation={false}
        />
      );
      expect(container.firstChild).toBeNull();
    });

    it('renders customer confirmation card when isReporter is true and waitingForConfirmation is true', () => {
      render(
        <TicketResolutionBanner
          ticketId="t-123"
          isReporter={true}
          isAdmin={false}
          waitingForConfirmation={true}
          resolutionRequestedAt={new Date().toISOString()}
        />
      );

      expect(screen.getByText('Kérjük, jelezzen vissza:')).toBeInTheDocument();
      expect(screen.getByText('Megoldódott az Ön által jelentett probléma?')).toBeInTheDocument();
      expect(screen.getByText('Igen, megoldódott')).toBeInTheDocument();
      expect(screen.getByText('Nem, még fennáll')).toBeInTheDocument();
    });

    it('calls respondResolution with confirmed: true when clicking "Igen, megoldódott"', () => {
      render(
        <TicketResolutionBanner
          ticketId="t-123"
          isReporter={true}
          isAdmin={false}
          waitingForConfirmation={true}
        />
      );

      const confirmBtn = screen.getByText('Igen, megoldódott');
      fireEvent.click(confirmBtn);

      expect(mockRespondResolution).toHaveBeenCalledTimes(1);
      expect(mockRespondResolution).toHaveBeenCalledWith(
        expect.objectContaining({
          feedbackId: 't-123',
          confirmed: true,
        }),
        expect.any(Object)
      );
    });

    it('expands feedback input and submits confirmed: false when user indicates issue still exists', () => {
      render(
        <TicketResolutionBanner
          ticketId="t-123"
          isReporter={true}
          isAdmin={false}
          waitingForConfirmation={true}
        />
      );

      const rejectBtn = screen.getByText('Nem, még fennáll');
      fireEvent.click(rejectBtn);

      expect(screen.getByPlaceholderText(/még mindig jelentkezik/i)).toBeInTheDocument();

      const textarea = screen.getByPlaceholderText(/még mindig jelentkezik/i);
      fireEvent.change(textarea, { target: { value: 'Még mindig 500-as hibát dob' } });

      const submitBtn = screen.getByText('Visszajelzés küldése');
      fireEvent.click(submitBtn);

      expect(mockRespondResolution).toHaveBeenCalledTimes(1);
      expect(mockRespondResolution).toHaveBeenCalledWith(
        expect.objectContaining({
          feedbackId: 't-123',
          confirmed: false,
          comment: 'Még mindig 500-as hibát dob',
        }),
        expect.any(Object)
      );
    });

    it('renders admin info banner when isAdmin is true and not reporter', () => {
      render(
        <TicketResolutionBanner
          ticketId="t-123"
          isReporter={false}
          isAdmin={true}
          waitingForConfirmation={true}
        />
      );

      expect(screen.getByText('Megoldás-visszaigazolás kiküldve az ügyfélnek')).toBeInTheDocument();
      expect(screen.getByText('Közvetlen lezárás')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Közvetlen lezárás'));
      expect(mockRespondResolution).toHaveBeenCalledWith(
        expect.objectContaining({
          feedbackId: 't-123',
          confirmed: true,
        }),
        expect.any(Object)
      );
    });
  });
});
