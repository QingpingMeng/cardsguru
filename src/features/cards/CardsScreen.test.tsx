import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { CatalogSchema } from '@/lib/catalog/schema';
import { createOwnedCard } from '@/lib/data/schema';
import { useAppStore } from '@/store/appStore';
import { CardsScreen } from './CardsScreen';

const productName = 'Hilton Honors American Express Aspire Card';
const catalog = CatalogSchema.parse({
  schemaVersion: 1,
  catalogVersion: 1,
  updatedAt: '2025-01-01T00:00:00.000Z',
  issuers: [{ id: 'amex', name: 'American Express' }],
  cards: [
    {
      id: 'aspire',
      issuerId: 'amex',
      name: productName,
      network: 'amex',
      benefits: [
        { id: 'aspire:hotel', title: 'Hotel credit', frequency: 'semiannual', category: 'hotel' },
      ],
    },
  ],
});
const card = createOwnedCard({
  catalogCardId: 'aspire',
  last4: '31008',
  nickname: 'Aspire P1.2',
});

describe('CardsScreen', () => {
  beforeEach(() => {
    useAppStore.setState({ catalog, cards: [card], completions: [], profile: null });
  });

  it('shows the full product name and account details once, outside the compact artwork', () => {
    const { container } = render(<CardsScreen />);

    expect(screen.getByText(productName, { selector: '.owned-card__name span' })).toBeVisible();
    expect(screen.getByText('Aspire P1.2')).toHaveClass('owned-card__nickname');
    expect(screen.getByText('•••• 31008')).toHaveClass('owned-card__digits');
    expect(screen.getByText('1 benefits')).toBeVisible();
    expect(container.querySelector('.owned-card__art .card-art')).toHaveClass('card-art--sm');
    expect(container.querySelector('.owned-card__art')).not.toHaveTextContent('31008');
  });

  it.each([
    ['+ Add card', 'Add a card'],
    ['Edit', 'Edit card'],
    ['Change product', 'Change product'],
    ['Close', 'Close card?'],
  ])('keeps the %s action accessible', async (action, title) => {
    const user = userEvent.setup();
    render(<CardsScreen />);

    await user.click(screen.getByRole('button', { name: action }));
    expect(within(screen.getByRole('dialog')).getByRole('heading', { name: title })).toBeInTheDocument();
  });

  it('keeps the closed status, date, and management actions visible', () => {
    useAppStore.setState({ cards: [{ ...card, closedDate: '2025-06-15' }] });
    render(<CardsScreen />);

    expect(screen.getByText('Closed', { selector: '.badge' })).toBeVisible();
    expect(screen.getByText(/^Closed Jun/)).toBeVisible();
    expect(screen.queryByText('1 benefits')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reopen' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeVisible();
  });
});
