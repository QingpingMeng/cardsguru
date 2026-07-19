import { useEffect, useState } from 'react';
import { Badge, GlassButton } from '@/components/glass';
import { getPermission, requestPermission, type PermissionState } from '@/lib/notifications';

export function NotificationToggle() {
  const [perm, setPerm] = useState<PermissionState>('default');

  useEffect(() => {
    setPerm(getPermission());
  }, []);

  if (perm === 'unsupported') {
    return <span className="text-secondary" style={{ fontSize: 'var(--text-xs)' }}>Not supported here</span>;
  }
  if (perm === 'granted') {
    return <Badge tone="success">Notifications on</Badge>;
  }
  if (perm === 'denied') {
    return <span className="text-secondary" style={{ fontSize: 'var(--text-xs)' }}>Blocked in browser</span>;
  }
  return (
    <GlassButton
      size="sm"
      variant="secondary"
      onClick={async () => setPerm(await requestPermission())}
    >
      Enable notifications
    </GlassButton>
  );
}
