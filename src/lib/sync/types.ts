/** Abstraction over remote storage for user-data JSON files. */

export interface RemoteFile {
  /** Parsed JSON contents. */
  content: unknown;
  /** Opaque version handle for optimistic concurrency (GitHub blob SHA). */
  sha: string;
}

export interface WriteResult {
  /** New version handle after the write. */
  sha: string;
}

export interface SyncProvider {
  /**
   * Read and JSON-parse a file. Returns null when the file does not exist yet.
   * Throws on transport/auth errors.
   */
  readFile(path: string): Promise<RemoteFile | null>;

  /**
   * Create or update a file with JSON-serialized `content`. Pass the previous
   * `sha` to update (optimistic concurrency); omit it to create.
   */
  writeFile(path: string, content: unknown, sha?: string): Promise<WriteResult>;

  /** Verify credentials/target are usable (e.g. repo is reachable and writable). */
  checkConnection(): Promise<ConnectionInfo>;
}

export interface ConnectionInfo {
  ok: boolean;
  /** Repo full name, e.g. "octocat/cardsguru-data". */
  repo: string;
  /** True when the token can write to the repo. */
  canWrite: boolean;
  /** Default branch reported by the API. */
  defaultBranch?: string;
  /** Human-readable detail on failure. */
  message?: string;
}

/** Raised when a write fails because the remote changed since we last read (SHA mismatch). */
export class ConflictError extends Error {
  constructor(public readonly path: string) {
    super(`Remote file changed since last read: ${path}`);
    this.name = 'ConflictError';
  }
}

/** Raised for authentication/authorization failures (bad or unscoped PAT). */
export class AuthError extends Error {
  constructor(message = 'GitHub authentication failed') {
    super(message);
    this.name = 'AuthError';
  }
}
