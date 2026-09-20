import { describe, it, expect } from 'vitest';
import {
  getCompanySyncBucket,
  getCompanySyncSlotInfo,
  SYNC_SLOTS,
  TOTAL_SYNC_BUCKETS,
} from '../syncStaggering';

describe('Load Staggering (Hajnali Idő-ablakos Terheléselosztás)', () => {
  it('is completely deterministic for identical UUIDs', () => {
    const uuid1 = '8e841840-7e02-4ece-b596-5c08dca9881b';
    const b1 = getCompanySyncBucket(uuid1);
    const b2 = getCompanySyncBucket(uuid1);
    expect(b1).toBe(b2);
    expect(b1).toBe(0); // 0x8e841840 % 4 = 0
  });

  it('matches known test vectors', () => {
    // 0x8e841840 -> % 4 = 0
    expect(getCompanySyncBucket('8e841840-7e02-4ece-b596-5c08dca9881b')).toBe(0);
    // 0x00000001 -> % 4 = 1
    expect(getCompanySyncBucket('00000001-0000-0000-0000-000000000000')).toBe(1);
    // 0x00000002 -> % 4 = 2
    expect(getCompanySyncBucket('00000002-0000-0000-0000-000000000000')).toBe(2);
    // 0x00000003 -> % 4 = 3
    expect(getCompanySyncBucket('00000003-0000-0000-0000-000000000000')).toBe(3);
  });

  it('safely handles edge cases without throwing', () => {
    expect(getCompanySyncBucket('')).toBe(0);
    expect(getCompanySyncBucket(null as any)).toBe(0);
    expect(getCompanySyncBucket(undefined as any)).toBe(0);
    expect(getCompanySyncBucket('non-hex-identifier-company')).toBeGreaterThanOrEqual(0);
    expect(getCompanySyncBucket('non-hex-identifier-company')).toBeLessThan(TOTAL_SYNC_BUCKETS);
  });

  it('distributes 1000 UUIDs evenly across 4 buckets (~25% each)', () => {
    const counts = [0, 0, 0, 0];
    const total = 1000;

    // Generate mock UUIDv4 strings
    for (let i = 0; i < total; i++) {
      // Form random hex prefix
      const hex = Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');
      const fakeUuid = `${hex}-4000-8000-000000000000`;
      const bucket = getCompanySyncBucket(fakeUuid);
      expect(bucket).toBeGreaterThanOrEqual(0);
      expect(bucket).toBeLessThan(4);
      counts[bucket]++;
    }

    // Expect each bucket to have between 18% and 32% of the load (uniform distribution)
    for (let b = 0; b < 4; b++) {
      const percentage = (counts[b] / total) * 100;
      expect(percentage).toBeGreaterThan(18);
      expect(percentage).toBeLessThan(32);
    }
  });

  it('returns appropriate slot metadata from getCompanySyncSlotInfo', () => {
    const slotInfo0 = getCompanySyncSlotInfo('8e841840-7e02-4ece-b596-5c08dca9881b');
    expect(slotInfo0.slot).toBe(0);
    expect(slotInfo0.utcHour).toBe(1);
    expect(slotInfo0.localCetHour).toBe('02:00 CET / 03:00 CEST');

    expect(SYNC_SLOTS).toHaveLength(4);
    expect(SYNC_SLOTS[0].utcHour).toBe(1);
    expect(SYNC_SLOTS[1].utcHour).toBe(2);
    expect(SYNC_SLOTS[2].utcHour).toBe(3);
    expect(SYNC_SLOTS[3].utcHour).toBe(4);
  });
});
