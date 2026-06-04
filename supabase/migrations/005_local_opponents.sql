-- Lokale modstandere og flerspiller i samme session
create table public.local_opponents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 40),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create index local_opponents_user_id_idx on public.local_opponents (user_id);

alter table public.local_opponents enable row level security;

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

create table public.game_players (
  id uuid primary key default gen_random_uuid(),
  game_session_id uuid not null references public.game_sessions (id) on delete cascade,
  display_name text not null,
  player_order integer not null check (player_order >= 0),
  is_self boolean not null default false,
  local_opponent_id uuid references public.local_opponents (id) on delete set null,
  current_score integer not null,
  sets_won integer not null default 0 check (sets_won >= 0),
  legs_won integer not null default 0 check (legs_won >= 0),
  created_at timestamptz not null default now(),
  unique (game_session_id, player_order)
);

create index game_players_session_id_idx on public.game_players (game_session_id);

alter table public.game_players enable row level security;

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

alter table public.game_sessions
  add column if not exists active_player_id uuid references public.game_players (id) on delete set null,
  add column if not exists winner_player_id uuid references public.game_players (id) on delete set null;

alter table public.rounds
  add column if not exists game_player_id uuid references public.game_players (id) on delete cascade;

-- Backfill eksisterende spil: én spiller (dig)
insert into public.game_players (
  game_session_id,
  display_name,
  player_order,
  is_self,
  current_score,
  sets_won,
  legs_won
)
select
  gs.id,
  coalesce(nullif(trim(p.display_name), ''), split_part(u.email, '@', 1), 'Dig'),
  0,
  true,
  gs.current_score,
  gs.sets_won,
  gs.legs_won
from public.game_sessions gs
join public.profiles p on p.id = gs.user_id
join auth.users u on u.id = gs.user_id
where not exists (
  select 1 from public.game_players gp where gp.game_session_id = gs.id
);

update public.game_sessions gs
set active_player_id = gp.id
from public.game_players gp
where gp.game_session_id = gs.id
  and gp.is_self = true
  and gs.active_player_id is null;

update public.rounds r
set game_player_id = gp.id
from public.game_players gp
where gp.game_session_id = r.game_session_id
  and gp.is_self = true
  and r.game_player_id is null;
