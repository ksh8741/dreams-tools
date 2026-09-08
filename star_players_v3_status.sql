alter table public.star_players add column if not exists status_flags text[] not null default '{}'::text[];
update public.star_players set status_flags='{}'::text[] where status_flags is null;
