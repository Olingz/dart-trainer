-- Kør i Supabase SQL Editor hvis du allerede har kørt schema.sql

create table public.dart_throws (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds (id) on delete cascade,
  throw_number integer not null check (throw_number >= 1 and throw_number <= 3),
  points integer not null check (points >= 0 and points <= 60),
  is_miss boolean not null default false,
  is_bull boolean not null default false,
  segment smallint check (segment is null or (segment >= 1 and segment <= 20)),
  multiplier smallint not null default 1 check (multiplier in (1, 2, 3)),
  created_at timestamptz not null default now(),
  unique (round_id, throw_number)
);

create index dart_throws_round_id_idx on public.dart_throws (round_id);

alter table public.dart_throws enable row level security;

create policy "Dart throws: select own"
  on public.dart_throws for select
  using (
    exists (
      select 1
      from public.rounds r
      join public.game_sessions gs on gs.id = r.game_session_id
      where r.id = dart_throws.round_id
        and gs.user_id = auth.uid()
    )
  );

create policy "Dart throws: insert own"
  on public.dart_throws for insert
  with check (
    exists (
      select 1
      from public.rounds r
      join public.game_sessions gs on gs.id = r.game_session_id
      where r.id = dart_throws.round_id
        and gs.user_id = auth.uid()
    )
  );

create policy "Dart throws: update own"
  on public.dart_throws for update
  using (
    exists (
      select 1
      from public.rounds r
      join public.game_sessions gs on gs.id = r.game_session_id
      where r.id = dart_throws.round_id
        and gs.user_id = auth.uid()
    )
  );

create policy "Dart throws: delete own"
  on public.dart_throws for delete
  using (
    exists (
      select 1
      from public.rounds r
      join public.game_sessions gs on gs.id = r.game_session_id
      where r.id = dart_throws.round_id
        and gs.user_id = auth.uid()
    )
  );
