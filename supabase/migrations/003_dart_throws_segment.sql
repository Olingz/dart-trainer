-- Kør efter 002_dart_throws.sql

alter table public.dart_throws
  add column if not exists is_miss boolean not null default false,
  add column if not exists is_bull boolean not null default false,
  add column if not exists segment smallint check (
    segment is null or (segment >= 1 and segment <= 20)
  ),
  add column if not exists multiplier smallint not null default 1 check (
    multiplier in (1, 2, 3)
  );
