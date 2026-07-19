import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GroupBy } from '@/lib/benefits';

export type ThemePreference = 'auto' | 'light' | 'dark';
export type TransparencyPreference = 'auto' | 'full' | 'reduced';

interface PreferencesState {
  /** Device-local UI theme. Synced app settings live separately in the user's repo. */
  theme: ThemePreference;
  transparency: TransparencyPreference;
  /** How the benefits dashboard aggregates its list. Device-local. */
  benefitGroupBy: GroupBy;
  /** Hide benefits already marked used (incl. "set & forget") on the dashboard. Device-local. */
  hideUsed: boolean;
  /** Reveal ignored benefits on the dashboard so they can be managed/un-ignored. Device-local. */
  showIgnored: boolean;
  setTheme: (theme: ThemePreference) => void;
  setTransparency: (transparency: TransparencyPreference) => void;
  setBenefitGroupBy: (groupBy: GroupBy) => void;
  setHideUsed: (hideUsed: boolean) => void;
  setShowIgnored: (showIgnored: boolean) => void;
}

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: 'auto',
      transparency: 'auto',
      benefitGroupBy: 'frequency',
      hideUsed: false,
      showIgnored: false,
      setTheme: (theme) => set({ theme }),
      setTransparency: (transparency) => set({ transparency }),
      setBenefitGroupBy: (benefitGroupBy) => set({ benefitGroupBy }),
      setHideUsed: (hideUsed) => set({ hideUsed }),
      setShowIgnored: (showIgnored) => set({ showIgnored }),
    }),
    { name: 'cardsguru:preferences' },
  ),
);
