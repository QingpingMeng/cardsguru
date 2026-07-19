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
  setTheme: (theme: ThemePreference) => void;
  setTransparency: (transparency: TransparencyPreference) => void;
  setBenefitGroupBy: (groupBy: GroupBy) => void;
}

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: 'auto',
      transparency: 'auto',
      benefitGroupBy: 'frequency',
      setTheme: (theme) => set({ theme }),
      setTransparency: (transparency) => set({ transparency }),
      setBenefitGroupBy: (benefitGroupBy) => set({ benefitGroupBy }),
    }),
    { name: 'cardsguru:preferences' },
  ),
);
