/**
 * Last-write-wins merge utilities for cross-device sync.
 *
 * Records carry an ISO `updatedAt` and an optional `deleted` tombstone. For any
 * two versions of the same record (same key), the one with the newer `updatedAt`
 * wins. Tombstones participate in the merge so deletes propagate; callers strip
 * tombstoned records when reading for the UI but keep them in the synced file.
 */

export interface Mergeable {
  updatedAt: string;
  deleted?: boolean;
}

/** ISO-8601 timestamps sort correctly as plain strings; ties keep `a`. */
function newer<T extends Mergeable>(a: T, b: T): T {
  return b.updatedAt > a.updatedAt ? b : a;
}

/**
 * Merge two record arrays by key, keeping the newest version of each (including
 * tombstones). Order is not significant.
 */
export function mergeRecords<T extends Mergeable>(
  local: readonly T[],
  remote: readonly T[],
  key: (item: T) => string,
): T[] {
  const byKey = new Map<string, T>();
  for (const item of local) byKey.set(key(item), item);
  for (const item of remote) {
    const k = key(item);
    const existing = byKey.get(k);
    byKey.set(k, existing ? newer(existing, item) : item);
  }
  return [...byKey.values()];
}

/** Remove tombstoned records for presentation. */
export function withoutDeleted<T extends Mergeable>(items: readonly T[]): T[] {
  return items.filter((i) => !i.deleted);
}

/** Pick the newer of two single records (e.g. profile). */
export function mergeSingle<T extends Mergeable>(local: T, remote: T): T {
  return newer(local, remote);
}
