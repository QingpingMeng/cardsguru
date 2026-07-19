import { cn } from '@/lib/cn';
import { GlassPanel } from './GlassPanel';
import type { GlassPanelProps } from './GlassPanel';

/**
 * A padded glass surface for grouped content.
 */
export function GlassCard({ className, ...rest }: GlassPanelProps) {
  return <GlassPanel className={cn('glass-card', className)} {...rest} />;
}
