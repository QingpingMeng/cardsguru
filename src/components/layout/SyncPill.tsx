import { useAppStore } from '@/store/appStore';
import { formatRelativeTime } from '@/lib/format';

export function SyncPill() {
  const status = useAppStore((s) => s.status);
  const sync = useAppStore((s) => s.sync);
  const syncNow = useAppStore((s) => s.syncNow);

  if (status !== 'connected') return null;

  const label =
    sync.state === 'syncing'
      ? 'Syncing…'
      : sync.state === 'offline'
        ? 'Offline'
        : sync.state === 'error'
          ? 'Sync error'
          : `Synced ${formatRelativeTime(sync.lastSyncAt)}`;

  return (
    <button
      type="button"
      className="sync-pill"
      onClick={() => void syncNow()}
      title={sync.message ?? 'Sync now'}
    >
      <span className={`sync-pill__dot sync-pill__dot--${sync.state}`} aria-hidden />
      {label}
    </button>
  );
}
