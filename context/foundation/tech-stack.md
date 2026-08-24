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
  has_auth: false
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
---

## Why this stack

A solo builder shipping a local-first, single-user mobile flashcard MVP in 1.5 after-hours weeks needs the fastest path to a working iOS+Android app with no backend. Expo is the recommended default for `(mobile, js)`, clears all four agent-friendly gates, and its bootstrapper confidence is verified, so scaffolding will be smooth. No auth, payments, realtime, AI, or background jobs are in scope per the PRD's FRs and Non-Goals — the app runs entirely on-device. Deployment defaults to app-store distribution via EAS, the starter's standard target; CI runs on GitHub Actions with auto-deploy-on-merge.
