import { DarkTheme, DefaultTheme, Slot, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { LoginScreen } from '@/components/login-screen';
import { AuthProvider, useAuth } from '@/lib/auth-context';

SplashScreen.preventAutoHideAsync();

/**
 * Auth gate: the whole app sits behind a session. While the initial
 * getSession() is in flight, render nothing — the animated splash overlay is
 * still up. No session → the login screen. Session → the routed app (a single
 * `index` screen; no tab bar).
 */
function Gate() {
  const { session, loading } = useAuth();
  if (loading) {
    return null;
  }
  return session ? <Slot /> : <LoginScreen />;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <AnimatedSplashOverlay />
        <Gate />
      </AuthProvider>
    </ThemeProvider>
  );
}
