import { useMemo, useState } from 'react';
import { GlassButton, GlassPanel } from '@/components/glass';
import { CardArt } from '@/components/CardArt';
import { Modal, TextField } from '@/components/ui';
import { getIssuerName, productChangeDirection } from '@/lib/catalog/helpers';
import type { OwnedCard } from '@/lib/data/schema';
import { useAppStore } from '@/store/appStore';

export interface ChangeProductModalProps {
  open: boolean;
  onClose: () => void;
  card: OwnedCard | null;
}

const DIRECTION_HINT: Record<ReturnType<typeof productChangeDirection>, string> = {
  upgrade: 'Upgrade',
  downgrade: 'Downgrade',
  change: 'Product change',
};

/**
 * Convert an owned account to a different product from the *same issuer* (an
 * upgrade/downgrade). The account keeps its userCardId — so its open date and all
 * completion history are preserved — and only the catalog product it points at
 * changes. The prior product is recorded for lineage.
 */
export function ChangeProductModal({ open, onClose, card }: ChangeProductModalProps) {
  const catalog = useAppStore((s) => s.catalog);
  const changeCardProduct = useAppStore((s) => s.changeCardProduct);

  const current = card ? catalog.cards.find((c) => c.id === card.catalogCardId) : undefined;

  const [targetId, setTargetId] = useState('');
  const [last4, setLast4] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Same-issuer products only, excluding the current one, name-sorted.
  const options = useMemo(() => {
    if (!current) return [];
    return catalog.cards
      .filter((c) => c.issuerId === current.issuerId && c.id !== current.id)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [catalog, current]);

  const target = catalog.cards.find((c) => c.id === targetId);
  const isAmex = target?.network === 'amex' || target?.issuerId === 'amex';
  const idLength = isAmex ? 5 : 4;
  const direction = current && target ? productChangeDirection(current, target) : 'change';

  const close = () => {
    setTargetId('');
    setLast4('');
    setError(null);
    onClose();
  };

  const submit = () => {
    if (!card || !current) return;
    if (!targetId) return setError('Choose the product to change to.');
    const digits = last4 || card.last4;
    if (!new RegExp(`^\\d{${idLength}}$`).test(digits))
      return setError(`Enter the last ${idLength} digits of the new card.`);
    void changeCardProduct(card.userCardId, targetId, { last4: digits });
    close();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Change product"
      footer={
        <>
          <GlassButton variant="ghost" onClick={close}>
            Cancel
          </GlassButton>
          <GlassButton variant="primary" block onClick={submit} disabled={options.length === 0}>
            {DIRECTION_HINT[direction]}
          </GlassButton>
        </>
      }
    >
      {current && (
        <div className="change-product__from">
          <div style={{ width: 96 }}>
            <CardArt
              size="sm"
              name={current.name}
              artRef={current.artRef}
              imageUrl={current.imageUrl}
              last4={card?.last4}
            />
          </div>
          <div>
            <div className="text-secondary" style={{ fontSize: 'var(--text-xs)' }}>
              Currently
            </div>
            <div>{current.name}</div>
            <div className="text-secondary" style={{ fontSize: 'var(--text-xs)' }}>
              {getIssuerName(catalog, current.issuerId)}
            </div>
          </div>
        </div>
      )}

      {options.length === 0 ? (
        <p className="text-secondary">
          There are no other {current ? getIssuerName(catalog, current.issuerId) : ''} products in
          the catalog to change to yet.
        </p>
      ) : (
        <>
          <div className="field">
            <span className="field__label">Change to</span>
            <GlassPanel
              variant="flat"
              className="catalog-picker-panel"
              style={{ maxHeight: 240, overflowY: 'auto', padding: 'var(--space-2)' }}
            >
              <div className="catalog-picker" role="listbox" aria-label="New product">
                {options.map((c) => {
                  const active = c.id === targetId;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={`catalog-row${active ? ' is-active' : ''}`}
                      onClick={() => {
                        setTargetId(c.id);
                        const len = c.network === 'amex' || c.issuerId === 'amex' ? 5 : 4;
                        setLast4((v) => (v || card?.last4 || '').slice(0, len));
                        setError(null);
                      }}
                    >
                      <CardArt size="sm" name={c.name} artRef={c.artRef} imageUrl={c.imageUrl} />
                      <div className="catalog-row__body">
                        <div className="catalog-row__name">{c.name}</div>
                        <div className="catalog-row__meta">
                          {c.benefits.length} {c.benefits.length === 1 ? 'benefit' : 'benefits'}
                        </div>
                      </div>
                      {active && (
                        <span className="catalog-row__check" aria-hidden>
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </GlassPanel>
          </div>

          <TextField
            label={`New card's last ${idLength} digits`}
            inputMode="numeric"
            maxLength={idLength}
            placeholder={idLength === 5 ? '12345' : '1234'}
            value={last4}
            onChange={(e) => setLast4(e.target.value.replace(/\D/g, '').slice(0, idLength))}
            hint="Update this if the product change came with a new card number."
          />

          <p className="text-secondary" style={{ fontSize: 'var(--text-xs)' }}>
            Your open date and completion history stay with this account — only the benefits tracked
            going forward change.
          </p>
        </>
      )}

      {error && <p className="field__error">{error}</p>}
    </Modal>
  );
}
