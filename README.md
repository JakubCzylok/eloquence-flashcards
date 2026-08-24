# 10xDevs 3.0 — Lesson Artifacts

Offline fallback artifacts for 10xDevs 3.0 students. Two variants:

- **`claude-code/`** — versions tuned for Claude Code (SKILL.md includes the `allowed-tools` frontmatter and other Claude-specific bits).
- **`generic/`** — tool-agnostic versions (use with Cursor, Copilot, Codex, Windsurf, Gemini, etc.).

Each lesson folder contains **only the artifacts newly introduced in that lesson** (unique deltas — no duplication across lessons).

---

## PL — Jak z tego korzystać

1. Wybierz odpowiedni wariant dopasowany do narzędzia:
   - **Claude Code** → `claude-code/`
   - **Inne narzędzie AI** → `generic/`
2. Wejdź do folderu lekcji, którą realizujesz (`m1l1`, `m1l2`, …).
3. Skopiuj zawartość do swojego projektu:
   - `skills/<nazwa>/` → `.claude/skills/<nazwa>/` (Claude Code) lub `.cursor/skills/`, `.github/skills/`, `.agents/skills/`, ewentualnie `.ai/skills/` jako fallback.
   - `prompts/<nazwa>.md` → katalog promptów Twojego narzędzia (np. `.claude/commands/`).
   - `rules/<nazwa>.md` → reguły projektu (np. dopisz do `CLAUDE.md` / `AGENTS.md` / `.cursorrules`).
4. Kolejne lekcje dokładają nowe artefakty — wystarczy dograć je obok istniejących.

---

## EN — How to use

1. Pick the variant that matches your tool:
   - **Claude Code** → `claude-code/`
   - **Any other AI tool** → `generic/`
2. Open the folder for the lesson you're working on (`m1l1`, `m1l2`, …).
3. Copy contents into your project:
   - `skills/<name>/` → `.claude/skills/<name>/` (Claude Code) or `.cursor/skills/`, `.github/skills/`, `.agents/skills/`, with `.ai/skills/` as a fallback.
   - `prompts/<name>.md` → your tool's prompts/commands directory (e.g. `.claude/commands/`).
   - `rules/<name>.md` → project rules (e.g. append to `CLAUDE.md` / `AGENTS.md` / `.cursorrules`).
4. Later lessons add new artifacts — drop them in alongside the existing ones.

---

## Layout

```
{module}/
├── claude-code/
│   └── <lessonId>/
│       ├── skills/<skill-name>/SKILL.md (+ references/)
│       ├── prompts/<name>.md
│       └── rules/<name>.md
└── generic/
    └── <lessonId>/  (same shape, universal content)
```
