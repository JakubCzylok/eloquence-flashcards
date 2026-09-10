---
starter_id: expo
package_manager: npm
project_name: eloquence-flashcards
hints:
  language_family: js
  team_size: solo
  deployment_target: appstore-via-eas
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: verified
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
---

## Why this stack

A solo builder shipping a mobile flashcard MVP in 1.5 after-hours weeks needs the fastest path to a working iOS+Android app. Expo is the recommended default for `(mobile, js)`, clears all four agent-friendly gates, and its bootstrapper confidence is verified, so scaffolding will be smooth. Deployment defaults to app-store distribution via EAS, the starter's standard target; CI runs on GitHub Actions with auto-deploy-on-merge.

**Backend added in change `auth`.** The 10xBuilder authentication requirement ("a user who logs in and sees resources assigned to them") could not be met by the original on-device model, so the app gained **Supabase** — Auth (email + password) plus Postgres with row-level security for the per-user `known_state` and `user_words` tables. Client packages: `@supabase/supabase-js`, `expo-secure-store` (reserved; the session currently uses AsyncStorage). Env vars: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`. The Supabase project must have "Confirm email" disabled for the MVP sign-up flow. Schema lives at `supabase/schema.sql`. Payments, realtime, AI, and background jobs remain out of scope.
