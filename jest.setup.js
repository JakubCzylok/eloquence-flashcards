// Jest setup — registered via `setupFilesAfterEnv` in package.json so it runs
// alongside (not instead of) the jest-expo preset's own `setupFiles`.
//
// Swap the real AsyncStorage for the in-memory mock the package ships, so
// storage-backed units (`vocabulary-store`, `user-vocabulary`) run without a
// native module. Each test file gets a fresh store; call
// `AsyncStorage.clear()` in `beforeEach` when a test needs a known-empty start.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
