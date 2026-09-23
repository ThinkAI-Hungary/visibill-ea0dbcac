import { describe, it, expect } from 'vitest';
import { STANDARD_GL_OPTIONS, STANDARD_GL_OPTIONS_HR } from '@/pages/Onboarding';

describe('Overhead Categories G/L Mapping', () => {
  it('contains standard 5th class expense G/L account options for Hungary', () => {
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

  it('contains standard 4th class expense G/L account options for Croatia (számla_hr)', () => {
    expect(STANDARD_GL_OPTIONS_HR.length).toBeGreaterThanOrEqual(10);
    const codes = STANDARD_GL_OPTIONS_HR.map(opt => opt.code);
    expect(codes).toContain('4010'); // Uredski materijal
    expect(codes).toContain('4070'); // Trošak električne energije
    expect(codes).toContain('4123'); // Održavanje softvera
    expect(codes).toContain('4164'); // Knjigovodstvene usluge
    expect(codes).toContain('4200'); // Troškovi neto plaća
    expect(codes).toContain('4650'); // Troškovi platnog prometa
    expect(codes).toContain('4660'); // Članarine komori
  });

  it('correctly maps 4th class expense codes with Croatian descriptions', () => {
    const gl4010 = STANDARD_GL_OPTIONS_HR.find(opt => opt.code === '4010');
    expect(gl4010?.label).toContain('Uredski materijal');
    const gl4164 = STANDARD_GL_OPTIONS_HR.find(opt => opt.code === '4164');
    expect(gl4164?.label).toContain('Knjigovodstvene usluge');
    const gl4650 = STANDARD_GL_OPTIONS_HR.find(opt => opt.code === '4650');
    expect(gl4650?.label).toContain('Troškovi platnog prometa');
  });
});

