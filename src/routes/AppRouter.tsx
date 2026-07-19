import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { DashboardScreen } from '@/features/dashboard/DashboardScreen';
import { ExpiringScreen } from '@/features/expiring/ExpiringScreen';
import { CardsScreen } from '@/features/cards/CardsScreen';
import { HistoryScreen } from '@/features/history/HistoryScreen';
import { UpdatesScreen } from '@/features/updates/UpdatesScreen';
import { SettingsScreen } from '@/features/settings/SettingsScreen';
import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen';
import { useAppStore } from '@/store/appStore';

function Splash() {
  return (
    <div className="splash">
      <div className="splash__inner">
        <span className="sidebar__logo" style={{ width: 44, height: 44 }} aria-hidden />
        <strong style={{ fontSize: 'var(--text-md)' }}>CardsGuru</strong>
        <span className="spinner" aria-label="Loading" />
      </div>
    </div>
  );
}

export function AppRouter() {
  const status = useAppStore((s) => s.status);
  const init = useAppStore((s) => s.init);

  useEffect(() => {
    void init();
  }, [init]);

  if (status === 'loading') return <Splash />;

  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardScreen />} />
          <Route path="/expiring" element={<ExpiringScreen />} />
          <Route path="/cards" element={<CardsScreen />} />
          <Route path="/history" element={<HistoryScreen />} />
          <Route path="/updates" element={<UpdatesScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/connect" element={<OnboardingScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
