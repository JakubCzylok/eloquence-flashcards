import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

/**
 * The one Supabase client for the app. Built at module scope — never inside a
 * component.
 *
 * Session storage: AsyncStorage on every platform. This is the pattern the Expo
 * + Supabase guide recommends for the common case; `expo-secure-store` is
 * installed but reserved for a future hardening pass (its ~2 KB per-value limit
 * makes it unreliable for a full Supabase session without a chunking/encryption
 * wrapper, which is out of scope here). On web AsyncStorage is backed by
 * `localStorage`, which is Supabase's default there anyway.
 *
 * `detectSessionInUrl: false` — there is no OAuth redirect flow (email +
 * password only).
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Missing Supabase env vars. Set EXPO_PUBLIC_SUPABASE_URL and ' +
      'EXPO_PUBLIC_SUPABASE_ANON_KEY in .env (see supabase/schema.sql and ' +
      'context/changes/auth/plan.md).',
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/** Raised by data-layer writes when there is no signed-in user. */
export class NotAuthenticatedError extends Error {
  constructor(message = 'You need to be signed in to do that.') {
    super(message);
    this.name = 'NotAuthenticatedError';
  }
}

/** The current user's id, or `null` when signed out. */
export async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/** The current user's id, or throw `NotAuthenticatedError`. Use before a write. */
export async function requireUserId(): Promise<string> {
  const id = await currentUserId();
  if (!id) {
    throw new NotAuthenticatedError();
  }
  return id;
}
