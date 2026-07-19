import { GlassPanel } from '@/components/glass';
import { EmptyState } from '@/components/ui';
import { BenefitCard } from '@/features/dashboard/BenefitCard';
import { useBenefits } from '@/hooks/useBenefits';
import { NotificationToggle } from './NotificationToggle';

export function ExpiringScreen() {
  const { soon, threshold } = useBenefits();

  return (
    <div className="stack">
      <header className="toolbar">
        <div className="toolbar__grow">
          <h1 className="page-title">Expiring soon</h1>
          <p className="text-secondary">Unused credits resetting within {threshold} days.</p>
        </div>
      </header>

      <GlassPanel variant="flat" className="banner">
        <span className="nav__icon" aria-hidden>🔔</span>
        <div className="banner__grow">
          <strong>Reminders</strong>
          <div className="text-secondary" style={{ fontSize: 'var(--text-xs)' }}>
            Get a local notification when a credit is about to reset.
          </div>
        </div>
        <NotificationToggle />
      </GlassPanel>

      {soon.length === 0 ? (
        <EmptyState
          icon="✅"
          title="Nothing expiring"
          description={`No unused credits reset within ${threshold} days. You're all caught up.`}
        />
      ) : (
        <div className="card-grid">
          {soon.map((d) => (
            <BenefitCard key={`${d.card.userCardId}:${d.benefit.id}`} d={d} />
          ))}
        </div>
      )}
    </div>
  );
}
