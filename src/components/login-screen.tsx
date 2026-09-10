import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedTextInput } from '@/components/themed-text-input';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';

/**
 * The gate screen shown whenever there is no session. Email + password, with a
 * toggle between signing in and creating an account. On success the auth state
 * change swaps this screen out for the app — this component does no navigation.
 */
export function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isSignUp = mode === 'signUp';
  const canSubmit = email.trim().length > 0 && password.length > 0 && !busy;

  const submit = async () => {
    if (!canSubmit) {
      return;
    }
    setBusy(true);
    setError(null);
    const result = isSignUp
      ? await signUp(email.trim(), password)
      : await signIn(email.trim(), password);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedView style={styles.block}>
            <ThemedText type="title" style={styles.heading} accessibilityRole="header">
              {isSignUp ? 'Create your account' : 'Sign in'}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Your known words and your own cards are saved to this account.
            </ThemedText>

            <ThemedTextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              accessibilityLabel="Email"
              autoCapitalize="none"
              autoComplete="email"
              inputMode="email"
              keyboardType="email-address"
            />
            <ThemedTextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              accessibilityLabel="Password"
              autoCapitalize="none"
              secureTextEntry
              returnKeyType="go"
              onSubmitEditing={submit}
            />

            {error && (
              <ThemedText type="small" accessibilityRole="alert">
                {error}
              </ThemedText>
            )}

            <Pressable
              onPress={submit}
              disabled={!canSubmit}
              accessibilityRole="button"
              accessibilityLabel={isSignUp ? 'Create account' : 'Sign in'}>
              <ThemedView
                type={canSubmit ? 'backgroundSelected' : 'backgroundElement'}
                style={styles.button}>
                <ThemedText type="smallBold">
                  {busy ? 'Working…' : isSignUp ? 'Create account' : 'Sign in'}
                </ThemedText>
              </ThemedView>
            </Pressable>

            <Pressable
              onPress={() => {
                setMode(isSignUp ? 'signIn' : 'signUp');
                setError(null);
              }}
              accessibilityRole="button"
              accessibilityLabel={isSignUp ? 'Switch to sign in' : 'Switch to create account'}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.switchLink}>
                {isSignUp ? 'Already have an account? Sign in' : 'New here? Create an account'}
              </ThemedText>
            </Pressable>
          </ThemedView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  keyboardView: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.three,
    justifyContent: 'center',
  },
  block: {
    gap: Spacing.three,
  },
  heading: {
    fontSize: 28,
    lineHeight: 34,
  },
  button: {
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
  switchLink: {
    paddingVertical: Spacing.two,
  },
});
