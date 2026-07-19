import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type GlassVariant = 'regular' | 'strong' | 'elevated' | 'flat';

export interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  variant?: GlassVariant;
  interactive?: boolean;
}

/**
 * Core Liquid Glass surface. Everything else composes from this.
 */
export const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(function GlassPanel(
  { variant = 'regular', interactive = false, className, children, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'glass',
        variant !== 'regular' && `glass--${variant}`,
        interactive && 'glass-interactive',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
});
