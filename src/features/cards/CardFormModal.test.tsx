import { render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { CatalogSchema } from '@/lib/catalog/schema';
import { createOwnedCard } from '@/lib/data/schema';
import type { OwnedCard } from '@/lib/data/schema';
import { useAppStore } from '@/store/appStore';
import { CardFormModal } from './CardFormModal';

const catalog = CatalogSchema.parse({
  schemaVersion: 1,
  catalogVersion: 1,
  updatedAt: '2025-01-01T00:00:00.000Z',
  issuers: [
    { id: 'amex', name: 'American Express' },
    { id: 'chase', name: 'Chase' },
  ],
  cards: [
    {
      id: 'amex-platinum',
      issuerId: 'amex',
      name: 'Platinum',
      network: 'amex',
      benefits: [
        { id: 'amex-platinum:uber', title: 'Uber Cash', frequency: 'monthly', category: 'rideshare', value: { amount: 15 } },
      ],
    },
    {
      id: 'chase-sapphire',
      issuerId: 'chase',
      name: 'Sapphire Reserve',
      network: 'visa',
      benefits: [
        { id: 'chase-sapphire:dining', title: 'Dining Credit', frequency: 'monthly', category: 'dining', value: { amount: 25 } },
      ],
    },
  ],
});

const amexCard = createOwnedCard({
  catalogCardId: 'amex-platinum',
  last4: '12345',
  nickname: 'Platinum P1',
  openedDate: '2022-03-15',
});

/**
 * Mirrors CardsScreen: the edit modal is always mounted with `editing`
 * initially undefined and toggled on. This reproduces the bug where the
 * modal's state was initialized before `editing` was ever set.
 */
function EditHarness({ card }: { card: OwnedCard }) {
  const [editing, setEditing] = useState<OwnedCard | undefined>(undefined);
  return (
    <>
      <button type="button" onClick={() => setEditing(card)}>
        open
      </button>
      <CardFormModal
        open={Boolean(editing)}
        editing={editing}
        onClose={() => setEditing(undefined)}
      />
    </>
  );
}

describe('CardFormModal (edit)', () => {
  beforeEach(() => {
    useAppStore.setState({ catalog, cards: [amexCard], completions: [], profile: null });
  });

  it('populates existing values and uses 5 digits for Amex when opened', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    render(<EditHarness card={amexCard} />);

    // Modal mounts closed first (state initialized before `editing` is visible).
    await user.click(screen.getByText('open'));

    // Amex products expose the 5-digit identifier, not 4.
    const digits = screen.getByLabelText('Last 5 digits') as HTMLInputElement;
    expect(digits.value).toBe('12345');
    expect(digits.maxLength).toBe(5);

    expect((screen.getByLabelText('Nickname (optional)') as HTMLInputElement).value).toBe(
      'Platinum P1',
    );
    expect((screen.getByLabelText('Account opened (optional)') as HTMLInputElement).value).toBe(
      '2022-03-15',
    );
  });
});
