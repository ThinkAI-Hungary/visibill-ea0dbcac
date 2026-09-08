import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { MemoryRouter } from 'react-router-dom';
import { FeedbackFab } from '@/components/FeedbackFab';
import { AiAssistantDrawer } from '@/components/ai/AiAssistantDrawer';

// Mock child dialogs for fast, isolated unit testing of the FAB container
vi.mock('@/components/FeedbackDialog', () => ({
  FeedbackDialog: ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) =>
    open ? (
      <div data-testid="mock-feedback-dialog">
        <button onClick={() => onOpenChange(false)}>Bezárás</button>
      </div>
    ) : null,
}));

describe('FeedbackFab — Dual Floating Action Bubbles', () => {
  function renderWithProviders(ui: React.ReactElement) {
    return render(
      <MemoryRouter>
        <TooltipProvider>
          {ui}
        </TooltipProvider>
      </MemoryRouter>
    );
  }

  it('renders both the AI assistant and Feedback bubbles simultaneously', () => {
    renderWithProviders(<FeedbackFab />);

    const aiButton = screen.getByRole('button', { name: /AI Asszisztens előhívása/i });
    const feedbackButton = screen.getByRole('button', { name: /Visszajelzés küldése/i });

    expect(aiButton).toBeInTheDocument();
    expect(feedbackButton).toBeInTheDocument();
    expect(aiButton).toHaveAttribute('id', 'ai-assistant-fab');
    expect(feedbackButton).toHaveAttribute('id', 'feedback-fab');
  });

  it('toggles AI assistant drawer on AI bubble click in uncontrolled mode', () => {
    renderWithProviders(<FeedbackFab />);

    // Initially closed
    expect(screen.queryByRole('dialog', { name: /asszisztens csevegés/i })).not.toBeInTheDocument();

    // Click to open
    const aiButton = screen.getByRole('button', { name: /AI Asszisztens előhívása/i });
    fireEvent.click(aiButton);

    // Now drawer is mounted
    expect(screen.getByRole('dialog', { name: /asszisztens csevegés/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /AI Asszisztens bezárása/i })).toBeInTheDocument();

    // Click AI button again to close
    fireEvent.click(screen.getByRole('button', { name: /AI Asszisztens bezárása/i }));
    expect(screen.queryByRole('dialog', { name: /asszisztens csevegés/i })).not.toBeInTheDocument();
  });

  it('opens FeedbackDialog when Feedback bubble is clicked', () => {
    renderWithProviders(<FeedbackFab />);

    expect(screen.queryByTestId('mock-feedback-dialog')).not.toBeInTheDocument();

    const feedbackButton = screen.getByRole('button', { name: /Visszajelzés küldése/i });
    fireEvent.click(feedbackButton);

    expect(screen.getByTestId('mock-feedback-dialog')).toBeInTheDocument();
  });

  it('handles controlled mode with external onAiOpen and onAiClose handlers', () => {
    const onAiOpen = vi.fn();
    const onAiClose = vi.fn();

    const { rerender } = renderWithProviders(
      <FeedbackFab
        aiDrawerOpen={false}
        onAiOpen={onAiOpen}
        onAiClose={onAiClose}
      />
    );

    // Click to open
    const aiButton = screen.getByRole('button', { name: /AI Asszisztens előhívása/i });
    fireEvent.click(aiButton);
    expect(onAiOpen).toHaveBeenCalledTimes(1);
    expect(onAiClose).not.toHaveBeenCalled();

    // Re-render as open
    rerender(
      <MemoryRouter>
        <TooltipProvider>
          <FeedbackFab
            aiDrawerOpen={true}
            onAiOpen={onAiOpen}
            onAiClose={onAiClose}
          />
        </TooltipProvider>
      </MemoryRouter>
    );

    // Click to close
    const closeAiButton = screen.getByRole('button', { name: /AI Asszisztens bezárása/i });
    fireEvent.click(closeAiButton);
    expect(onAiClose).toHaveBeenCalledTimes(1);
  });
});

describe('AiAssistantDrawer', () => {
  it('does not render when open is false', () => {
    render(
      <MemoryRouter>
        <AiAssistantDrawer open={false} onClose={vi.fn()} />
      </MemoryRouter>
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders header, title, and close button when open is true', () => {
    const onClose = vi.fn();
    render(
      <MemoryRouter>
        <AiAssistantDrawer open={true} onClose={onClose} />
      </MemoryRouter>
    );

    const drawer = screen.getByRole('dialog', { name: /asszisztens csevegés/i });
    expect(drawer).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /eAIsy asszisztens/i })).toBeInTheDocument();
    expect(screen.getByText('applikáció támogatás')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Teljes nézet/i })).not.toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /AI fiók bezárása/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('accepts onSidebarChange callback prop without crashing', () => {
    const onSidebarChange = vi.fn();
    render(
      <MemoryRouter>
        <AiAssistantDrawer open={true} onClose={vi.fn()} onSidebarChange={onSidebarChange} />
      </MemoryRouter>
    );

    expect(screen.getByRole('dialog', { name: /asszisztens csevegés/i })).toBeInTheDocument();
  });
});
