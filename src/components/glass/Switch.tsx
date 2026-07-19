import { cn } from '@/lib/cn';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Accessible label describing what the switch controls. */
  label?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

/** macOS-style toggle switch. Renders a `role="switch"` button for accessibility. */
export function Switch({ checked, onChange, label, disabled, className, id }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={cn('switch', checked && 'is-on', className)}
      onClick={() => onChange(!checked)}
    >
      <span className="switch__thumb" aria-hidden />
    </button>
  );
}
