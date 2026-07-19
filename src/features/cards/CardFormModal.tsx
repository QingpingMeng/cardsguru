import { useEffect, useMemo, useState } from 'react';
import { GlassButton, GlassPanel } from '@/components/glass';
import { CardArt } from '@/components/CardArt';
import { Modal, TextField } from '@/components/ui';
import { getIssuerName, searchCards } from '@/lib/catalog/helpers';
import type { OwnedCard } from '@/lib/data/schema';
import { useAppStore } from '@/store/appStore';

export interface CardFormModalProps {
  open: boolean;
  onClose: () => void;
  editing?: OwnedCard;
  /** When editing, renders a secondary "Delete permanently" action in the footer. */
  onDelete?: () => void;
}

export function CardFormModal({ open, onClose, editing, onDelete }: CardFormModalProps) {
  const catalog = useAppStore((s) => s.catalog);
  const cards = useAppStore((s) => s.cards);
  const addCard = useAppStore((s) => s.addCard);
  const updateCard = useAppStore((s) => s.updateCard);

  const isEdit = Boolean(editing);
  const [catalogCardId, setCatalogCardId] = useState(editing?.catalogCardId ?? '');
  const [last4, setLast4] = useState(editing?.last4 ?? '');
  const [nickname, setNickname] = useState(editing?.nickname ?? '');
  const [openedDate, setOpenedDate] = useState(editing?.openedDate ?? '');
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  // The edit modal stays mounted (toggled via `open`), so the useState
  // initializers above run only once — before `editing` is set. Re-hydrate the
  // form from the card whenever the edit modal opens.
  useEffect(() => {
    if (!open || !editing) return;
    setCatalogCardId(editing.catalogCardId);
    setLast4(editing.last4);
    setNickname(editing.nickname ?? '');
    setOpenedDate(editing.openedDate ?? '');
    setError(null);
  }, [open, editing]);

  const filteredCards = useMemo(
    () => [...searchCards(catalog, query)].sort((a, b) => a.name.localeCompare(b.name)),
    [catalog, query],
  );
  const selected = catalog.cards.find((c) => c.id === catalogCardId);
  const isAmex = selected?.network === 'amex' || selected?.issuerId === 'amex';
  const idLength = isAmex ? 5 : 4;

  const reset = () => {
    setCatalogCardId('');
    setLast4('');
    setNickname('');
    setOpenedDate('');
    setQuery('');
    setError(null);
  };

  const close = () => {
    if (!isEdit) reset();
    setError(null);
    onClose();
  };

  const submit = () => {
    if (!catalogCardId) return setError('Choose a card.');
    if (!new RegExp(`^\\d{${idLength}}$`).test(last4))
      return setError(`Enter the last ${idLength} digits.`);
    const duplicate = cards.some(
      (c) =>
        c.catalogCardId === catalogCardId &&
        c.last4 === last4 &&
        c.userCardId !== editing?.userCardId,
    );
    if (duplicate) return setError('You already added a card of this product with those digits.');

    if (isEdit && editing) {
      void updateCard(editing.userCardId, {
        last4,
        nickname: nickname || undefined,
        openedDate: openedDate || undefined,
      });
    } else {
      void addCard({
        catalogCardId,
        last4,
        nickname: nickname || undefined,
        openedDate: openedDate || undefined,
      });
    }
    close();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={isEdit ? 'Edit card' : 'Add a card'}
      footer={
        <>
          {isEdit && onDelete && (
            <GlassButton
              variant="ghost"
              onClick={() => {
                close();
                onDelete();
              }}
              style={{ marginRight: 'auto', color: 'var(--color-danger)' }}
            >
              Delete permanently
            </GlassButton>
          )}
          <GlassButton variant="ghost" onClick={close}>
            Cancel
          </GlassButton>
          <GlassButton variant="primary" block onClick={submit}>
            {isEdit ? 'Save changes' : 'Add card'}
          </GlassButton>
        </>
      }
    >
      {!isEdit && (
        <div className="field">
          <span className="field__label">Product</span>
          <input
            type="search"
            className="input"
            placeholder="Search by card or issuer…"
            aria-label="Search card products"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <GlassPanel
            variant="flat"
            className="catalog-picker-panel"
            style={{ maxHeight: 260, overflowY: 'auto', padding: 'var(--space-2)' }}
          >
            <div className="catalog-picker" role="listbox" aria-label="Card product">
              {filteredCards.length === 0 ? (
                <p className="catalog-picker__empty">No cards match “{query.trim()}”.</p>
              ) : (
                filteredCards.map((card) => {
                  const active = card.id === catalogCardId;
                  return (
                    <button
                      key={card.id}
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={`catalog-row${active ? ' is-active' : ''}`}
                      onClick={() => {
                        setCatalogCardId(card.id);
                        const len = card.network === 'amex' || card.issuerId === 'amex' ? 5 : 4;
                        setLast4((v) => v.slice(0, len));
                      }}
                    >
                      <CardArt
                        size="sm"
                        name={card.name}
                        artRef={card.artRef}
                        imageUrl={card.imageUrl}
                      />
                      <div className="catalog-row__body">
                        <div className="catalog-row__name">{card.name}</div>
                        <div className="catalog-row__meta">
                          {getIssuerName(catalog, card.issuerId)} · {card.benefits.length}{' '}
                          {card.benefits.length === 1 ? 'benefit' : 'benefits'}
                        </div>
                      </div>
                      {active && (
                        <span className="catalog-row__check" aria-hidden>
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </GlassPanel>
        </div>
      )}

      {isEdit && selected && (
        <div style={{ width: 120 }}>
          <CardArt
            name={selected.name}
            artRef={selected.artRef}
            imageUrl={selected.imageUrl}
            last4={last4}
          />
        </div>
      )}

      <div className="field-grid">
        <TextField
          label={`Last ${idLength} digits`}
          inputMode="numeric"
          maxLength={idLength}
          placeholder={idLength === 5 ? '12345' : '1234'}
          value={last4}
          onChange={(e) => setLast4(e.target.value.replace(/\D/g, '').slice(0, idLength))}
          hint={
            isAmex
              ? 'Amex shows 5 digits on the card — using all 5 avoids collisions.'
              : 'Distinguishes multiple cards of the same product.'
          }
        />
        <TextField
          label="Account opened (optional)"
          type="date"
          value={openedDate}
          onChange={(e) => setOpenedDate(e.target.value)}
          hint="Used to time anniversary / cardmember-year credits."
        />
      </div>
      <TextField
        label="Nickname (optional)"
        placeholder="e.g. Travel card"
        value={nickname}
        maxLength={60}
        onChange={(e) => setNickname(e.target.value)}
      />

      {error && <p className="field__error">{error}</p>}
    </Modal>
  );
}
