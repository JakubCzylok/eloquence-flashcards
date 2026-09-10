import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { useEffect } from 'react';
import * as TestRenderer from 'react-test-renderer';

import { AuthProvider, type AuthContextValue, type AuthResult, useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
      signUp: jest.fn(async () => ({ error: null })),
      signInWithPassword: jest.fn(async () => ({ error: null })),
      signOut: jest.fn(async () => ({ error: null })),
    },
  },
  NotAuthenticatedError: class NotAuthenticatedError extends Error {},
  currentUserId: jest.fn(),
}));

type AnyMock = jest.Mock<(...args: never[]) => Promise<Record<string, unknown>>>;
const auth = supabase.auth as unknown as {
  getSession: AnyMock;
  onAuthStateChange: AnyMock;
  signUp: AnyMock;
  signInWithPassword: AnyMock;
};

let ctx: AuthContextValue | null = null;
function Probe() {
  const value = useAuth();
  useEffect(() => {
    ctx = value;
  }, [value]);
  return null;
}

async function render() {
  await TestRenderer.act(async () => {
    TestRenderer.create(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
  });
}

beforeEach(() => {
  ctx = null;
  jest.clearAllMocks();
  auth.getSession.mockImplementation(async () => ({ data: { session: null } }));
  auth.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: jest.fn() } },
  });
  auth.signUp.mockImplementation(async () => ({ error: null }));
  auth.signInWithPassword.mockImplementation(async () => ({ error: null }));
});

describe('AuthProvider', () => {
  it('starts loading, then settles to no session', async () => {
    let resolveSession: (v: { data: { session: null } }) => void = () => {};
    auth.getSession.mockImplementationOnce(
      () => new Promise((resolve) => (resolveSession = resolve)),
    );

    await render();
    expect(ctx?.loading).toBe(true);

    await TestRenderer.act(async () => {
      resolveSession({ data: { session: null } });
    });
    expect(ctx?.loading).toBe(false);
    expect(ctx?.session).toBeNull();
    expect(ctx?.user).toBeNull();
  });

  it('maps a bad-credentials sign-in error to a short message', async () => {
    await render();
    auth.signInWithPassword.mockResolvedValueOnce({
      error: { name: 'AuthError', message: 'Invalid login credentials', status: 400 },
    });

    let result: AuthResult | undefined;
    await TestRenderer.act(async () => {
      result = await ctx!.signIn('user@example.test', 'wrong');
    });
    expect(result).toEqual({ ok: false, message: 'Wrong email or password.' });
  });

  it('returns ok on a successful sign-up', async () => {
    await render();

    let result: AuthResult | undefined;
    await TestRenderer.act(async () => {
      result = await ctx!.signUp('new@example.test', 'secret123');
    });
    expect(result).toEqual({ ok: true });
    expect(auth.signUp).toHaveBeenCalledWith({
      email: 'new@example.test',
      password: 'secret123',
    });
  });

  it('surfaces the raw message for an unmapped error', async () => {
    await render();
    auth.signInWithPassword.mockResolvedValueOnce({
      error: { name: 'AuthError', message: 'Service temporarily unavailable', status: 503 },
    });

    let result: AuthResult | undefined;
    await TestRenderer.act(async () => {
      result = await ctx!.signIn('user@example.test', 'whatever');
    });
    expect(result).toEqual({ ok: false, message: 'Service temporarily unavailable' });
  });
});
