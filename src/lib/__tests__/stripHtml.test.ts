import { describe, it, expect } from 'vitest';
import { stripHtml, getTicketSummary } from '../utils';

describe('stripHtml', () => {
  it('returns empty string for null, undefined, or empty string', () => {
    expect(stripHtml(null)).toBe('');
    expect(stripHtml(undefined)).toBe('');
    expect(stripHtml('')).toBe('');
    expect(stripHtml('   ')).toBe('');
  });

  it('preserves plain text without HTML', () => {
    expect(stripHtml('Palotás számla áfa nem stimmel.')).toBe('Palotás számla áfa nem stimmel.');
  });

  it('removes basic paragraph tags', () => {
    expect(stripHtml('<p>MOL számla áfa felbontása nem jó!</p>')).toBe('MOL számla áfa felbontása nem jó!');
  });

  it('separates block elements with a space to prevent merged words', () => {
    const html = '<p>Szia!</p><p>Felvittem a nyitó főkönyvi adatokat.</p>';
    expect(stripHtml(html)).toBe('Szia! Felvittem a nyitó főkönyvi adatokat.');
  });

  it('handles ordered and unordered lists with attributes', () => {
    const html = '<p>Banki tranzakciókkal kapcsolatos észre vételek</p><ol class="list-decimal pl-5 my-1.5 space-y-1"><li class="my-0.5 leading-normal">1. pont</li><li>2. pont</li></ol>';
    expect(stripHtml(html)).toBe('Banki tranzakciókkal kapcsolatos észre vételek 1. pont 2. pont');
  });

  it('handles <br> and <br/> tags properly', () => {
    const html = 'Első sor<br>Második sor<br/>Harmadik sor<br />Negyedik sor';
    expect(stripHtml(html)).toBe('Első sor Második sor Harmadik sor Negyedik sor');
  });

  it('decodes HTML entities correctly', () => {
    const html = '<p>Bruttó 19&nbsp;975&nbsp;Ft &amp; ÁFA &lt; 27% &gt; 0% &quot;idézet&quot; &#39;aposztrof&#39;</p>';
    expect(stripHtml(html)).toBe('Bruttó 19 975 Ft & ÁFA < 27% > 0% "idézet" \'aposztrof\'');
  });

  it('collapses multiple spaces and newlines into single spaces', () => {
    const html = '<p>   Több   szóköz   és \n\n új sor   </p>';
    expect(stripHtml(html)).toBe('Több szóköz és új sor');
  });
});

describe('getTicketSummary', () => {
  it('returns empty title and preview for empty message', () => {
    expect(getTicketSummary('')).toEqual({ title: '', preview: '' });
    expect(getTicketSummary(null)).toEqual({ title: '', preview: '' });
  });

  it('returns single line title with empty preview for short message', () => {
    const message = '<p>MOL számla áfa felbontása nem jó!</p>';
    const summary = getTicketSummary(message);
    expect(summary.title).toBe('MOL számla áfa felbontása nem jó!');
    expect(summary.preview).toBe('');
    expect(summary.title).not.toContain('<p>');
    expect(summary.title).not.toContain('</p>');
  });

  it('splits long rich text message into clean title and preview at word boundaries', () => {
    const message = '<p>Szia! Azt vettem észre, hogy a főkönyvbe belekerültek a bevételek a 9-es számla osztályba, viszont a vevő 311 és áfa 467 nem stimmel.</p>';
    const summary = getTicketSummary(message);

    // Title and preview must not contain any HTML tags
    expect(summary.title).not.toMatch(/<[^>]*>/);
    expect(summary.preview).not.toMatch(/<[^>]*>/);

    // Title should cut at a clean word boundary (no partial words)
    expect(summary.title.length).toBeLessThanOrEqual(65);
    expect(summary.title.endsWith(' ')).toBe(false);

    // Preview should continue the rest of the text
    expect(summary.preview.length).toBeGreaterThan(0);
    expect(summary.preview).toContain('osztályba');
  });

  it('handles rich text with lists from actual bug report', () => {
    const message = '<p>Banki tranzakciókkal kapcsolatos észre vételek</p><ol class="list-decimal pl-5 my-1.5 space-y-1"><li class="my-0.5 leading-normal">Első hiba leírása részletesen bemutatva a képernyőn.</li></ol>';
    const summary = getTicketSummary(message);

    expect(summary.title).toBe('Banki tranzakciókkal kapcsolatos észre vételek');
    expect(summary.preview).toBe('Első hiba leírása részletesen bemutatva a képernyőn.');
  });

  it('handles greeting paragraph merged with next paragraph', () => {
    const message = '<p>Szia!</p><p>Felvittem a nyitó főkönyvi adatokat. A könyvelés naplóknál azt jelzi, hogy könyvelve van.</p>';
    const summary = getTicketSummary(message);

    expect(summary.title).not.toMatch(/<[^>]*>/);
    expect(summary.preview).not.toMatch(/<[^>]*>/);
    expect(summary.title).toContain('Szia! Felvittem a nyitó');
    expect(summary.preview.length).toBeGreaterThan(0);
  });

  it('handles empty paragraphs in HTML cleanly', () => {
    const message = '<p>Kimenő (NAV), Bejövő (NAV) fülön a TÉTELEK-re kattintva.</p><p></p><p></p>';
    const summary = getTicketSummary(message);

    expect(summary.title).toBe('Kimenő (NAV), Bejövő (NAV) fülön a TÉTELEK-re kattintva.');
    expect(summary.preview).toBe('');
  });
});
