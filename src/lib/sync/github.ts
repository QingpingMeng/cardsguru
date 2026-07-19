import { AuthError, ConflictError, type ConnectionInfo, type RemoteFile, type SyncProvider, type WriteResult } from './types';

export interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
  /** Branch to read/write. Defaults to the repo's default branch on write. */
  branch?: string;
  /** Folder within the repo that holds CardsGuru files. Default "cardsguru". */
  basePath?: string;
  /** Injectable for testing; defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

const API = 'https://api.github.com';

/** UTF-8 safe base64 encode (btoa only handles latin1). */
export function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/** UTF-8 safe base64 decode; tolerates the newlines GitHub embeds in content. */
export function decodeBase64(b64: string): string {
  const binary = atob(b64.replace(/\s/g, ''));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export class GitHubSyncProvider implements SyncProvider {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly config: GitHubConfig) {
    this.fetchImpl = config.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  private get basePath(): string {
    return (this.config.basePath ?? 'cardsguru').replace(/^\/+|\/+$/g, '');
  }

  private fullPath(path: string): string {
    const clean = path.replace(/^\/+/, '');
    return this.basePath ? `${this.basePath}/${clean}` : clean;
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...extra,
    };
  }

  private contentsUrl(path: string): string {
    const { owner, repo } = this.config;
    return `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${this.fullPath(path)
      .split('/')
      .map(encodeURIComponent)
      .join('/')}`;
  }

  async readFile(path: string): Promise<RemoteFile | null> {
    const url = new URL(this.contentsUrl(path));
    if (this.config.branch) url.searchParams.set('ref', this.config.branch);

    const res = await this.fetchImpl(url.toString(), { headers: this.headers() });
    if (res.status === 404) return null;
    if (res.status === 401 || res.status === 403) {
      throw new AuthError(await safeMessage(res, 'Not authorized to read the data repo'));
    }
    if (!res.ok) {
      throw new Error(`GitHub read failed (${res.status}): ${await safeMessage(res)}`);
    }
    const data = (await res.json()) as { content?: string; sha: string };
    const text = data.content ? decodeBase64(data.content) : '';
    return { content: text ? JSON.parse(text) : null, sha: data.sha };
  }

  async writeFile(path: string, content: unknown, sha?: string): Promise<WriteResult> {
    const body: Record<string, unknown> = {
      message: `CardsGuru: update ${path}`,
      content: encodeBase64(`${JSON.stringify(content, null, 2)}\n`),
    };
    if (sha) body.sha = sha;
    if (this.config.branch) body.branch = this.config.branch;

    const res = await this.fetchImpl(this.contentsUrl(path), {
      method: 'PUT',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    });

    if (res.status === 409) throw new ConflictError(path);
    if (res.status === 422 && sha) throw new ConflictError(path);
    if (res.status === 401 || res.status === 403) {
      throw new AuthError(await safeMessage(res, 'Not authorized to write the data repo'));
    }
    if (!res.ok) {
      throw new Error(`GitHub write failed (${res.status}): ${await safeMessage(res)}`);
    }
    const data = (await res.json()) as { content: { sha: string } };
    return { sha: data.content.sha };
  }

  async checkConnection(): Promise<ConnectionInfo> {
    const { owner, repo } = this.config;
    const url = `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
    const res = await this.fetchImpl(url, { headers: this.headers() });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, repo: `${owner}/${repo}`, canWrite: false, message: 'Invalid or unauthorized token' };
    }
    if (res.status === 404) {
      return { ok: false, repo: `${owner}/${repo}`, canWrite: false, message: 'Repository not found (check owner/name and token scope)' };
    }
    if (!res.ok) {
      return { ok: false, repo: `${owner}/${repo}`, canWrite: false, message: `GitHub error ${res.status}` };
    }
    const data = (await res.json()) as { permissions?: { push?: boolean }; default_branch?: string };
    const canWrite = Boolean(data.permissions?.push);
    return {
      ok: true,
      repo: `${owner}/${repo}`,
      canWrite,
      defaultBranch: data.default_branch,
      message: canWrite ? undefined : 'Token cannot write to this repository',
    };
  }
}

async function safeMessage(res: Response, fallback = ''): Promise<string> {
  try {
    const data = (await res.json()) as { message?: string };
    return data.message ?? fallback;
  } catch {
    return fallback;
  }
}
