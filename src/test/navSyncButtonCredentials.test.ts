import { describe, it, expect } from 'vitest';

describe('NavSyncButton credentialsExist check logic', () => {
  const checkCredentialsExist = (navData: { validation_status: string } | null, error: any) => {
    if (!error && navData && (navData.validation_status === 'valid' || navData.validation_status === 'pending')) {
      return true;
    }
    return false;
  };

  it('evaluates to true when validation_status is valid', () => {
    expect(checkCredentialsExist({ validation_status: 'valid' }, null)).toBe(true);
  });

  it('evaluates to true when validation_status is pending', () => {
    expect(checkCredentialsExist({ validation_status: 'pending' }, null)).toBe(true);
  });

  it('evaluates to false when validation_status is invalid', () => {
    expect(checkCredentialsExist({ validation_status: 'invalid' }, null)).toBe(false);
  });

  it('evaluates to false when navData is null or has error', () => {
    expect(checkCredentialsExist(null, null)).toBe(false);
    expect(checkCredentialsExist({ validation_status: 'valid' }, new Error('DB error'))).toBe(false);
  });
});
