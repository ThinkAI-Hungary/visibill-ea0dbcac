import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RichTextContent } from '../rich-text-content';

describe('RichTextContent Component', () => {
  it('renders fallback text when content is empty or null', () => {
    const { rerender } = render(<RichTextContent content={null} fallbackText="Nincs tartalom" />);
    expect(screen.getByText('Nincs tartalom')).toBeInTheDocument();

    rerender(<RichTextContent content="" fallbackText="Nincs tartalom" />);
    expect(screen.getByText('Nincs tartalom')).toBeInTheDocument();

    rerender(<RichTextContent content="   " fallbackText="Nincs tartalom" />);
    expect(screen.getByText('Nincs tartalom')).toBeInTheDocument();
  });

  it('renders plain text content with preserved whitespace', () => {
    render(<RichTextContent content="Ez egy egyszerű sima szöveg" />);
    expect(screen.getByText('Ez egy egyszerű sima szöveg')).toBeInTheDocument();
  });

  it('renders sanitized HTML content when meaningful HTML tags are present', () => {
    const { container } = render(
      <RichTextContent content="<p>Bekezdés <strong>kiemeléssel</strong></p>" />
    );
    expect(container.querySelector('strong')).toBeInTheDocument();
    expect(container.querySelector('strong')?.textContent).toBe('kiemeléssel');
  });

  it('strips malicious script tags from HTML content', () => {
    const { container } = render(
      <RichTextContent content="<p>Biztonságos szöveg</p><script>alert('xss')</script>" />
    );
    expect(container.querySelector('script')).toBeNull();
    expect(screen.getByText('Biztonságos szöveg')).toBeInTheDocument();
  });

  it('strictly satisfies Rules of Hooks across repeated dynamic re-renders of varying content types', () => {
    // This specifically guards against React Error #300 (Rendered fewer hooks than expected)
    const { rerender } = render(<RichTextContent content={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();

    // 1. Switch to HTML (which used to run 2 hooks)
    rerender(<RichTextContent content="<p>Első <b>HTML</b> tartalom</p>" />);
    expect(screen.getByText(/Első/)).toBeInTheDocument();

    // 2. Switch to plain text (which used to exit early after 1 hook)
    rerender(<RichTextContent content="Csak sima szöveg most" />);
    expect(screen.getByText('Csak sima szöveg most')).toBeInTheDocument();

    // 3. Switch back to empty (which used to exit early after 0 hooks)
    rerender(<RichTextContent content="" fallbackText="Üres újra" />);
    expect(screen.getByText('Üres újra')).toBeInTheDocument();

    // 4. Switch back to HTML again
    rerender(<RichTextContent content="<div>Második <i>HTML</i></div>" />);
    expect(screen.getByText(/Második/)).toBeInTheDocument();
  });
});
