import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { LoginScreen } from '@/components/login-screen';
import { AuthProvider, useAuth } from '@/lib/auth-context';

SplashScreen.preventAutoHideAsync();

/**
 * Auth gate: the whole app sits behind a session. While the initial
 * getSession() is in flight, render nothing — the animated splash overlay is
 * still up. No session → the login screen (no tab bar). Session → the app.
 */
function Gate() {
  const { session, loading } = useAuth();
  if (loading) {
    return null;
  }
  return session ? <AppTabs /> : <LoginScreen />;
}

export default function TabLayout() {
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
