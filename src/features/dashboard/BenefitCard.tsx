import { GlassButton, GlassCard, Badge, Switch } from '@/components/glass';
import type { BadgeTone } from '@/components/glass';
import { CardArt } from '@/components/CardArt';
import type { DerivedBenefit } from '@/lib/benefits';
import {
  formatDaysRemaining,
  formatFrequency,
  formatMoney,
  formatPeriodWindow,
  formatResetAnchor,
} from '@/lib/format';
import { useAppStore } from '@/store/appStore';

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function BenefitCard({ d }: { d: DerivedBenefit }) {
  const setCompletion = useAppStore((s) => s.setCompletion);
  const setAutoBenefit = useAppStore((s) => s.setAutoBenefit);
  const setIgnoreBenefit = useAppStore((s) => s.setIgnoreBenefit);
  const { benefit, card, catalogCard, status, used, auto, ignored, periodKey } = d;

  const { start, end } = status.period;
  const total = end.getTime() - start.getTime();
  const elapsed = total > 0 ? clamp((Date.now() - start.getTime()) / total, 0, 1) : 0;

  const fillModifier = used
    ? 'success'
    : status.expiringSoon
      ? status.daysRemaining <= 2
        ? 'danger'
        : 'warning'
      : '';

  let dayTone: BadgeTone = 'neutral';
  if (used) dayTone = 'success';
  else if (status.expiringSoon) dayTone = status.daysRemaining <= 2 ? 'danger' : 'warning';

  const value = formatMoney(benefit.value);
  const isOneTime = benefit.frequency === 'one_time';

  const toggle = () =>
    void setCompletion(card.userCardId, benefit.id, periodKey, used ? null : 'used');

  const toggleAuto = (next: boolean) => void setAutoBenefit(card.userCardId, benefit.id, next);

  const toggleIgnore = () => void setIgnoreBenefit(card.userCardId, benefit.id, !ignored);

  return (
    <GlassCard
      className={`benefit${used ? ' is-used' : ''}${auto ? ' is-auto' : ''}${ignored ? ' is-ignored' : ''}`}
    >
      <div className="benefit__head">
        <div className="stack gap-1">
          <span className="benefit__title">{benefit.title}</span>
          <span className="benefit__meta">
            {formatFrequency(benefit.frequency)}
            {!isOneTime && ` · resets ${formatResetAnchor(benefit.resetAnchor)}`}
          </span>
          {!isOneTime && <span className="benefit__meta">{formatPeriodWindow(start, end)}</span>}
        </div>
        {value && <span className="benefit__value">{value}</span>}
      </div>

      {benefit.cap && <span className="benefit__meta">{benefit.cap}</span>}
      {benefit.enrollmentRequired && <Badge tone="accent">Enrollment required</Badge>}

      <div className="stack gap-2">
        <div className="pbar" role="progressbar" aria-valuenow={Math.round(elapsed * 100)}>
          <span
            className={`pbar__fill${fillModifier ? ` pbar__fill--${fillModifier}` : ''}`}
            style={{ width: used ? '100%' : `${Math.round(elapsed * 100)}%` }}
          />
        </div>
        <div className="row spread">
          <span className="benefit__card-tag">
            <CardArt
              size="sm"
              name={catalogCard.name}
              artRef={catalogCard.artRef}
              imageUrl={catalogCard.imageUrl}
              last4={card.last4}
            />
            {card.nickname ? `${card.nickname} · ` : ''}•••• {card.last4}
          </span>
          {ignored ? (
            <Badge tone="neutral">Ignored</Badge>
          ) : used ? (
            <Badge tone={auto ? 'accent' : 'success'}>{auto ? '↻ Auto' : 'Used'}</Badge>
          ) : (
            <Badge tone={dayTone}>
              {isOneTime && !benefit.validTo ? 'Ongoing' : formatDaysRemaining(status.daysRemaining)}
            </Badge>
          )}
        </div>
      </div>

      <div className="benefit__foot">
        {ignored ? (
          <>
            <span className="benefit__auto-label">Not tracked · no alerts</span>
            <GlassButton size="sm" variant="secondary" onClick={toggleIgnore}>
              Un-ignore
            </GlassButton>
          </>
        ) : (
          <>
            <label
              className="benefit__auto"
              title="Counts as used automatically every period — until you turn it off."
            >
              <Switch
                checked={auto}
                onChange={toggleAuto}
                label={`Set and forget ${benefit.title} — count as used automatically every period`}
              />
              <span className="benefit__auto-label">Set &amp; forget</span>
            </label>
            <div className="benefit__actions">
              <GlassButton
                size="sm"
                variant="ghost"
                onClick={toggleIgnore}
                title="Hide this benefit and stop alerting me about it"
              >
                Ignore
              </GlassButton>
              {!auto &&
                (used ? (
                  <GlassButton size="sm" variant="ghost" onClick={toggle}>
                    Undo
                  </GlassButton>
                ) : (
                  <GlassButton size="sm" variant="primary" onClick={toggle}>
                    Mark as used
                  </GlassButton>
                ))}
            </div>
          </>
        )}
      </div>
    </GlassCard>
  );
}
