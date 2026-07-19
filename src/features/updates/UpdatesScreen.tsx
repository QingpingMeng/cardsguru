import { useState } from 'react';
import { GlassButton, GlassPanel, Badge } from '@/components/glass';
import { EmptyState } from '@/components/ui';
import { getIssuerName } from '@/lib/catalog/helpers';
import { formatDate } from '@/lib/format';
import { useAppStore, type CatalogUpdateResult } from '@/store/appStore';

export function UpdatesScreen() {
  const catalog = useAppStore((s) => s.catalog);
  const refreshCatalog = useAppStore((s) => s.refreshCatalog);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CatalogUpdateResult | null>(null);

  const check = async () => {
    setBusy(true);
    setResult(null);
    try {
      setResult(await refreshCatalog());
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <header className="toolbar">
        <div className="toolbar__grow">
          <h1 className="page-title">Catalog updates</h1>
          <p className="text-secondary">Keep card benefits current as issuers change them.</p>
        </div>
      </header>

      <GlassPanel className="stack gap-3" style={{ padding: 'var(--space-5)' }}>
        <div className="row spread wrap gap-3">
          <div>
            <div className="owned-card__name">Catalog v{catalog.catalogVersion}</div>
            <div className="text-secondary" style={{ fontSize: 'var(--text-xs)' }}>
              {catalog.cards.length} cards · updated {formatDate(catalog.updatedAt)}
            </div>
          </div>
          <GlassButton variant="primary" onClick={() => void check()} disabled={busy}>
            {busy ? 'Checking…' : 'Check for updates'}
          </GlassButton>
        </div>

        {result && (
          <div className="row gap-2 center">
            {result.message ? (
              <Badge tone="danger">Failed</Badge>
            ) : result.updated ? (
              <Badge tone="success">Updated</Badge>
            ) : (
              <Badge tone="neutral">Up to date</Badge>
            )}
            <span className="text-secondary" style={{ fontSize: 'var(--text-sm)' }}>
              {result.message
                ? result.message
                : result.updated
                  ? `Upgraded to v${result.toVersion}.`
                  : `You have the latest catalog (v${result.toVersion}).`}
            </span>
          </div>
        )}
      </GlassPanel>

      <h2 className="section-title">Tracked cards</h2>
      {catalog.cards.length === 0 ? (
        <EmptyState icon="🗃️" title="Empty catalog" />
      ) : (
        <GlassPanel variant="flat" className="list">
          <div className="divide">
            {catalog.cards.map((card) => (
              <div key={card.id} className="catalog-row">
                <div className="catalog-row__body">
                  <div className="owned-card__name">{card.name}</div>
                  <div className="text-secondary" style={{ fontSize: 'var(--text-xs)' }}>
                    {getIssuerName(catalog, card.issuerId)}
                  </div>
                </div>
                <Badge tone="neutral">{card.benefits.length}</Badge>
              </div>
            ))}
          </div>
        </GlassPanel>
      )}
    </div>
  );
}
