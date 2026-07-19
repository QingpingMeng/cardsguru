import { useState } from 'react';
import { GlassButton, GlassPanel } from '@/components/glass';
import { CardArt } from '@/components/CardArt';
import { EmptyState, Modal } from '@/components/ui';
import { getIssuerName } from '@/lib/catalog/helpers';
import type { OwnedCard } from '@/lib/data/schema';
import { useAppStore } from '@/store/appStore';
import { CardFormModal } from './CardFormModal';

export function CardsScreen() {
  const catalog = useAppStore((s) => s.catalog);
  const cards = useAppStore((s) => s.cards);
  const removeCard = useAppStore((s) => s.removeCard);

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<OwnedCard | null>(null);
  const [removing, setRemoving] = useState<OwnedCard | null>(null);

  return (
    <div className="stack">
      <header className="toolbar">
        <div className="toolbar__grow">
          <h1 className="page-title">My Cards</h1>
          <p className="text-secondary">The cards you own — add more than one of the same product.</p>
        </div>
        <GlassButton variant="primary" onClick={() => setAdding(true)}>
          + Add card
        </GlassButton>
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
        <GlassPanel variant="flat" className="list">
          <div className="divide">
            {cards.map((card) => {
              const cc = catalog.cards.find((c) => c.id === card.catalogCardId);
              return (
                <div key={card.userCardId} className="owned-card">
                  <div className="owned-card__art">
                    <CardArt
                      name={cc?.name ?? card.catalogCardId}
                      artRef={cc?.artRef}
                      imageUrl={cc?.imageUrl}
                      network={cc?.network}
                      issuer={cc ? getIssuerName(catalog, cc.issuerId) : undefined}
                      last4={card.last4}
                      nickname={card.nickname}
                    />
                  </div>
                  <div className="owned-card__body">
                    <div className="owned-card__name">{cc?.name ?? card.catalogCardId}</div>
                    <div className="text-secondary" style={{ fontSize: 'var(--text-xs)' }}>
                      {card.nickname ? `${card.nickname} · ` : ''}•••• {card.last4}
                      {cc ? ` · ${cc.benefits.length} benefits` : ''}
                    </div>
                  </div>
                  <div className="row gap-2">
                    <GlassButton size="sm" variant="secondary" onClick={() => setEditing(card)}>
                      Edit
                    </GlassButton>
                    <GlassButton size="sm" variant="ghost" onClick={() => setRemoving(card)}>
                      Remove
                    </GlassButton>
                  </div>
                </div>
              );
            })}
          </div>
        </GlassPanel>
      )}

      <CardFormModal open={adding} onClose={() => setAdding(false)} />
      <CardFormModal
        open={Boolean(editing)}
        editing={editing ?? undefined}
        onClose={() => setEditing(null)}
      />

      <Modal
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        title="Remove card?"
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
              Remove
            </GlassButton>
          </>
        }
      >
        <p className="text-secondary">
          This removes the card and stops tracking its benefits. Your completion history for it is
          kept.
        </p>
      </Modal>
    </div>
  );
}
