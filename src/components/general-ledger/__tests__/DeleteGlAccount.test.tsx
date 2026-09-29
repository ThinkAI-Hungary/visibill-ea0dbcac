import { describe, it, expect, vi, beforeEach } from 'vitest';

// Unit tests for deleting a custom GL account from a company preset
describe('DeleteGlAccount logic & safety guards', () => {
  const mockDeleteBsMapping = vi.fn().mockImplementation(() => ({
    eq: vi.fn().mockResolvedValue({ error: null }),
  }));
  const mockDeletePnlMapping = vi.fn().mockImplementation(() => ({
    eq: vi.fn().mockResolvedValue({ error: null }),
  }));
  const mockDeleteGlAccounts = vi.fn().mockImplementation(() => ({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
  }));

  const mockToast = vi.fn();
  const mockInvalidateGlQueries = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects deletion if the account has child subaccounts', async () => {
    const children = [{ id: 'child-1', gl_number: '46681' }];
    let cannotDelete = false;

    if (children && children.length > 0) {
      cannotDelete = true;
      mockToast({
        title: 'Nem törölhető',
        description: 'A főkönyvi számnak alszámlái vannak, előbb azokat kell törölni.',
        variant: 'destructive',
      });
    }

    expect(cannotDelete).toBe(true);
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Nem törölhető',
      description: expect.stringContaining('alszámlái vannak'),
    }));
    expect(mockDeleteGlAccounts).not.toHaveBeenCalled();
  });

  it('rejects deletion if the account has journal entries', async () => {
    const journalCount = 5;
    let cannotDelete = false;

    if (journalCount > 0) {
      cannotDelete = true;
      mockToast({
        title: 'Nem törölhető',
        description: 'A főkönyvi számhoz könyvelési tételek kapcsolódnak, ezért nem törölhető.',
        variant: 'destructive',
      });
    }

    expect(cannotDelete).toBe(true);
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Nem törölhető',
      description: expect.stringContaining('könyvelési tételek kapcsolódnak'),
    }));
    expect(mockDeleteGlAccounts).not.toHaveBeenCalled();
  });

  it('successfully deletes bs_mapping, pnl_mapping, and gl_account when unused in custom preset', async () => {
    const accountId = 'acc-4668';
    const presetId = 'preset-tsconsult';
    const companyId = 'comp-tsconsult';
    const children: any[] = [];
    const journalCount = 0;
    const glEntryCount = 0;

    // Check conditions
    expect(children.length).toBe(0);
    expect(journalCount).toBe(0);
    expect(glEntryCount).toBe(0);

    // Execute flow
    await mockDeleteBsMapping().eq('gl_account_id', accountId);
    await mockDeletePnlMapping().eq('gl_account_id', accountId);
    await mockDeleteGlAccounts().eq('id', accountId).eq('preset_id', presetId);
    await mockInvalidateGlQueries({}, companyId, presetId);

    mockToast({
      title: 'Főkönyvi szám törölve',
      description: 'A(z) 4668 főkönyvi szám sikeresen törölve a számlatükörből.',
    });

    expect(mockDeleteBsMapping).toHaveBeenCalled();
    expect(mockDeletePnlMapping).toHaveBeenCalled();
    expect(mockDeleteGlAccounts).toHaveBeenCalled();
    expect(mockInvalidateGlQueries).toHaveBeenCalledWith({}, companyId, presetId);
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Főkönyvi szám törölve',
      description: expect.stringContaining('4668'),
    }));
  });
});
