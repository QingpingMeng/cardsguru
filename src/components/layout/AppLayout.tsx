import { useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { GlassPanel } from '@/components/glass';
import { BrandMark } from '@/components/BrandMark';
import { SyncPill } from '@/components/layout/SyncPill';
import { ConnectBanner } from '@/components/layout/ConnectBanner';
import { useBenefits } from '@/hooks/useBenefits';
import { getPermission, showLocalNotifications } from '@/lib/notifications';
import { formatDaysRemaining, formatMoney } from '@/lib/format';

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Benefits', icon: '✨' },
  { to: '/expiring', label: 'Expiring', icon: '⏳' },
  { to: '/cards', label: 'My Cards', icon: '💳' },
  { to: '/history', label: 'History', icon: '🗂️' },
  { to: '/updates', label: 'Updates', icon: '🔄' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
];

function Sidebar({ expiringCount }: { expiringCount: number }) {
  return (
    <GlassPanel variant="strong" className="sidebar">
      <div className="sidebar__brand">
        <BrandMark className="sidebar__logo" />
        <span className="sidebar__title">CardsGuru</span>
      </div>
      <nav className="nav">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `nav__item${isActive ? ' is-active' : ''}`}
          >
            <span className="nav__icon" aria-hidden>{item.icon}</span>
            <span className="nav__label">{item.label}</span>
            {item.to === '/expiring' && expiringCount > 0 && (
              <span className="nav__count">{expiringCount}</span>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar__spacer" />
    </GlassPanel>
  );
}

function TabBar({ expiringCount }: { expiringCount: number }) {
  return (
    <GlassPanel variant="strong" className="tabbar">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) => `tabbar__item${isActive ? ' is-active' : ''}`}
        >
          <span className="tabbar__icon" aria-hidden>{item.icon}</span>
          <span>{item.label}</span>
          {item.to === '/expiring' && expiringCount > 0 && (
            <span className="tabbar__badge">{expiringCount}</span>
          )}
        </NavLink>
      ))}
    </GlassPanel>
  );
}

export function AppLayout() {
  const { soon } = useBenefits();

  useEffect(() => {
    if (getPermission() !== 'granted' || soon.length === 0) return;
    void showLocalNotifications(
      soon.map((d) => {
        const value = formatMoney(d.benefit.value);
        return {
          key: `${d.card.userCardId}:${d.benefit.id}:${d.periodKey}`,
          title: `${d.benefit.title} ${formatDaysRemaining(d.status.daysRemaining).toLowerCase()}`,
          body: `${value ? `${value} · ` : ''}•••• ${d.card.last4}`,
        };
      }),
    );
  }, [soon]);

  return (
    <div className="app-frame">
      <Sidebar expiringCount={soon.length} />
      <main className="main">
        <div className="main__topbar">
          <SyncPill />
        </div>
        <div className="container">
          <ConnectBanner />
          <Outlet />
        </div>
      </main>
      <TabBar expiringCount={soon.length} />
    </div>
  );
}
