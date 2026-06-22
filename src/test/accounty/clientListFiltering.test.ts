import { describe, it, expect } from 'vitest';

/**
 * Tests for the useAccountyClients client-list filtering logic.
 *
 * The hook queries accounty_assignments, then filters based on
 * admin status and is_main_accountant. We replicate the pure
 * filtering/mapping logic here for isolated testing.
 *
 * Key rules:
 * - Admin users (iroda_admin): see ALL companies in their firm
 * - Non-admin users: see ONLY companies where is_main_accountant = true
 * - SANDBOX companies are always excluded
 * - is_main_accountant: true is REQUIRED for invite code assignments
 */

// ── Replicated types ──

interface AccountyAssignment {
  id: string;
  accountant_user_id: string;
  company_id: string;
  accounting_firm_id: string | null;
  role: string;
  is_primary: boolean;
  is_main_accountant: boolean;
}

interface CompanyInfo {
  id: string;
  name: string;
  tax_number: string;
}

interface ClientListItem {
  companyId: string;
  name: string;
  isMainAccountant: boolean;
  assignedToMe: boolean;
}

// ── Replicated filtering logic from useAccountyClients ──

function buildClientList(
  userId: string,
  assignments: AccountyAssignment[],
  companies: CompanyInfo[],
): ClientListItem[] {
  const myAssigns = assignments.filter(a => a.accountant_user_id === userId);
  const isAdmin = myAssigns.some(a => a.role === 'iroda_admin');

  // Group by company
  const companyAssignments: Record<string, AccountyAssignment[]> = {};
  assignments.forEach(a => {
    if (!companyAssignments[a.company_id]) companyAssignments[a.company_id] = [];
    companyAssignments[a.company_id].push(a);
  });

  // Build the list
  const clientsList = companies
    .filter(c => c.name !== 'SANDBOX')
    .map((company): ClientListItem => {
      const assignsForComp = companyAssignments[company.id] || [];
      const isMainAccountantForMe = assignsForComp.some(
        a => a.accountant_user_id === userId && a.is_main_accountant
      );
      const assignedToMe = isAdmin
        ? assignsForComp.some(a => a.accountant_user_id === userId)
        : isMainAccountantForMe;

      return {
        companyId: company.id,
        name: company.name,
        isMainAccountant: isMainAccountantForMe,
        assignedToMe,
      };
    });

  // Non-admin: filter by is_main_accountant
  if (!isAdmin) {
    return clientsList.filter(c => c.isMainAccountant);
  }
  return clientsList;
}

// ═══════════════════════════════════════════════════════════════
// Test data fixtures
// ═══════════════════════════════════════════════════════════════

const USER_A = 'user-a'; // könyvelő (non-admin)
const USER_B = 'user-b'; // iroda_admin
const FIRM_1 = 'firm-1';

const COMPANIES: CompanyInfo[] = [
  { id: 'c1', name: 'Alpha Kft.', tax_number: '11111111-1-11' },
  { id: 'c2', name: 'Beta Bt.', tax_number: '22222222-2-22' },
  { id: 'c3', name: 'Gamma Zrt.', tax_number: '33333333-3-33' },
  { id: 'c4', name: 'SANDBOX', tax_number: '00000000-0-00' },
];

// ═══════════════════════════════════════════════════════════════
// Non-admin client list filtering
// ═══════════════════════════════════════════════════════════════

