alter table public.game_players
  add column if not exists is_bot boolean not null default false,
  add column if not exists bot_difficulty text
    check (bot_difficulty is null or bot_difficulty in ('easy', 'medium', 'hard'));
