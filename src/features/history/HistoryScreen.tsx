import { useMemo } from 'react';
import { Badge, GlassPanel } from '@/components/glass';
import { EmptyState } from '@/components/ui';
import { indexCatalog } from '@/lib/catalog/helpers';
import { AUTO_PERIOD_KEY } from '@/lib/data/schema';
import { formatDate, formatMoney } from '@/lib/format';
import { useAppStore } from '@/store/appStore';

export function HistoryScreen() {
  const catalog = useAppStore((s) => s.catalog);
  const cards = useAppStore((s) => s.cards);
  const completions = useAppStore((s) => s.completions);

  const index = useMemo(() => indexCatalog(catalog), [catalog]);
  const cardsById = useMemo(
    () => new Map(cards.map((c) => [c.userCardId, c])),
    [cards],
  );

  const entries = useMemo(
    () =>
      [...completions]
        .filter((c) => c.status === 'used' && c.periodKey !== AUTO_PERIOD_KEY)
        .sort((a, b) => b.completedAt.localeCompare(a.completedAt)),
    [completions],
  );

  return (
    <div className="stack">
      <header className="toolbar">
        <div className="toolbar__grow">
          <h1 className="page-title">History</h1>
          <p className="text-secondary">Benefits you've marked as used.</p>
        </div>
      </header>

      {entries.length === 0 ? (
        <EmptyState
          icon="🗂️"
          title="No history yet"
          description="Mark a benefit as used and it will show up here."
        />
      ) : (
        <GlassPanel variant="flat" className="list">
          <div className="divide">
            {entries.map((c) => {
              const benefit = index.benefitsById.get(c.benefitId);
              const card = cardsById.get(c.userCardId);
              const value = formatMoney(benefit?.value);
              return (
                <div key={c.id} className="list-row">
                  <div className="list-row__grow">
                    <div>{benefit?.title ?? c.benefitId}</div>
                    <div className="text-secondary" style={{ fontSize: 'var(--text-xs)' }}>
                      {card ? `•••• ${card.last4} · ` : ''}
                      {c.periodKey} · {formatDate(c.completedAt)}
                    </div>
                  </div>
                  {value ? <Badge tone="success">{value}</Badge> : <Badge tone="neutral">Used</Badge>}
                </div>
              );
            })}
          </div>
        </GlassPanel>
      )}
    </div>
  );
}
