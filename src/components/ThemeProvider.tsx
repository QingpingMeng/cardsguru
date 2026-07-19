import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { usePreferences } from '@/store/preferences';

/**
 * Applies the user's theme + transparency preferences to the document root as
 * data-attributes. CSS handles the actual "auto" behavior via media queries, so
 * we only set an attribute when the user has chosen an explicit override.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = usePreferences((s) => s.theme);
  const transparency = usePreferences((s) => s.transparency);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    if (transparency === 'auto') root.removeAttribute('data-transparency');
    else root.setAttribute('data-transparency', transparency);
  }, [transparency]);

  return <>{children}</>;
}