describe('useAccountyClients: Non-admin filtering', () => {
  it('shows company where is_main_accountant = true', () => {
    const assignments: AccountyAssignment[] = [
      {
        id: 'a1', accountant_user_id: USER_A, company_id: 'c1',
        accounting_firm_id: FIRM_1, role: 'könyvelő',
        is_primary: true, is_main_accountant: true,
      },
    ];
    const result = buildClientList(USER_A, assignments, COMPANIES);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Alpha Kft.');
  });

  it('hides company where is_main_accountant = false', () => {
    const assignments: AccountyAssignment[] = [
      {
        id: 'a1', accountant_user_id: USER_A, company_id: 'c1',
        accounting_firm_id: FIRM_1, role: 'könyvelő',
        is_primary: true, is_main_accountant: false,
      },
    ];
    const result = buildClientList(USER_A, assignments, COMPANIES);
    expect(result).toHaveLength(0);
  });

  it('shows multiple companies with is_main_accountant = true', () => {
    const assignments: AccountyAssignment[] = [
      {
        id: 'a1', accountant_user_id: USER_A, company_id: 'c1',
        accounting_firm_id: FIRM_1, role: 'könyvelő',
        is_primary: true, is_main_accountant: true,
      },
      {
        id: 'a2', accountant_user_id: USER_A, company_id: 'c2',
        accounting_firm_id: FIRM_1, role: 'könyvelő',
        is_primary: true, is_main_accountant: true,
      },
    ];
    const result = buildClientList(USER_A, assignments, COMPANIES);
    expect(result).toHaveLength(2);
    expect(result.map(r => r.name)).toEqual(['Alpha Kft.', 'Beta Bt.']);
  });

  it('filters mixed assignments (some main, some not)', () => {
    const assignments: AccountyAssignment[] = [
      {
        id: 'a1', accountant_user_id: USER_A, company_id: 'c1',
        accounting_firm_id: FIRM_1, role: 'könyvelő',
        is_primary: true, is_main_accountant: true,
      },
      {
        id: 'a2', accountant_user_id: USER_A, company_id: 'c2',
        accounting_firm_id: FIRM_1, role: 'könyvelő',
        is_primary: true, is_main_accountant: false,
      },
      {
        id: 'a3', accountant_user_id: USER_A, company_id: 'c3',
        accounting_firm_id: FIRM_1, role: 'könyvelő',
        is_primary: true, is_main_accountant: true,
      },
    ];
    const result = buildClientList(USER_A, assignments, COMPANIES);
    expect(result).toHaveLength(2);
    expect(result.map(r => r.name)).toEqual(['Alpha Kft.', 'Gamma Zrt.']);
  });

  it('returns empty list when no assignments exist', () => {
    const result = buildClientList(USER_A, [], COMPANIES);
    expect(result).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// Admin client list (no is_main_accountant filter)
// ═══════════════════════════════════════════════════════════════

describe('useAccountyClients: Admin sees all firm companies', () => {
  const assignments: AccountyAssignment[] = [
    {
      id: 'a1', accountant_user_id: USER_B, company_id: 'c1',
      accounting_firm_id: FIRM_1, role: 'iroda_admin',
      is_primary: true, is_main_accountant: true,
    },
    {
      id: 'a2', accountant_user_id: USER_A, company_id: 'c2',
      accounting_firm_id: FIRM_1, role: 'könyvelő',
      is_primary: true, is_main_accountant: true,
    },
    {
      id: 'a3', accountant_user_id: USER_A, company_id: 'c3',
      accounting_firm_id: FIRM_1, role: 'könyvelő',
      is_primary: true, is_main_accountant: false,
    },
  ];

  it('admin sees all non-SANDBOX companies', () => {
    const result = buildClientList(USER_B, assignments, COMPANIES);
    // Admin sees all companies that have ANY assignment, not just theirs
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.some(r => r.name === 'Alpha Kft.')).toBe(true);
  });

  it('admin sees companies assigned to other users too', () => {
    const result = buildClientList(USER_B, assignments, COMPANIES);
    expect(result.some(r => r.name === 'Beta Bt.')).toBe(true);
    expect(result.some(r => r.name === 'Gamma Zrt.')).toBe(true);
  });

  it('admin assignedToMe is true only for own assignments', () => {
    const result = buildClientList(USER_B, assignments, COMPANIES);
    const alpha = result.find(r => r.name === 'Alpha Kft.');
    const beta = result.find(r => r.name === 'Beta Bt.');
    expect(alpha?.assignedToMe).toBe(true);  // USER_B is assigned to c1
    expect(beta?.assignedToMe).toBe(false);   // USER_A is assigned to c2
  });
});

// ═══════════════════════════════════════════════════════════════
// SANDBOX exclusion
// ═══════════════════════════════════════════════════════════════

describe('useAccountyClients: SANDBOX exclusion', () => {
  it('SANDBOX company is never shown for non-admin', () => {
    const assignments: AccountyAssignment[] = [
      {
        id: 'a1', accountant_user_id: USER_A, company_id: 'c4',
        accounting_firm_id: FIRM_1, role: 'könyvelő',
        is_primary: true, is_main_accountant: true,
      },
    ];
    const result = buildClientList(USER_A, assignments, COMPANIES);
    expect(result.some(r => r.name === 'SANDBOX')).toBe(false);
  });

  it('SANDBOX company is never shown for admin', () => {
    const assignments: AccountyAssignment[] = [
      {
        id: 'a1', accountant_user_id: USER_B, company_id: 'c4',
        accounting_firm_id: FIRM_1, role: 'iroda_admin',
        is_primary: true, is_main_accountant: true,
      },
    ];
    const result = buildClientList(USER_B, assignments, COMPANIES);
    expect(result.some(r => r.name === 'SANDBOX')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// Invite code assignment integration
// ═══════════════════════════════════════════════════════════════

describe('useAccountyClients: Invite code assignment visibility', () => {
  it('invite-code assignment WITH is_main_accountant=true is visible', () => {
    // This simulates what join-company-as-accountant creates
    const assignments: AccountyAssignment[] = [
      {
        id: 'invite-1', accountant_user_id: USER_A, company_id: 'c1',
        accounting_firm_id: null, // invite code assignments may not have firm
        role: 'könyvelő',
        is_primary: true,
        is_main_accountant: true,
      },
    ];
    const result = buildClientList(USER_A, assignments, COMPANIES);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Alpha Kft.');
  });

  it('invite-code assignment WITHOUT is_main_accountant is INVISIBLE (the bug)', () => {
    // This was the original bug: the edge function didn't set is_main_accountant
    const assignments: AccountyAssignment[] = [
      {
        id: 'invite-1', accountant_user_id: USER_A, company_id: 'c1',
        accounting_firm_id: null,
        role: 'könyvelő',
        is_primary: true,
        is_main_accountant: false, // ← bug: should be true
      },
    ];
    const result = buildClientList(USER_A, assignments, COMPANIES);
    expect(result).toHaveLength(0); // Invisible!
  });

  it('multiple invite-code assignments all visible', () => {
    const assignments: AccountyAssignment[] = [
      {
        id: 'invite-1', accountant_user_id: USER_A, company_id: 'c1',
        accounting_firm_id: null, role: 'könyvelő',
        is_primary: true, is_main_accountant: true,
      },
      {
        id: 'invite-2', accountant_user_id: USER_A, company_id: 'c2',
        accounting_firm_id: null, role: 'könyvelő',
        is_primary: true, is_main_accountant: true,
      },
      {
        id: 'invite-3', accountant_user_id: USER_A, company_id: 'c3',
        accounting_firm_id: null, role: 'könyvelő',
        is_primary: true, is_main_accountant: true,
      },
    ];
    const result = buildClientList(USER_A, assignments, COMPANIES);
    expect(result).toHaveLength(3);
  });
});

// ═══════════════════════════════════════════════════════════════
// Mixed: seeded + invite code assignments
// ═══════════════════════════════════════════════════════════════

describe('useAccountyClients: Mixed seeded and invite code assignments', () => {
  it('shows both seeded (with firm) and invite (without firm) companies', () => {
    const assignments: AccountyAssignment[] = [
      {
        id: 'seeded-1', accountant_user_id: USER_A, company_id: 'c1',
        accounting_firm_id: FIRM_1, role: 'könyvelő',
        is_primary: true, is_main_accountant: true,
      },
      {
        id: 'invite-1', accountant_user_id: USER_A, company_id: 'c2',
        accounting_firm_id: null, role: 'könyvelő',
        is_primary: true, is_main_accountant: true,
      },
    ];
    const result = buildClientList(USER_A, assignments, COMPANIES);
    expect(result).toHaveLength(2);
    expect(result.map(r => r.name).sort()).toEqual(['Alpha Kft.', 'Beta Bt.']);
  });
});
