import { useState, type ReactNode } from 'react';
import { Badge, GlassButton, GlassPanel } from '@/components/glass';
import { CardArt } from '@/components/CardArt';
import { EmptyState, Modal, TextField } from '@/components/ui';
import { describeLineage, getIssuerName } from '@/lib/catalog/helpers';
import { formatDate } from '@/lib/format';
import type { OwnedCard } from '@/lib/data/schema';
import { useAppStore } from '@/store/appStore';
import { CardFormModal } from './CardFormModal';
import { ChangeProductModal } from './ChangeProductModal';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Parse a 'YYYY-MM-DD' as local midnight so the label doesn't drift a day. */
function formatLocalDate(ymd: string): string {
  return formatDate(new Date(`${ymd}T00:00:00`));
}

export function CardsScreen() {
  const catalog = useAppStore((s) => s.catalog);
  const cards = useAppStore((s) => s.cards);
  const removeCard = useAppStore((s) => s.removeCard);
  const closeCard = useAppStore((s) => s.closeCard);
  const reopenCard = useAppStore((s) => s.reopenCard);

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<OwnedCard | null>(null);
  const [removing, setRemoving] = useState<OwnedCard | null>(null);
  const [closing, setClosing] = useState<OwnedCard | null>(null);
  const [closeDate, setCloseDate] = useState(todayIso());
  const [changing, setChanging] = useState<OwnedCard | null>(null);

  const activeCards = cards.filter((c) => !c.closedDate);
  const closedCards = cards.filter((c) => c.closedDate);

  const beginClose = (card: OwnedCard) => {
    setCloseDate(todayIso());
    setClosing(card);
  };

  const renderRow = (card: OwnedCard, actions: ReactNode) => {
    const cc = catalog.cards.find((c) => c.id === card.catalogCardId);
    const lineage = describeLineage(catalog, card);
    const closed = Boolean(card.closedDate);
    return (
      <div key={card.userCardId} className={`owned-card${closed ? ' owned-card--closed' : ''}`}>
        <div className="owned-card__art">
          <CardArt
            name={cc?.name ?? card.catalogCardId}
            artRef={cc?.artRef}
            imageUrl={cc?.imageUrl}
            network={cc?.network}
            issuer={cc ? getIssuerName(catalog, cc.issuerId) : undefined}
            size="sm"
          />
        </div>
        <div className="owned-card__body">
          <div className="owned-card__name">
            <span>{cc?.name ?? card.catalogCardId}</span>
            {closed && <Badge tone="neutral">Closed</Badge>}
          </div>
          <div className="owned-card__meta">
            {card.nickname && <span className="owned-card__nickname">{card.nickname}</span>}
            <span className="owned-card__digits">•••• {card.last4}</span>
            {cc && !closed && <span>{cc.benefits.length} benefits</span>}
            {closed && card.closedDate && <span>Closed {formatLocalDate(card.closedDate)}</span>}
          </div>
          {lineage && <div className="owned-card__lineage">{lineage}</div>}
        </div>
        <div className="owned-card__actions">{actions}</div>
      </div>
    );
  };

  return (
    <div className="stack">
      <header className="toolbar cards-toolbar">
        <h1 className="page-title">My Cards</h1>
        <GlassButton variant="primary" onClick={() => setAdding(true)}>
          + Add card
        </GlassButton>
        <p className="text-secondary">The cards you own — add more than one of the same product.</p>
      </header>

      {cards.length === 0 ? (
        <EmptyState
          icon="💳"
          title="No cards added"
          description="Add a card to start tracking its recurring benefits."
          action={
            <GlassButton variant="primary" onClick={() => setAdding(true)}>
              Add a card
            </GlassButton>
          }
        />
      ) : (
        <>
          {activeCards.length > 0 && (
            <GlassPanel variant="flat" className="list">
              <div className="divide">
                {activeCards.map((card) =>
                  renderRow(
                    card,
                    <>
                      <GlassButton size="sm" variant="secondary" onClick={() => setEditing(card)}>
                        Edit
                      </GlassButton>
                      <GlassButton size="sm" variant="secondary" onClick={() => setChanging(card)}>
                        Change product
                      </GlassButton>
                      <GlassButton size="sm" variant="ghost" onClick={() => beginClose(card)}>
                        Close
                      </GlassButton>
                    </>,
                  ),
                )}
              </div>
            </GlassPanel>
          )}

          {closedCards.length > 0 && (
            <div className="stack">
              <h2 className="section-title">Closed</h2>
              <GlassPanel variant="flat" className="list">
                <div className="divide">
                  {closedCards.map((card) =>
                    renderRow(
                      card,
                      <>
                        <GlassButton
                          size="sm"
                          variant="secondary"
                          onClick={() => void reopenCard(card.userCardId)}
                        >
                          Reopen
                        </GlassButton>
                        <GlassButton size="sm" variant="ghost" onClick={() => setRemoving(card)}>
                          Delete
                        </GlassButton>
                      </>,
                    ),
                  )}
                </div>
              </GlassPanel>
            </div>
          )}
        </>
      )}

      <CardFormModal open={adding} onClose={() => setAdding(false)} />
      <CardFormModal
        open={Boolean(editing)}
        editing={editing ?? undefined}
        onClose={() => setEditing(null)}
        onDelete={() => {
          if (editing) setRemoving(editing);
        }}
      />
      <ChangeProductModal open={Boolean(changing)} card={changing} onClose={() => setChanging(null)} />

      <Modal
        open={Boolean(closing)}
        onClose={() => setClosing(null)}
        title="Close card?"
        footer={
          <>
            <GlassButton variant="ghost" onClick={() => setClosing(null)}>
              Cancel
            </GlassButton>
            <GlassButton
              variant="primary"
              block
              onClick={() => {
                if (closing) void closeCard(closing.userCardId, closeDate || undefined);
                setClosing(null);
              }}
            >
              Close card
            </GlassButton>
          </>
        }
      >
        <p className="text-secondary">
          Closing stops tracking this card's benefits and hides it from your dashboard. It stays
          here under “Closed” and all of your history is kept — you can reopen it anytime.
        </p>
        <TextField
          label="Closed on"
          type="date"
          value={closeDate}
          max={todayIso()}
          onChange={(e) => setCloseDate(e.target.value)}
        />
      </Modal>

      <Modal
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        title="Delete card permanently?"
        footer={
          <>
            <GlassButton variant="ghost" onClick={() => setRemoving(null)}>
              Cancel
            </GlassButton>
            <GlassButton
              variant="danger"
              block
              onClick={() => {
                if (removing) void removeCard(removing.userCardId);
                setRemoving(null);
              }}
            >
              Delete permanently
            </GlassButton>
          </>
        }
      >
        <p className="text-secondary">
          This removes the card everywhere it's synced. Completion history entries remain but lose
          their card label. To keep the card for reference, close it instead.
        </p>
      </Modal>
    </div>
  );
}
