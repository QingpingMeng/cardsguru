import { describe, it, expect, vi } from 'vitest';
import { GitHubSyncProvider, encodeBase64, decodeBase64 } from './github';
import { AuthError, ConflictError } from './types';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const cfg = (fetchImpl: typeof fetch) => ({
  token: 'tok_123',
  owner: 'octo',
  repo: 'cardsguru-data',
  basePath: 'cardsguru',
  fetchImpl,
});

describe('base64 helpers', () => {
  it('round-trips UTF-8 text', () => {
    const text = 'Amex® Platinum — café ½ credit';
    expect(decodeBase64(encodeBase64(text))).toBe(text);
  });

  it('tolerates newlines in encoded content (as GitHub returns it)', () => {
    const withNewlines = `${encodeBase64('{"a":1}')}\n`;
    expect(decodeBase64(withNewlines)).toBe('{"a":1}');
  });
});

describe('GitHubSyncProvider.readFile', () => {
  it('parses content and returns the sha; targets the right URL with auth', async () => {
    const fetchImpl = vi.fn(async () =>
      json(200, { content: `${encodeBase64('{"hello":"world"}')}\n`, sha: 'abc123' }),
    ) as unknown as typeof fetch;

    const provider = new GitHubSyncProvider(cfg(fetchImpl));
    const file = await provider.readFile('profile.json');

    expect(file).toEqual({ content: { hello: 'world' }, sha: 'abc123' });
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('/repos/octo/cardsguru-data/contents/cardsguru/profile.json');
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer tok_123' });
  });

  it('returns null for a missing file (404)', async () => {
    const fetchImpl = vi.fn(async () => json(404, { message: 'Not Found' })) as unknown as typeof fetch;
    const provider = new GitHubSyncProvider(cfg(fetchImpl));
    expect(await provider.readFile('cards.json')).toBeNull();
  });

  it('throws AuthError on 401', async () => {
    const fetchImpl = vi.fn(async () => json(401, { message: 'Bad credentials' })) as unknown as typeof fetch;
    const provider = new GitHubSyncProvider(cfg(fetchImpl));
    await expect(provider.readFile('cards.json')).rejects.toBeInstanceOf(AuthError);
  });
});

describe('GitHubSyncProvider.writeFile', () => {
  it('PUTs base64-encoded JSON and returns the new sha', async () => {
    const fetchImpl = vi.fn(async () => json(201, { content: { sha: 'newsha' } })) as unknown as typeof fetch;
    const provider = new GitHubSyncProvider(cfg(fetchImpl));

    const res = await provider.writeFile('cards.json', { cards: [] });
    expect(res.sha).toBe('newsha');

    const [, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect((init as RequestInit).method).toBe('PUT');
    expect(JSON.parse(decodeBase64(body.content))).toEqual({ cards: [] });
  });

  it('throws ConflictError on 409', async () => {
    const fetchImpl = vi.fn(async () => json(409, { message: 'conflict' })) as unknown as typeof fetch;
    const provider = new GitHubSyncProvider(cfg(fetchImpl));
    await expect(provider.writeFile('cards.json', {}, 'oldsha')).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('GitHubSyncProvider.checkConnection', () => {
  it('reports write access from repo permissions', async () => {
    const fetchImpl = vi.fn(async () =>
      json(200, { permissions: { push: true }, default_branch: 'main' }),
    ) as unknown as typeof fetch;
    const provider = new GitHubSyncProvider(cfg(fetchImpl));

    const info = await provider.checkConnection();
    expect(info).toMatchObject({ ok: true, canWrite: true, defaultBranch: 'main', repo: 'octo/cardsguru-data' });
  });

  it('flags a read-only token', async () => {
    const fetchImpl = vi.fn(async () => json(200, { permissions: { push: false } })) as unknown as typeof fetch;
    const provider = new GitHubSyncProvider(cfg(fetchImpl));
    const info = await provider.checkConnection();
    expect(info.ok).toBe(true);
    expect(info.canWrite).toBe(false);
  });
});
