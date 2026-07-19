import { useId } from 'react';
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { spring } from '@/lib/motion';

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  const id = useId();
  return (
    <div className={cn('segmented', className)} role="tablist" aria-label={ariaLabel}>
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={selected}
            className="segmented__option"
            onClick={() => onChange(opt.value)}
          >
            {selected && (
              <motion.span
                layoutId={`seg-thumb-${id}`}
                className="segmented__thumb"
                transition={spring}
              />
            )}
            <span className="segmented__label">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
