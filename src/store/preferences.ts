import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemePreference = 'auto' | 'light' | 'dark';
export type TransparencyPreference = 'auto' | 'full' | 'reduced';

interface PreferencesState {
  /** Device-local UI theme. Synced app settings live separately in the user's repo. */
  theme: ThemePreference;
  transparency: TransparencyPreference;
  setTheme: (theme: ThemePreference) => void;
  setTransparency: (transparency: TransparencyPreference) => void;
}

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: 'auto',
      transparency: 'auto',
      setTheme: (theme) => set({ theme }),
      setTransparency: (transparency) => set({ transparency }),
    }),
    { name: 'cardsguru:preferences' },
  ),
);
