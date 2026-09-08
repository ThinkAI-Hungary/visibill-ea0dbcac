import { describe, it, expect } from 'vitest';

interface CompanySelectToken {
  id: string;
  name: string;
}

const parseCompanySelectTokens = (content: string): { cleanText: string; tokens: CompanySelectToken[] } => {
  const tokens: CompanySelectToken[] = [];
  const regex = /<<COMPANY_SELECT:([a-zA-Z0-9-]+)\|([^>]+)>>/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    tokens.push({ id: match[1], name: match[2].trim() });
  }
  const clean = content.replace(/<<COMPANY_SELECT:([a-zA-Z0-9-]+)\|([^>]+)>>/g, '').trim();
  const cleanText = clean || (tokens.length > 0 ? 'Kérlek válaszd ki, hogy melyik céghez szeretnéd tudni a számláid számát:' : '');
  return { cleanText, tokens };
};

describe('AI Assistant Live Context & Company Selection Parsing', () => {
  it('returns empty tokens when text does not contain any company select token', () => {
    const text = 'Szia! Jelenleg 3 kifizetetlen kimenő számlád van.';
    const result = parseCompanySelectTokens(text);
    expect(result.tokens).toHaveLength(0);
    expect(result.cleanText).toBe(text);
  });

  it('correctly extracts single company select token and cleans message text', () => {
    const text = 'Kérlek válaszd ki: <<COMPANY_SELECT:100808a3-2ee9-43c3-ae62-3112d1b7ee97|Think AI Kft>>';
    const result = parseCompanySelectTokens(text);
    expect(result.tokens).toHaveLength(1);
    expect(result.tokens[0]).toEqual({
      id: '100808a3-2ee9-43c3-ae62-3112d1b7ee97',
      name: 'Think AI Kft',
    });
    expect(result.cleanText).toBe('Kérlek válaszd ki:');
  });

  it('correctly extracts multiple company tokens', () => {
    const text = `Több céghez is hozzá vagy rendelve. Melyik adataira vagy kíváncsi?
<<COMPANY_SELECT:100808a3-2ee9-43c3-ae62-3112d1b7ee97|Think AI Kft>>
<<COMPANY_SELECT:4985c5b9-1d4b-4b21-a3f2-1d59ba29d012|"Finances are Fine" Bt.>>`;

    const result = parseCompanySelectTokens(text);
    expect(result.tokens).toHaveLength(2);
    expect(result.tokens[0].name).toBe('Think AI Kft');
    expect(result.tokens[1].name).toBe('"Finances are Fine" Bt.');
    expect(result.cleanText).toBe('Több céghez is hozzá vagy rendelve. Melyik adataira vagy kíváncsi?');
  });

  it('provides a default prompt when text consists only of tokens', () => {
    const text = '<<COMPANY_SELECT:100808a3-2ee9-43c3-ae62-3112d1b7ee97|Think AI Kft>>';
    const result = parseCompanySelectTokens(text);
    expect(result.tokens).toHaveLength(1);
    expect(result.cleanText).toBe('Kérlek válaszd ki, hogy melyik céghez szeretnéd tudni a számláid számát:');
  });
});
