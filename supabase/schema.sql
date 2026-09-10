-- Eloquence Flashcards — per-user data schema (change: auth)
-- Paste into the Supabase project's SQL editor and run.
-- Safe to re-run: guarded with "if not exists" / "drop policy if exists".

-- ── known_state: one row per (user, word), the known/unknown flag ────────────
create table if not exists public.known_state (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  word_id    text        not null,
  known      boolean     not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, word_id)
);

alter table public.known_state enable row level security;

drop policy if exists "known_state is private to the owner" on public.known_state;
create policy "known_state is private to the owner"
  on public.known_state
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── user_words: the user's own flashcards (id = user-<slug(word)>) ───────────
create table if not exists public.user_words (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  id         text        not null,
  word       text        not null,
  definition text        not null,
  category   text        not null,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.user_words enable row level security;

drop policy if exists "user_words is private to the owner" on public.user_words;
create policy "user_words is private to the owner"
  on public.user_words
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
