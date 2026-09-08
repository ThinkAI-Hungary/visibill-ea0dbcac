import { describe, it, expect } from 'vitest';
import { STANDARD_GL_OPTIONS } from '@/pages/Onboarding';

describe('Overhead Categories G/L Mapping', () => {
  it('contains standard 5th class expense G/L account options', () => {
    expect(STANDARD_GL_OPTIONS.length).toBeGreaterThanOrEqual(10);
    const codes = STANDARD_GL_OPTIONS.map(opt => opt.code);
    expect(codes).toContain('521'); // Villamosenergia
    expect(codes).toContain('522'); // Gáz, víz, távhő
    expect(codes).toContain('523'); // Bérleti díjak / szoftver
    expect(codes).toContain('532'); // Bankköltségek
    expect(codes).toContain('541'); // Munkabérek
    expect(codes).toContain('561'); // Szocho
  });

  it('correctly maps 5th class expense codes with descriptions', () => {
    const gl521 = STANDARD_GL_OPTIONS.find(opt => opt.code === '521');
    expect(gl521?.label).toContain('Villamosenergia');
    const gl532 = STANDARD_GL_OPTIONS.find(opt => opt.code === '532');
    expect(gl532?.label).toContain('Bankköltség');
  });
});
