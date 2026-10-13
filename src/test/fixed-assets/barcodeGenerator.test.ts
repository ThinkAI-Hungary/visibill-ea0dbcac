import { describe, it, expect } from 'vitest';
import {
  encodeCode128B,
  generateCode128Modules,
  generateCode128Svg,
} from '@/lib/fixed-assets/barcodeGenerator';

describe('barcodeGenerator (Code 128B)', () => {
  it('correctly encodes ASCII text into Code 128B symbols with start/stop/checksum', () => {
    const text = 'ASSET-001';
    const symbols = encodeCode128B(text);

    // Symbols should start with START_B (104) and end with STOP (106)
    expect(symbols[0]).toBe(104);
    expect(symbols[symbols.length - 1]).toBe(106);

    // Total length: START_B (1) + characters (9) + CHECKSUM (1) + STOP (1) = 12 symbols
    expect(symbols).toHaveLength(12);

    // Verify all symbols are valid indices (0 to 106)
    symbols.forEach((s) => {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(106);
    });
  });

  it('generates a valid sequence of boolean modules', () => {
    const text = 'INV-2026-X';
    const modules = generateCode128Modules(text);

    expect(Array.isArray(modules)).toBe(true);
    expect(modules.length).toBeGreaterThan(50);
    // At least one bar and one space
    expect(modules.some((m) => m === true)).toBe(true);
    expect(modules.some((m) => m === false)).toBe(true);
  });

  it('generates valid SVG with crisp edges and monospace text', () => {
    const text = 'TE-2026/001';
    const svg = generateCode128Svg(text, {
      height: 40,
      barWidth: 2,
      includeText: true,
      fontSize: 12,
    });

    expect(svg).toContain('<svg');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('shape-rendering="crispEdges"');
    expect(svg).toContain('<rect');
    expect(svg).toContain('<text');
    expect(svg).toContain('TE-2026/001');
    expect(svg).toContain('</svg>');
  });

  it('supports hiding text and escaping XML characters', () => {
    const text = 'A<B>&C"D\'';
    const svgNoText = generateCode128Svg(text, { includeText: false });
    expect(svgNoText).not.toContain('<text');

    const svgWithText = generateCode128Svg(text, { includeText: true });
    expect(svgWithText).toContain('A&lt;B&gt;&amp;C&quot;D&apos;');
  });
});
