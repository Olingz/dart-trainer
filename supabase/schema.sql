-- ============================================================
-- Dart Trainer MVP – schema (301-spil)
-- Kør i Supabase SQL Editor
-- ============================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------
-- ENUMs
-- ----------------------------------------------------------
create type public.game_session_status as enum (
  'in_progress',
  'completed',
  'abandoned'
);

create type public.checkout_mode as enum ('straight', 'double');

-- ----------------------------------------------------------
-- BRUGERE (app-profil knyttet til Supabase Auth)
-- auth.users håndterer login; profiles er din app-data
-- ----------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.email)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------
-- SPILSESSIONER (ét 301-spil)
-- ----------------------------------------------------------
create table public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  start_score integer not null default 301
    check (start_score > 0 and start_score <= 501),
  current_score integer not null
    check (current_score >= 0 and current_score <= start_score),
  status public.game_session_status not null default 'in_progress',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  checkout_mode public.checkout_mode not null default 'straight',
  legs_to_win integer not null default 1
    check (legs_to_win >= 1 and legs_to_win <= 21),
  sets_to_win integer not null default 1
    check (sets_to_win >= 1 and sets_to_win <= 21),
  sets_won integer not null default 0 check (sets_won >= 0),
  legs_won integer not null default 0 check (legs_won >= 0),
  current_set integer not null default 1 check (current_set >= 1),
  current_leg integer not null default 1 check (current_leg >= 1),
  active_player_id uuid,
  winner_player_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint game_sessions_finished_when_completed check (
    (status = 'completed' and finished_at is not null)
    or (status <> 'completed')
  )
);

create index game_sessions_user_id_idx on public.game_sessions (user_id);
create index game_sessions_status_idx on public.game_sessions (status);

create or replace function public.init_game_session_score()
returns trigger
language plpgsql
as $$
begin
  if new.current_score is null then
    new.current_score := new.start_score;
  end if;
  return new;
end;
$$;

create trigger game_sessions_set_initial_score
  before insert on public.game_sessions
  for each row execute function public.init_game_session_score();

-- ----------------------------------------------------------
-- LOKALE MODSTANDERE (gemte navne)
-- ----------------------------------------------------------
create table public.local_opponents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 40),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create index local_opponents_user_id_idx on public.local_opponents (user_id);

-- ----------------------------------------------------------
-- SPILLERE I EN SESSION (dig + lokale modstandere)
-- ----------------------------------------------------------
create table public.game_players (
  id uuid primary key default gen_random_uuid(),
  game_session_id uuid not null references public.game_sessions (id) on delete cascade,
  display_name text not null,
  player_order integer not null check (player_order >= 0),
  is_self boolean not null default false,
  is_bot boolean not null default false,
  bot_difficulty text
    check (bot_difficulty is null or bot_difficulty in ('easy', 'medium', 'hard')),
  local_opponent_id uuid references public.local_opponents (id) on delete set null,
  current_score integer not null,
  sets_won integer not null default 0 check (sets_won >= 0),
  legs_won integer not null default 0 check (legs_won >= 0),
  created_at timestamptz not null default now(),
  unique (game_session_id, player_order)
);

create index game_players_session_id_idx on public.game_players (game_session_id);

alter table public.game_sessions
  add constraint game_sessions_active_player_fkey
    foreign key (active_player_id) references public.game_players (id) on delete set null,
  add constraint game_sessions_winner_player_fkey
    foreign key (winner_player_id) references public.game_players (id) on delete set null;

-- ----------------------------------------------------------
-- RUNDER (én tur ved skiven – typisk 3 pile)
-- ----------------------------------------------------------
create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  game_session_id uuid not null references public.game_sessions (id) on delete cascade,
  game_player_id uuid references public.game_players (id) on delete cascade,
  round_number integer not null check (round_number > 0),
  points_scored integer not null default 0 check (points_scored >= 0 and points_scored <= 180),
  score_before integer not null check (score_before >= 0),
  score_after integer not null check (score_after >= 0),
  is_bust boolean not null default false,
  created_at timestamptz not null default now(),
  unique (game_session_id, round_number)
);

create index rounds_game_session_id_idx on public.rounds (game_session_id);

-- ----------------------------------------------------------
-- KAST (én pil per række, 3 per runde)
-- ----------------------------------------------------------
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

-- ----------------------------------------------------------
-- updated_at
-- ----------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger game_sessions_set_updated_at
  before update on public.game_sessions
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------
-- Row Level Security (RLS)
-- ----------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.local_opponents enable row level security;
alter table public.game_sessions enable row level security;
alter table public.game_players enable row level security;
alter table public.rounds enable row level security;
alter table public.dart_throws enable row level security;

create policy "Profiles: select own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Profiles: update own"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Local opponents: select own"
  on public.local_opponents for select
  using (auth.uid() = user_id);

create policy "Local opponents: insert own"
  on public.local_opponents for insert
  with check (auth.uid() = user_id);

create policy "Local opponents: update own"
  on public.local_opponents for update
  using (auth.uid() = user_id);

create policy "Local opponents: delete own"
  on public.local_opponents for delete
  using (auth.uid() = user_id);

create policy "Game players: select own session"
  on public.game_players for select
  using (
    exists (
      select 1 from public.game_sessions gs
      where gs.id = game_players.game_session_id
        and gs.user_id = auth.uid()
    )
  );

create policy "Game players: insert own session"
  on public.game_players for insert
  with check (
    exists (
      select 1 from public.game_sessions gs
      where gs.id = game_players.game_session_id
        and gs.user_id = auth.uid()
    )
  );

create policy "Game players: update own session"
  on public.game_players for update
  using (
    exists (
      select 1 from public.game_sessions gs
      where gs.id = game_players.game_session_id
        and gs.user_id = auth.uid()
    )
  );

create policy "Game players: delete own session"
  on public.game_players for delete
  using (
    exists (
      select 1 from public.game_sessions gs
      where gs.id = game_players.game_session_id
        and gs.user_id = auth.uid()
    )
  );

create policy "Game sessions: select own"
  on public.game_sessions for select
  using (auth.uid() = user_id);

create policy "Game sessions: insert own"
  on public.game_sessions for insert
  with check (auth.uid() = user_id);

create policy "Game sessions: update own"
  on public.game_sessions for update
  using (auth.uid() = user_id);

create policy "Game sessions: delete own"
  on public.game_sessions for delete
  using (auth.uid() = user_id);

create policy "Rounds: select own"
  on public.rounds for select
  using (
    exists (
      select 1 from public.game_sessions gs
      where gs.id = rounds.game_session_id
        and gs.user_id = auth.uid()
    )
  );

create policy "Rounds: insert own"
  on public.rounds for insert
  with check (
    exists (
      select 1 from public.game_sessions gs
      where gs.id = rounds.game_session_id
        and gs.user_id = auth.uid()
    )
  );

create policy "Rounds: update own"
  on public.rounds for update
  using (
    exists (
      select 1 from public.game_sessions gs
      where gs.id = rounds.game_session_id
        and gs.user_id = auth.uid()
    )
  );

create policy "Rounds: delete own"
  on public.rounds for delete
  using (
    exists (
      select 1 from public.game_sessions gs
      where gs.id = rounds.game_session_id
        and gs.user_id = auth.uid()
    )
  );

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
