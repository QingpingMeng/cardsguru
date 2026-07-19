import type { ReactNode } from 'react';
import { GlassPanel } from '@/components/glass';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <GlassPanel variant="flat" className="empty-state">
      {icon && <div className="empty-state__icon" aria-hidden>{icon}</div>}
      <h3 className="empty-state__title">{title}</h3>
      {description && <p className="empty-state__desc text-secondary">{description}</p>}
      {action && <div className="empty-state__action">{action}</div>}
    </GlassPanel>
  );
}
