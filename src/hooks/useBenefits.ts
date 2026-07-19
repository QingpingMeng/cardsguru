import { useMemo } from 'react';
import { useAppStore } from '@/store/appStore';
import { deriveBenefits, expiringSoon, groupByFrequency } from '@/lib/benefits';

/** Shared, memoized view of the user's benefits derived from catalog + owned cards. */
export function useBenefits() {
  const catalog = useAppStore((s) => s.catalog);
  const cards = useAppStore((s) => s.cards);
  const completions = useAppStore((s) => s.completions);
  const threshold = useAppStore((s) => s.profile?.settings.notifThresholdDays ?? 7);

  return useMemo(() => {
    const derived = deriveBenefits({ catalog, cards, completions, thresholdDays: threshold });
    return {
      derived,
      soon: expiringSoon(derived),
      groups: groupByFrequency(derived),
      threshold,
    };
  }, [catalog, cards, completions, threshold]);
}
