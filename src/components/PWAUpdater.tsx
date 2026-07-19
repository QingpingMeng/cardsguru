import { useRegisterSW } from 'virtual:pwa-register/react';
import { GlassButton, GlassPanel } from '@/components/glass';

/**
 * Renders a small toast when the service worker has cached the app for offline
 * use, or when a new version is waiting. Kept out of the router tree (mounted in
 * main.tsx) so component tests don't pull in the Vite virtual module.
 */
export function PWAUpdater() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!offlineReady && !needRefresh) return null;

  const dismiss = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  return (
    <div className="pwa-toast" role="status" aria-live="polite">
      <GlassPanel variant="elevated" className="pwa-toast__panel">
        <span className="pwa-toast__text">
          {needRefresh ? 'A new version of CardsGuru is available.' : 'CardsGuru is ready to work offline.'}
        </span>
        <div className="row gap-2">
          {needRefresh && (
            <GlassButton size="sm" variant="primary" onClick={() => void updateServiceWorker(true)}>
              Reload
            </GlassButton>
          )}
          <GlassButton size="sm" variant="ghost" onClick={dismiss}>
            Dismiss
          </GlassButton>
        </div>
      </GlassPanel>
    </div>
  );
}
