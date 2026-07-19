import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassButton, GlassPanel } from '@/components/glass';
import { TextField } from '@/components/ui';
import { formatRelativeTime } from '@/lib/format';
import { useAppStore } from '@/store/appStore';

export function OnboardingScreen() {
  const navigate = useNavigate();
  const status = useAppStore((s) => s.status);
  const repoConfig = useAppStore((s) => s.repoConfig);
  const sync = useAppStore((s) => s.sync);
  const connect = useAppStore((s) => s.connect);
  const disconnect = useAppStore((s) => s.disconnect);
  const syncNow = useAppStore((s) => s.syncNow);

  const [token, setToken] = useState('');
  const [owner, setOwner] = useState('');
  const [repo, setRepo] = useState('');
  const [branch, setBranch] = useState('');
  const [basePath, setBasePath] = useState('cardsguru');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === 'connected' && repoConfig) {
    return (
      <div className="stack">
        <header className="toolbar">
          <div className="toolbar__grow">
            <h1 className="page-title">Sync</h1>
            <p className="text-secondary">Your data syncs to a private GitHub repo.</p>
          </div>
        </header>
        <GlassPanel className="stack gap-3" style={{ padding: 'var(--space-5)' }}>
          <div className="row spread">
            <div>
              <div className="owned-card__name">
                {repoConfig.owner}/{repoConfig.repo}
              </div>
              <div className="text-secondary" style={{ fontSize: 'var(--text-xs)' }}>
                {repoConfig.basePath ?? 'cardsguru'}/ · last synced {formatRelativeTime(sync.lastSyncAt)}
              </div>
            </div>
            <span className={`sync-pill__dot sync-pill__dot--${sync.state}`} aria-hidden />
          </div>
          {sync.message && <p className="field__error">{sync.message}</p>}
          <div className="row gap-3">
            <GlassButton variant="primary" onClick={() => void syncNow()}>
              Sync now
            </GlassButton>
            <GlassButton variant="ghost" onClick={() => navigate('/')}>
              Done
            </GlassButton>
            <div className="grow" />
            <GlassButton variant="danger" onClick={() => void disconnect()}>
              Disconnect
            </GlassButton>
          </div>
        </GlassPanel>
      </div>
    );
  }

  const submit = async () => {
    setError(null);
    if (!token || !owner || !repo) {
      setError('Token, owner and repository are required.');
      return;
    }
    setBusy(true);
    try {
      const info = await connect({
        token: token.trim(),
        owner: owner.trim(),
        repo: repo.trim(),
        branch: branch.trim() || undefined,
        basePath: basePath.trim() || undefined,
      });
      if (!info.ok) {
        setError(info.message ?? 'Could not connect.');
      } else if (!info.canWrite) {
        setError('That token cannot write to the repo. Grant it Contents read & write.');
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <header className="toolbar">
        <div className="toolbar__grow">
          <h1 className="page-title">Connect GitHub</h1>
          <p className="text-secondary">Sync your cards and completions to a private repo you own.</p>
        </div>
      </header>

      <div className="stack gap-4">
        <GlassPanel variant="flat" className="stack gap-2" style={{ padding: 'var(--space-4)' }}>
          <strong>Setup</strong>
          <ol className="text-secondary" style={{ fontSize: 'var(--text-sm)', paddingLeft: '1.2em', lineHeight: 1.6 }}>
            <li>Create a new private GitHub repository (e.g. <span className="mono">cardsguru-data</span>).</li>
            <li>
              Create a{' '}
              <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">
                fine-grained personal access token
              </a>{' '}
              scoped to only that repo, with <strong>Contents: Read and write</strong>.
            </li>
            <li>Paste the details below. The token is stored only on this device.</li>
          </ol>
        </GlassPanel>

        <GlassPanel className="stack gap-4" style={{ padding: 'var(--space-5)' }}>
          <TextField
            label="Personal access token"
            type="password"
            placeholder="github_pat_…"
            value={token}
            autoComplete="off"
            onChange={(e) => setToken(e.target.value)}
          />
          <div className="field-grid">
            <TextField
              label="Owner"
              placeholder="your-username"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
            />
            <TextField
              label="Repository"
              placeholder="cardsguru-data"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
            />
            <TextField
              label="Branch (optional)"
              placeholder="default branch"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
            />
            <TextField
              label="Folder"
              placeholder="cardsguru"
              value={basePath}
              onChange={(e) => setBasePath(e.target.value)}
            />
          </div>
          {error && <p className="field__error">{error}</p>}
          <div className="row gap-3">
            <GlassButton variant="primary" onClick={() => void submit()} disabled={busy}>
              {busy ? 'Connecting…' : 'Connect & sync'}
            </GlassButton>
            <GlassButton variant="ghost" onClick={() => navigate('/')} disabled={busy}>
              Skip for now
            </GlassButton>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
