import catalogData from '@/data/catalog.json';
import { CatalogSchema, CURRENT_SCHEMA_VERSION } from './schema';
import type { Catalog } from './schema';

/** Thrown when a catalog declares a schema version newer than this build understands. */
export class CatalogSchemaTooNewError extends Error {
  constructor(public readonly schemaVersion: number) {
    super(
      `Catalog schema version ${schemaVersion} is newer than supported (${CURRENT_SCHEMA_VERSION}). Please update CardsGuru.`,
    );
    this.name = 'CatalogSchemaTooNewError';
  }
}

/** Validate arbitrary data as a Catalog, throwing a ZodError on failure. */
export function parseCatalog(data: unknown): Catalog {
  return CatalogSchema.parse(data);
}

let builtIn: Catalog | null = null;

/** The catalog snapshot bundled with this build (always available, works offline). */
export function getBuiltInCatalog(): Catalog {
  if (!builtIn) {
    builtIn = CatalogSchema.parse(catalogData);
  }
  return builtIn;
}

/**
 * Fetch and validate a catalog from a remote URL (used by the update module).
 * Rejects catalogs whose schema version is newer than this build supports.
 */
export async function fetchRemoteCatalog(url: string, signal?: AbortSignal): Promise<Catalog> {
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`Failed to fetch catalog: ${res.status} ${res.statusText}`);
  }
  const json: unknown = await res.json();
  const catalog = CatalogSchema.parse(json);
  if (catalog.schemaVersion > CURRENT_SCHEMA_VERSION) {
    throw new CatalogSchemaTooNewError(catalog.schemaVersion);
  }
  return catalog;
}
