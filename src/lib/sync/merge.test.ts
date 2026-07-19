import { describe, it, expect } from 'vitest';
import { mergeRecords, mergeSingle, withoutDeleted, type Mergeable } from './merge';

interface Rec extends Mergeable {
  id: string;
  value: string;
}

describe('mergeRecords (last-write-wins)', () => {
  it('keeps the newer version of a conflicting record', () => {
    const local: Rec[] = [{ id: 'a', value: 'local', updatedAt: '2025-01-02T00:00:00.000Z' }];
    const remote: Rec[] = [{ id: 'a', value: 'remote', updatedAt: '2025-01-01T00:00:00.000Z' }];
    const merged = mergeRecords(local, remote, (r) => r.id);
    expect(merged).toHaveLength(1);
    expect(merged[0].value).toBe('local');
  });

  it('unions records present on only one side', () => {
    const local: Rec[] = [{ id: 'a', value: 'a', updatedAt: '2025-01-01T00:00:00.000Z' }];
    const remote: Rec[] = [{ id: 'b', value: 'b', updatedAt: '2025-01-01T00:00:00.000Z' }];
    const merged = mergeRecords(local, remote, (r) => r.id);
    expect(merged.map((r) => r.id).sort()).toEqual(['a', 'b']);
  });

  it('propagates tombstones when the delete is newer', () => {
    const local: Rec[] = [{ id: 'a', value: 'a', updatedAt: '2025-01-01T00:00:00.000Z' }];
    const remote: Rec[] = [{ id: 'a', value: 'a', updatedAt: '2025-01-03T00:00:00.000Z', deleted: true }];
    const merged = mergeRecords(local, remote, (r) => r.id);
    expect(merged[0].deleted).toBe(true);
    expect(withoutDeleted(merged)).toHaveLength(0);
  });

  it('resurrects a record when an edit is newer than a delete', () => {
    const local: Rec[] = [{ id: 'a', value: 'edited', updatedAt: '2025-01-05T00:00:00.000Z' }];
    const remote: Rec[] = [{ id: 'a', value: 'a', updatedAt: '2025-01-03T00:00:00.000Z', deleted: true }];
    const merged = mergeRecords(local, remote, (r) => r.id);
    expect(withoutDeleted(merged)).toHaveLength(1);
    expect(merged[0].value).toBe('edited');
  });
});

describe('mergeSingle', () => {
  it('returns the record with the newer timestamp', () => {
    const a: Rec = { id: 'p', value: 'old', updatedAt: '2025-01-01T00:00:00.000Z' };
    const b: Rec = { id: 'p', value: 'new', updatedAt: '2025-02-01T00:00:00.000Z' };
    expect(mergeSingle(a, b).value).toBe('new');
    expect(mergeSingle(b, a).value).toBe('new');
  });
});
