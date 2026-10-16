import { describe, it, expect } from 'vitest';
import { detectAssetCandidate } from '@/lib/fixed-assets/assetInvoiceCandidateService';

describe('assetInvoiceCandidateService', () => {
  it('detects IT laptop with high confidence based on keywords and amount', () => {
    const res = detectAssetCandidate({
      id: 'item-1',
      line_description: 'Dell Latitude 5540 Laptop 16GB/512GB SSD',
      net_amount: 385000,
      vtsz_teszor: '84713000',
    });

    expect(res.isCandidate).toBe(true);
    expect(res.confidence).toBe('high');
    expect(res.suggestedUsefulLifeMonths).toBe(36);
    expect(res.suggestedTaoRate).toBe(33);
    expect(res.suggestedGlAccountPrefix).toBe('134');
    expect(res.reasons.some(r => r.includes('Laptop') || r.includes('laptop'))).toBe(true);
  });

  it('detects vehicle based on VTSZ 8703 and suggest 60 months, 20% rate', () => {
    const res = detectAssetCandidate({
      id: 'item-2',
      line_description: 'Skoda Octavia 2.0 TDI szgk.',
      net_amount: 8500000,
      vtsz_teszor: '8703',
    });

    expect(res.isCandidate).toBe(true);
    expect(res.confidence).toBe('high');
    expect(res.suggestedUsefulLifeMonths).toBe(60);
    expect(res.suggestedTaoRate).toBe(20);
    expect(res.suggestedGlAccountPrefix).toBe('142');
  });

  it('detects items booked on account 161 (CIP) as candidates', () => {
    const res = detectAssetCandidate({
      id: 'item-3',
      line_description: 'Gyártósori hidraulikus présegység beépítése',
      net_amount: 1200000,
      gl_account_number: '1611',
    });

    expect(res.isCandidate).toBe(true);
    expect(res.confidence).toBe('high');
    expect(res.reasons.some(r => r.includes('161'))).toBe(true);
  });

  it('detects high-value items without specific keywords as medium candidates', () => {
    const res = detectAssetCandidate({
      id: 'item-4',
      line_description: 'Ipari egyedi vezérlőpult installáció',
      net_amount: 450000,
    });

    expect(res.isCandidate).toBe(true);
    expect(res.confidence).toBe('medium');
    expect(res.reasons.some(r => r.includes('≥ 200 000 Ft'))).toBe(true);
  });

  it('rejects ordinary operating expenses with low amounts', () => {
    const res = detectAssetCandidate({
      id: 'item-5',
      line_description: 'Fénymásolópapír A4 80g (5 csomag)',
      net_amount: 12500,
    });

    expect(res.isCandidate).toBe(false);
    expect(res.confidence).toBe('low');
  });
});
