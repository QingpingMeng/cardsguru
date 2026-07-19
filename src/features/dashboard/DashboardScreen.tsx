import { useNavigate } from 'react-router-dom';
import { GlassButton, GlassPanel } from '@/components/glass';
import { EmptyState } from '@/components/ui';
import { useBenefits } from '@/hooks/useBenefits';
import { formatFrequency, formatMoney } from '@/lib/format';
import { useAppStore } from '@/store/appStore';
import { BenefitCard } from './BenefitCard';

export function DashboardScreen() {
  const navigate = useNavigate();
  const cards = useAppStore((s) => s.cards);
  const { derived, groups, soon } = useBenefits();

  const usedCount = derived.filter((d) => d.used).length;
  const remainingValue = derived
    .filter((d) => !d.used && d.benefit.value)
    .reduce((sum, d) => sum + (d.benefit.value?.amount ?? 0), 0);

  return (
    <div className="stack">
      <header className="toolbar">
        <div className="toolbar__grow">
          <h1 className="page-title">Benefits</h1>
          <p className="text-secondary">Your recurring credits, grouped by reset cycle.</p>
        </div>
      </header>

      {cards.length === 0 ? (
        <EmptyState
          icon="💳"
          title="No cards yet"
          description="Add the credit cards you own and CardsGuru will surface every recurring benefit you can still use this period."
          action={
            <GlassButton variant="primary" onClick={() => navigate('/cards')}>
              Add your first card
            </GlassButton>
          }
        />
      ) : derived.length === 0 ? (
        <EmptyState
          icon="🎉"
          title="Nothing to track"
          description="Your cards don't have recurring benefits in the catalog yet. Check for catalog updates."
          action={
            <GlassButton variant="secondary" onClick={() => navigate('/updates')}>
              Check for updates
            </GlassButton>
          }
        />
      ) : (
        <>
          <div className="stat-grid">
            <GlassPanel className="stat">
              <span className="stat__value">{formatMoney({ amount: remainingValue, currency: 'USD' })}</span>
              <span className="stat__label">Unused value this period</span>
            </GlassPanel>
            <GlassPanel className="stat">
              <span className="stat__value">
                {usedCount}/{derived.length}
              </span>
              <span className="stat__label">Benefits completed</span>
            </GlassPanel>
            <GlassPanel className="stat">
              <span className="stat__value" style={{ color: soon.length ? 'var(--color-warning)' : undefined }}>
                {soon.length}
              </span>
              <span className="stat__label">Expiring soon</span>
            </GlassPanel>
          </div>

          {groups.map((group) => (
            <section key={group.frequency}>
              <h2 className="section-title">{formatFrequency(group.frequency)}</h2>
              <div className="card-grid">
                {group.items.map((d) => (
                  <BenefitCard key={`${d.card.userCardId}:${d.benefit.id}`} d={d} />
                ))}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
