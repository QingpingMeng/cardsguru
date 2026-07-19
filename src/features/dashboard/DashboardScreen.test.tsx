import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach } from 'vitest';
import { CatalogSchema } from '@/lib/catalog/schema';
import { createOwnedCard } from '@/lib/data/schema';
import { useAppStore } from '@/store/appStore';
import { usePreferences } from '@/store/preferences';
import { DashboardScreen } from './DashboardScreen';

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
        { id: 'amex-platinum:airline', title: 'Airline Fee', frequency: 'annual', category: 'airline', value: { amount: 200 } },
      ],
    },
    {
      id: 'chase-sapphire',
      issuerId: 'chase',
      name: 'Sapphire Reserve',
      network: 'visa',
      benefits: [
        { id: 'chase-sapphire:dining', title: 'Dining Credit', frequency: 'monthly', category: 'dining', value: { amount: 25 } },
        { id: 'chase-sapphire:travel', title: 'Travel Credit', frequency: 'annual', category: 'travel', value: { amount: 300 } },
      ],
    },
  ],
});

const amex = createOwnedCard({ catalogCardId: 'amex-platinum', last4: '1234', nickname: 'Weekender' });
const chase = createOwnedCard({ catalogCardId: 'chase-sapphire', last4: '5678' });

function renderDashboard() {
  return render(
    <MemoryRouter>
      <DashboardScreen />
    </MemoryRouter>,
  );
}

describe('DashboardScreen grouping', () => {
  beforeEach(() => {
    usePreferences.setState({ benefitGroupBy: 'frequency' });
    useAppStore.setState({ catalog, cards: [amex, chase], completions: [], profile: null });
  });

  it('defaults to grouping by reset cycle', () => {
    renderDashboard();
    expect(screen.getByRole('tab', { name: 'Cycle' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Monthly')).toBeInTheDocument();
    expect(screen.getByText('Annual')).toBeInTheDocument();
  });

  it('re-sections the list by card when "Card" is selected', async () => {
    const user = userEvent.setup();
    renderDashboard();
    await user.click(screen.getByRole('tab', { name: 'Card' }));

    // Card headers replace the reset-cycle headers.
    expect(await screen.findByText('Weekender')).toBeInTheDocument();
    expect(screen.getAllByText('Sapphire Reserve').length).toBeGreaterThan(0);
    expect(screen.queryByText('Monthly')).not.toBeInTheDocument();
    expect(screen.queryByText('Annual')).not.toBeInTheDocument();
  });

  it('re-sections the list by category when "Category" is selected', async () => {
    const user = userEvent.setup();
    renderDashboard();
    await user.click(screen.getByRole('tab', { name: 'Category' }));

    // Categories appear in catalog order; empty categories are omitted.
    expect(await screen.findByText('Travel')).toBeInTheDocument();
    expect(screen.getByText('Airline')).toBeInTheDocument();
    expect(screen.getByText('Dining')).toBeInTheDocument();
    expect(screen.getByText('Rideshare')).toBeInTheDocument();
    expect(screen.queryByText('Hotel')).not.toBeInTheDocument();
  });

  it('collapses a section when its header is clicked', async () => {
    const user = userEvent.setup();
    renderDashboard();
    // Section headers are the only role="button" elements (the group-by control uses role="tab").
    const [firstHeader] = screen.getAllByRole('button');
    expect(firstHeader).toHaveAttribute('aria-expanded', 'true');
    await user.click(firstHeader);
    expect(firstHeader).toHaveAttribute('aria-expanded', 'false');
  });
});
