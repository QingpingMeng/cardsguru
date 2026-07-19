import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassButton, GlassPanel, SegmentedControl } from '@/components/glass';
import { Modal } from '@/components/ui';
import { NotificationToggle } from '@/features/expiring/NotificationToggle';
import { formatRelativeTime } from '@/lib/format';
import { useAppStore } from '@/store/appStore';
import { usePreferences, type ThemePreference, type TransparencyPreference } from '@/store/preferences';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const TRANSPARENCY_OPTIONS: { value: TransparencyPreference; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'full', label: 'Full' },
  { value: 'reduced', label: 'Reduced' },
];

const THRESHOLD_OPTIONS = [
  { value: '3', label: '3d' },
  { value: '7', label: '7d' },
  { value: '14', label: '14d' },
  { value: '30', label: '30d' },
];

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="list-row">
      <div className="list-row__grow">
        <div>{label}</div>
        {hint && <div className="text-secondary" style={{ fontSize: 'var(--text-xs)' }}>{hint}</div>}
      </div>
      {children}
    </div>
  );
}

export function SettingsScreen() {
  const navigate = useNavigate();
  const theme = usePreferences((s) => s.theme);
  const setTheme = usePreferences((s) => s.setTheme);
  const transparency = usePreferences((s) => s.transparency);
  const setTransparency = usePreferences((s) => s.setTransparency);

  const status = useAppStore((s) => s.status);
  const repoConfig = useAppStore((s) => s.repoConfig);
  const sync = useAppStore((s) => s.sync);
  const profile = useAppStore((s) => s.profile);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const disconnect = useAppStore((s) => s.disconnect);

  const [resetting, setResetting] = useState(false);
  const threshold = String(profile?.settings.notifThresholdDays ?? 7);

  return (
    <div className="stack">
      <header className="toolbar">
        <div className="toolbar__grow">
          <h1 className="page-title">Settings</h1>
        </div>
      </header>

      <h2 className="section-title">Appearance</h2>
      <GlassPanel variant="flat" className="list">
        <div className="divide">
          <Row label="Theme">
            <SegmentedControl ariaLabel="Theme" options={THEME_OPTIONS} value={theme} onChange={setTheme} />
          </Row>
          <Row label="Transparency" hint="Reduce the glass blur for legibility.">
            <SegmentedControl
              ariaLabel="Transparency"
              options={TRANSPARENCY_OPTIONS}
              value={transparency}
              onChange={setTransparency}
            />
          </Row>
        </div>
      </GlassPanel>

      <h2 className="section-title">Notifications</h2>
      <GlassPanel variant="flat" className="list">
        <div className="divide">
          <Row label="Expiring-soon window" hint="Warn me this many days before a credit resets.">
            <SegmentedControl
              ariaLabel="Expiring window"
              options={THRESHOLD_OPTIONS}
              value={threshold}
              onChange={(v) => void updateSettings({ notifThresholdDays: Number(v) })}
            />
          </Row>
          <Row label="Local notifications" hint="Fires while the app or its service worker is active.">
            <NotificationToggle />
          </Row>
        </div>
      </GlassPanel>

      <h2 className="section-title">Sync</h2>
      <GlassPanel variant="flat" className="list">
        <div className="divide">
          {status === 'connected' && repoConfig ? (
            <Row
              label={`${repoConfig.owner}/${repoConfig.repo}`}
              hint={`Last synced ${formatRelativeTime(sync.lastSyncAt)}`}
            >
              <GlassButton size="sm" variant="secondary" onClick={() => navigate('/connect')}>
                Manage
              </GlassButton>
            </Row>
          ) : (
            <Row label="Not connected" hint="Data is stored on this device only.">
              <GlassButton size="sm" variant="primary" onClick={() => navigate('/connect')}>
                Connect
              </GlassButton>
            </Row>
          )}
        </div>
      </GlassPanel>

      <h2 className="section-title">Data</h2>
      <GlassPanel variant="flat" className="list">
        <div className="divide">
          <Row label="Reset this device" hint="Clears local data and disconnects sync. Synced data in your repo is kept.">
            <GlassButton size="sm" variant="danger" onClick={() => setResetting(true)}>
              Reset
            </GlassButton>
          </Row>
        </div>
      </GlassPanel>

      <p className="text-secondary" style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--space-4)' }}>
        CardsGuru is informational only and not financial advice. Benefit terms are sourced from
        issuer pages and may change — always verify with your issuer.
      </p>

      <Modal
        open={resetting}
        onClose={() => setResetting(false)}
        title="Reset this device?"
        footer={
          <>
            <GlassButton variant="ghost" onClick={() => setResetting(false)}>
              Cancel
            </GlassButton>
            <GlassButton
              variant="danger"
              block
              onClick={() => {
                void disconnect();
                setResetting(false);
                navigate('/');
              }}
            >
              Reset
            </GlassButton>
          </>
        }
      >
        <p className="text-secondary">
          This removes all cards, completions, and the saved token from this device. If you're
          connected to a repo, your data there is preserved and can be re-synced.
        </p>
      </Modal>
    </div>
  );
}
