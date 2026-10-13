import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

vi.mock('https://esm.sh/@supabase/supabase-js@2.57.2', () => ({ createClient: vi.fn() }));

import {
  ACCOUNTY_MODULES,
  EAISYBILL_MODULES,
  getAccountyDefault,
  getEaisybillDefault,
} from '../../../supabase/functions/management-stats/handlers/permissionsHandler';
import { getAccountyRoleDefault } from '@/lib/permissions/accountyDefaults';
import { ACCOUNTY_ASSIGNMENT_ROLES } from '@/lib/permissions/capabilities';
import { getStaticDefaults, type EaisybillModule } from '@/hooks/useEaisybillPermissions';

/**
 * Contract test: the management-view mirror (Edge Function, Deno) MUST NOT drift
 * from the frontend default matrices (single source of truth: A-247).
 */
describe('management-stats permissionsHandler parity with frontend defaults', () => {
  it('eaisyBooks defaults are identical for every role × module', () => {
    for (const role of ACCOUNTY_ASSIGNMENT_ROLES) {
      for (const module of ACCOUNTY_MODULES) {
        const edge = getAccountyDefault(role, module);
        const front = getAccountyRoleDefault(role, module);
        expect({ role, module, ...edge }).toEqual({ role, module, ...front });
      }
    }
  });

  it('eaisyBill defaults are identical for every company role × module', () => {
    const roles = ['owner', 'admin', 'member', 'assistant', 'viewer', 'employee'];
    for (const role of roles) {
      for (const module of EAISYBILL_MODULES) {
        const edge = getEaisybillDefault(role, module);
        const front = getStaticDefaults(role, module as EaisybillModule);
        expect({ role, module, ...edge }).toEqual({ role, module, ...front });
      }
    }
  });
});

describe('invite-user Edge Function role list', () => {
  it('ACCOUNTANT_ROLES equals the accounty_assignments role set (incl. payroll_specialist)', () => {
    const src = readFileSync(
      resolve(__dirname, '../../../supabase/functions/invite-user/index.ts'),
      'utf8',
    );
    const match = src.match(/const ACCOUNTANT_ROLES = \[([^\]]+)\]/);
    expect(match).not.toBeNull();
    const roles = match![1].split(',').map(s => s.trim().replace(/["']/g, '')).filter(Boolean).sort();
    expect(roles).toEqual([...ACCOUNTY_ASSIGNMENT_ROLES].sort());
  });
});
