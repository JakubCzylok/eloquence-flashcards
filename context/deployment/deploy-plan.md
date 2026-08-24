---
project: "Eloquence Flashcards"
deployed_at: 2026-08-24
platform: EAS (Expo Application Services)
build_profile: preview
build_platform: android
build_status: finished
---

## Cel

Pierwsze wdrożenie projektu: zweryfikowany Android preview build dystrybuowany przez EAS Build, wykonany przez agenta w Plan Mode zgodnie z `context/foundation/infrastructure.md` (rekomendacja EAS) i `context/foundation/tech-stack.md` (`deployment_target: appstore-via-eas`).

## Źródła

- `context/foundation/infrastructure.md` — badanie platformy, risk register, sekcja "Getting Started".
- `context/foundation/tech-stack.md` — hand-off ze stack pickera (`starter_id: expo`, `team_size: solo`).

## Stan repo przed wdrożeniem

- **Placeholder identity** (`.bootstrap-scaffold` w `app.json`/`package.json`), oznaczony jako ryzyko wysokie w `infrastructure.md`, okazał się **już naprawiony** przed rozpoczęciem tego wdrożenia — `app.json`/`package.json` zawierały poprawną nazwę produktu (`Eloquence Flashcards` / `eloquence-flashcards`). Krok pominięty.
- **Repo git nie istniało.** Zainicjalizowano (`git init`), zweryfikowano `.gitignore` (poprawnie wyklucza `node_modules/`, `.expo/`, `/ios`, `/android`, klucze i certyfikaty), pierwszy commit `f5006b5`.
- **`eas.json` nie istniał.** Wygenerowany przez `eas build:configure`.
- **`android.package` nie był ustawiony** w `app.json` — wymagane przez `eas build --non-interactive`. Ustawiono `com.jakubczylok.eloquenceflashcards`.

## Wykonane kroki

1. `git init` + `git add -A` + pierwszy commit (`f5006b5646d4c122f61a0d20b32246cac8d8169b`).
2. `npx eas-cli login` (manualna bramka, wykonana przez użytkownika).
3. `npx eas-cli init --account jakubczylok --non-interactive` → utworzono projekt `@jakubczylok/eloquence-flashcards`, `projectId: 4763ff4a-f5e2-4872-b38d-39fee0083ab2`, zapisany w `app.json` → `extra.eas.projectId`.
4. `npx eas-cli build:configure --platform android` → wygenerowano `eas.json` (profile `development`/`preview`/`production`; `preview` ma `distribution: internal`).
5. Dodano `android.package: com.jakubczylok.eloquenceflashcards` do `app.json` (wymagane dla non-interactive buildu).
6. `npx eas-cli build --platform android --profile preview --non-interactive --no-wait` → build ID `36265f2f-20b5-4173-9669-3bbdceee3f08`. EAS wygenerował keystore Androida w chmurze (nie było lokalnego `keytool`).
7. Monitorowanie statusu (`eas build:view`) aż do stanu końcowego.
8. Równolegle: instalacja `gh` CLI, `gh auth login`, `gh repo create eloquence-flashcards --public --source=. --remote=origin --push` → zdalne repo utworzone i kod wypchnięty na **https://github.com/JakubCzylok/eloquence-flashcards**.

## Wynik builda

| Pole | Wartość |
|---|---|
| Build ID | `36265f2f-20b5-4173-9669-3bbdceee3f08` |
| Status | `finished` |
| Platforma | Android |
| Profil | preview (internal distribution) |
| SDK | Expo 57.0.0 |
| Wersja | 1.0.0 (versionCode 1) |
| Commit | `f5006b5646d4c122f61a0d20b32246cac8d8169b` |
| Czas | 21:33 → 22:11 (~38 min, w ramach darmowego limitu kolejki) |
| Link do logów | https://expo.dev/accounts/jakubczylok/projects/eloquence-flashcards/builds/36265f2f-20b5-4173-9669-3bbdceee3f08 |
| APK (do instalacji) | https://expo.dev/artifacts/eas/9EhCk5P4LBLBaQXOsVRQ9NX19i89B8wt85TFLGW6BX8.apk |

## Weryfikacja

- ✅ `eas build:view` zwraca status `finished` dla platformy `android`.
- ✅ `app.json` zawiera `extra.eas.projectId` po `eas init`.
- ✅ `eas.json` istnieje z profilami `development`/`preview`/`production`.
- ✅ `git log` pokazuje commit `f5006b5` (repo zainicjalizowane, wypchnięte na GitHub).
- ⏳ **Manualna weryfikacja na urządzeniu** — instalacja APK z linku powyżej i potwierdzenie, że aplikacja się uruchamia bez crasha, pozostaje do wykonania przez użytkownika (poza zakresem tego, co agent może zweryfikować zdalnie).

## Ryzyka przeniesione z `infrastructure.md` (risk register)

| Ryzyko | Status po tym wdrożeniu |
|---|---|
| Kolejka darmowego tieru (60–90+ min) opóźnia iterację | Aktywne, ale w tym przebiegu build zajął ~38 min — w normie. Nadal ograniczać liczbę cloud buildów przy iteracji. |
| Przekroczenie darmowego limitu (15+15/mies.) wymusza $225/mo | Aktywne — 1 build zużyty z limitu. Nie włączać auto-deploy-on-merge (patrz niżej). |
| `.bootstrap-scaffold` placeholder | **Zmitygowane** — nazwa produktu była już poprawna przed tym wdrożeniem. |
| EAS Update (OTA) nie pokrywa zmian natywnych | Aktywne, nieistotne na tym etapie (jeszcze brak OTA). |
| Vendor lock-in na Expo Inc. | Aktywne, `eas build --local` pozostaje udokumentowaną furtką ucieczki. |
| Brak wbudowanego crash reportingu | Aktywne, nieistotne na tym etapie. |

## Odłożone poza ten krok (świadomie, zgodnie z `infrastructure.md` → "Out of Scope")

- **CI/CD (GitHub Actions, `ci_default_flow: auto-deploy-on-merge`)** — świadomie NIE skonfigurowane. Risk register w `infrastructure.md` rekomenduje ręczne/on-demand buildy podczas aktywnej iteracji, żeby nie zużywać darmowego limitu EAS na każdym commicie. Repo na GitHubie istnieje (do pushowania kodu), ale bez żadnego workflow Actions.
- **`eas submit` (App Store / Play Store submission)** — wymaga ludzkiej autoryzacji na poziomie konta Google/Apple; do zrobienia po ręcznej weryfikacji builda na urządzeniu.
- **iOS build** — użytkownik wybrał Android jako pierwszą platformę (brak kosztu Apple Developer Program na start).
- **EAS Update / OTA setup** — nie skonfigurowane, nie potrzebne przed pierwszym zweryfikowanym buildem natywnym.
- **Crash reporting (Sentry)** — jawnie poza zakresem EAS, do rozważenia post-MVP.

## Następne kroki

1. Zainstalować APK z linku powyżej na fizycznym urządzeniu/emulatorze Android i potwierdzić, że aplikacja działa (uruchamia się, nawiguje, nie crashuje).
2. Po potwierdzeniu — rozważyć build iOS (`eas build --platform ios --profile preview`), co wymaga aktywnego konta Apple Developer Program.
3. Dopiero po kilku ręcznie zweryfikowanych buildach — rozważyć podłączenie GitHub Actions (bez `auto-deploy-on-merge` na starcie, żeby nie wyczerpać darmowego limitu).
