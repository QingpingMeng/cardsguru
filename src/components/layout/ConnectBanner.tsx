import { useNavigate } from 'react-router-dom';
import { GlassButton, GlassPanel } from '@/components/glass';
import { useAppStore } from '@/store/appStore';

export function ConnectBanner() {
  const status = useAppStore((s) => s.status);
  const navigate = useNavigate();

  if (status !== 'disconnected') return null;

  return (
    <GlassPanel variant="flat" className="banner">
      <span className="nav__icon" aria-hidden>☁️</span>
      <div className="banner__grow">
        <strong>Stored on this device only</strong>
        <div className="text-secondary" style={{ fontSize: 'var(--text-xs)' }}>
          Connect a private GitHub repo to back up and sync across devices.
        </div>
      </div>
      <GlassButton size="sm" variant="primary" onClick={() => navigate('/connect')}>
        Connect
      </GlassButton>
    </GlassPanel>
  );
}
