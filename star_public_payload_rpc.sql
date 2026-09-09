
create or replace function public.get_star_public_payload()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'players',
    coalesce((
      select jsonb_agg(
        to_jsonb(p)
        || jsonb_build_object(
          'university_name', coalesce(u.name,''),
          'university_logo', coalesce(u.logo_url,''),
          'live_cache_live', coalesce(l.is_live,false),
          'live_cache_bno', coalesce(l.broad_no,''),
          'live_cache_title', coalesce(l.title,''),
          'live_cache_thumbnail', coalesce(l.thumbnail,''),
          'live_cache_started_at', l.started_at,
          'live_cache_checked_at', l.checked_at
        )
        order by p.sort_order asc
      )
      from public.star_players p
      left join public.star_universities u on u.id=p.university_id and u.enabled=true
      left join public.star_live_cache l on l.soop_user_id=p.soop_user_id
      where p.enabled=true
    ), '[]'::jsonb),
    'universities',
    coalesce((
      select jsonb_agg(to_jsonb(u) order by u.sort_order asc, u.name asc)
      from public.star_universities u
      where u.enabled=true
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.get_star_public_payload() from public;
grant execute on function public.get_star_public_payload() to service_role;
