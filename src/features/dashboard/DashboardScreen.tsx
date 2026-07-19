import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassButton, GlassPanel, SegmentedControl, Switch } from '@/components/glass';
import { EmptyState } from '@/components/ui';
import { useBenefits } from '@/hooks/useBenefits';
import { groupBenefits, type GroupBy } from '@/lib/benefits';
import { formatMoney } from '@/lib/format';
import { useAppStore } from '@/store/appStore';
import { usePreferences } from '@/store/preferences';
import { BenefitSection } from './BenefitSection';

const GROUP_BY_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: 'frequency', label: 'Cycle' },
  { value: 'card', label: 'Card' },
  { value: 'category', label: 'Category' },
];

const GROUP_BY_HINT: Record<GroupBy, string> = {
  frequency: 'grouped by reset cycle',
  card: 'grouped by card',
  category: 'grouped by category',
};

export function DashboardScreen() {
  const navigate = useNavigate();
  const cards = useAppStore((s) => s.cards);
  const groupBy = usePreferences((s) => s.benefitGroupBy);
  const setGroupBy = usePreferences((s) => s.setBenefitGroupBy);
  const hideUsed = usePreferences((s) => s.hideUsed);
  const setHideUsed = usePreferences((s) => s.setHideUsed);
  const showIgnored = usePreferences((s) => s.showIgnored);
  const setShowIgnored = usePreferences((s) => s.setShowIgnored);
  const { derived, soon } = useBenefits();

  // Ignored benefits are opted out of tracking, so stats reflect only the rest.
  const tracked = useMemo(() => derived.filter((d) => !d.ignored), [derived]);
  const ignoredCount = derived.length - tracked.length;

  const usedCount = tracked.filter((d) => d.used).length;
  const remainingValue = tracked
    .filter((d) => !d.used && d.benefit.value)
    .reduce((sum, d) => sum + (d.benefit.value?.amount ?? 0), 0);

  const visible = useMemo(() => {
    let list = showIgnored ? derived : tracked;
    if (hideUsed) list = list.filter((d) => !d.used);
    return list;
  }, [derived, tracked, showIgnored, hideUsed]);

  const sections = useMemo(() => groupBenefits(visible, groupBy), [visible, groupBy]);

  return (
    <div className="stack">
      <header className="toolbar">
        <div className="toolbar__grow">
          <h1 className="page-title">Benefits</h1>
          <p className="text-secondary">Your recurring credits, {GROUP_BY_HINT[groupBy]}.</p>
        </div>
        {derived.length > 0 && (
          <SegmentedControl
            ariaLabel="Group benefits by"
            options={GROUP_BY_OPTIONS}
            value={groupBy}
            onChange={setGroupBy}
          />
        )}
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
                {usedCount}/{tracked.length}
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

          <div className="view-options">
            <label className="view-option">
              <Switch checked={hideUsed} onChange={setHideUsed} label="Hide benefits already used" />
              <span className="view-option__label">Hide used</span>
            </label>
            {ignoredCount > 0 && (
              <label className="view-option">
                <Switch
                  checked={showIgnored}
                  onChange={setShowIgnored}
                  label="Show ignored benefits"
                />
                <span className="view-option__label">Show ignored ({ignoredCount})</span>
              </label>
            )}
          </div>

          {sections.length === 0 ? (
            <EmptyState
              icon="🫥"
              title="Everything's hidden"
              description={
                hideUsed
                  ? "You've used every tracked benefit this period. Turn off “Hide used” to see them again."
                  : 'Your filters are hiding every benefit. Adjust the view options above.'
              }
            />
          ) : (
            sections.map((section) => (
              <BenefitSection key={`${groupBy}:${section.key}`} section={section} />
            ))
          )}
        </>
      )}
    </div>
  );
}
