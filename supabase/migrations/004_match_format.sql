-- Kampformat: sets, legs, checkout-regel
create type public.checkout_mode as enum ('straight', 'double');

alter table public.game_sessions
  add column if not exists checkout_mode public.checkout_mode not null default 'straight',
  add column if not exists legs_to_win integer not null default 1
    check (legs_to_win >= 1 and legs_to_win <= 21),
  add column if not exists sets_to_win integer not null default 1
    check (sets_to_win >= 1 and sets_to_win <= 21),
  add column if not exists sets_won integer not null default 0
    check (sets_won >= 0),
  add column if not exists legs_won integer not null default 0
    check (legs_won >= 0),
  add column if not exists current_set integer not null default 1
    check (current_set >= 1),
  add column if not exists current_leg integer not null default 1
    check (current_leg >= 1);

-- Tillad afsluttet kamp med score 0 (sidste checkout) eller reset efter leg
alter table public.game_sessions
  drop constraint if exists game_sessions_finished_when_completed;

alter table public.game_sessions
  add constraint game_sessions_finished_when_completed check (
    (status = 'completed' and finished_at is not null)
    or (status <> 'completed')
  );
