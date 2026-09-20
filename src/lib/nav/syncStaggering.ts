/**
 * Load Staggering (Hajnali Idő-ablakos Terheléselosztás) for NAV Auto-Sync
 *
 * Evenly distributes companies across dawn time slots (01:00 - 05:00)
 * based on deterministic UUID modulo hashing to prevent NAV and server throttling.
 */

export interface SyncSlotInfo {
  slot: number; // 0, 1, 2, 3
  utcHour: number; // 1, 2, 3, 4
  localCetHour: string; // e.g. "02:00 CET / 03:00 CEST"
}

export const SYNC_SLOTS: SyncSlotInfo[] = [
  { slot: 0, utcHour: 1, localCetHour: '02:00 CET / 03:00 CEST' },
  { slot: 1, utcHour: 2, localCetHour: '03:00 CET / 04:00 CEST' },
  { slot: 2, utcHour: 3, localCetHour: '04:00 CET / 05:00 CEST' },
  { slot: 3, utcHour: 4, localCetHour: '05:00 CET / 06:00 CEST' },
];

export const TOTAL_SYNC_BUCKETS = 4;

/**
 * Computes a deterministic sync bucket (0..totalBuckets-1) for a company UUID.
 *
 * Uses the first 8 hex characters of the UUID to form a 32-bit integer,
 * modulo totalBuckets. Because UUID hex characters are uniformly distributed,
 * this gives an even ~25% distribution across all 4 slots.
 */
export function getCompanySyncBucket(companyId: string, totalBuckets = TOTAL_SYNC_BUCKETS): number {
  if (!companyId || typeof companyId !== 'string' || totalBuckets <= 1) return 0;
  const cleanHex = companyId.replace(/[^0-9a-fA-F]/g, '').slice(0, 8);
  if (!cleanHex) {
    let hash = 0;
    for (let i = 0; i < companyId.length; i++) {
      hash = (hash * 31 + companyId.charCodeAt(i)) >>> 0;
    }
    return hash % totalBuckets;
  }
  const intVal = parseInt(cleanHex, 16);
  return isNaN(intVal) ? 0 : Math.abs(intVal) % totalBuckets;
}

/**
 * Returns slot metadata for a given company ID.
 */
export function getCompanySyncSlotInfo(companyId: string): SyncSlotInfo {
  const slot = getCompanySyncBucket(companyId, TOTAL_SYNC_BUCKETS);
  return SYNC_SLOTS[slot] || SYNC_SLOTS[0];
}
