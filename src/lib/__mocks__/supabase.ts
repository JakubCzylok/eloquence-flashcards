/**
 * Manual jest mock for `@/lib/supabase` — an in-memory stand-in for Supabase
 * Auth + PostgREST, enough to drive the store unit tests.
 *
 * Activate with `jest.mock('@/lib/supabase')` (no factory) in a test file, then
 * drive it with the `__setUser` / `__setOffline` / `__reset` helpers and read
 * `__db` to assert on stored rows.
 */

type Row = Record<string, unknown>;

const db: { known_state: Row[]; user_words: Row[] } = { known_state: [], user_words: [] };
let currentUser: string | null = null;
let offline = false;

const NETWORK_ERROR = { message: 'network error', code: 'PGRST000' };

class Query {
  private op: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select';
  private filters: [string, unknown][] = [];
  private payload: Row | null = null;
  private single = false;
  private conflictKeys: string[] = [];

  constructor(private table: 'known_state' | 'user_words') {}

  select() {
    return this;
  }
  eq(column: string, value: unknown) {
    this.filters.push([column, value]);
    return this;
  }
  order() {
    return this;
  }
  maybeSingle() {
    this.single = true;
    return this;
  }
  insert(row: Row) {
    this.op = 'insert';
    this.payload = row;
    return this;
  }
  upsert(row: Row, opts?: { onConflict?: string }) {
    this.op = 'upsert';
    this.payload = row;
    this.conflictKeys = (opts?.onConflict ?? '').split(',').map((k) => k.trim()).filter(Boolean);
    return this;
  }
  update(row: Row) {
    this.op = 'update';
    this.payload = row;
    return this;
  }
  delete() {
    this.op = 'delete';
    return this;
  }

  then<T>(
    resolve: (value: { data: unknown; error: unknown }) => T,
    reject?: (reason: unknown) => T,
  ) {
    return this.run().then(resolve, reject);
  }

  private matches = (row: Row) => this.filters.every(([column, value]) => row[column] === value);

  private async run(): Promise<{ data: unknown; error: unknown }> {
    if (offline) {
      return { data: null, error: NETWORK_ERROR };
    }
    const rows = db[this.table];

    if (this.op === 'select') {
      const found = rows.filter(this.matches).map((row) => ({ ...row }));
      return { data: this.single ? (found[0] ?? null) : found, error: null };
    }
    if (this.op === 'insert') {
      db[this.table].push({ ...(this.payload as Row) });
      return { data: [{ ...(this.payload as Row) }], error: null };
    }
    if (this.op === 'upsert') {
      const payload = this.payload as Row;
      const index = rows.findIndex((row) => this.conflictKeys.every((key) => row[key] === payload[key]));
      if (index >= 0) {
        rows[index] = { ...rows[index], ...payload };
      } else {
        rows.push({ ...payload });
      }
      return { data: [{ ...payload }], error: null };
    }
    if (this.op === 'update') {
      const affected = rows.filter(this.matches);
      affected.forEach((row) => Object.assign(row, this.payload));
      return { data: affected.map((row) => ({ ...row })), error: null };
    }
    // delete
    db[this.table] = rows.filter((row) => !this.matches(row));
    return { data: null, error: null };
  }
}

export const supabase = {
  auth: {
    getSession: async () => ({
      data: { session: currentUser ? { user: { id: currentUser } } : null },
    }),
    getUser: async () => ({ data: { user: currentUser ? { id: currentUser } : null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signOut: async () => ({ error: null }),
    signUp: async () => ({ error: null }),
    signInWithPassword: async () => ({ error: null }),
  },
  from: (table: 'known_state' | 'user_words') => new Query(table),
};

export class NotAuthenticatedError extends Error {
  constructor(message = 'You need to be signed in to do that.') {
    super(message);
    this.name = 'NotAuthenticatedError';
  }
}

export async function currentUserId(): Promise<string | null> {
  return currentUser;
}

export async function requireUserId(): Promise<string> {
  if (!currentUser) {
    throw new NotAuthenticatedError();
  }
  return currentUser;
}

// ── test controls ───────────────────────────────────────────────────────────
export const __db = db;
export function __setUser(id: string | null) {
  currentUser = id;
}
export function __setOffline(value: boolean) {
  offline = value;
}
export function __reset() {
  db.known_state = [];
  db.user_words = [];
  currentUser = null;
  offline = false;
}
