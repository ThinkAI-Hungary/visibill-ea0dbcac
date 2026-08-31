import { describe, it, expect } from 'vitest';
import { escapeXml, buildXmlTag, buildAnykEnvelope } from '../encoding/xmlSanitizer';

describe('xmlSanitizer', () => {
  describe('escapeXml', () => {
    it('escapes &, <, >, ", and \' characters', () => {
      expect(escapeXml('Tom & Jerry <cartoon> "2026" \'special\'')).toBe(
        'Tom &amp; Jerry &lt;cartoon&gt; &quot;2026&quot; &apos;special&apos;'
      );
    });

    it('handles null and undefined values safely', () => {
      expect(escapeXml(null)).toBe('');
      expect(escapeXml(undefined)).toBe('');
    });
  });

  describe('buildXmlTag', () => {
    it('builds standard XML tags with escaped values', () => {
      expect(buildXmlTag('nev', 'ThinkAI Kft.')).toBe('<nev>ThinkAI Kft.</nev>');
    });

    it('builds self-closing tags for empty or null values', () => {
      expect(buildXmlTag('emptyTag', null)).toBe('<emptyTag/>');
      expect(buildXmlTag('emptyTag', '')).toBe('<emptyTag/>');
    });

    it('supports attributes with escaping', () => {
      expect(buildXmlTag('item', 100, { id: '1', type: 'salary & tax' })).toBe(
        '<item id="1" type="salary &amp; tax">100</item>'
      );
    });
  });

  describe('buildAnykEnvelope', () => {
    it('builds standard ÁNYK XML envelope', () => {
      const envelope = buildAnykEnvelope(
        {
          formId: '2665',
          formVersion: '1.0',
          softwareName: 'Visibill / eaisyBooks',
        },
        '      <sor_01_alap>1000</sor_01_alap>'
      );

      expect(envelope).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(envelope).toContain('<nyomtatvanyazonosito>2665</nyomtatvanyazonosito>');
      expect(envelope).toContain('<nyomtatvanyverzio>1.0</nyomtatvanyverzio>');
      expect(envelope).toContain('<programnev>Visibill / eaisyBooks</programnev>');
      expect(envelope).toContain('<sor_01_alap>1000</sor_01_alap>');
    });
  });
});
