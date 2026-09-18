-- Keep the public/profile rank ladder identical to the LinuxAid UI.
create or replace function public.refresh_my_linuxaid_rank()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  p jsonb;
  x integer := 0;
  streak integer := 0;
  commands integer := 0;
  rank_text text := 'Kernel Seed';
  rank_idx integer := 0;
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;

  select progress into p
  from public.learner_state
  where user_id = me;

  x := greatest(0, least(1000000, coalesce((p->>'xp')::integer,0)));
  streak := greatest(0, least(10000, coalesce((p->>'streakDays')::integer,0)));
  commands := greatest(0, least(10000, jsonb_array_length(coalesce(p->'learnedCommands','[]'::jsonb))));

  if x >= 3600 then rank_text := 'Linux Legend'; rank_idx := 7;
  elsif x >= 2400 then rank_text := 'Kernel Navigator'; rank_idx := 6;
  elsif x >= 1600 then rank_text := 'Linux Operator'; rank_idx := 5;
  elsif x >= 1000 then rank_text := 'System Solver'; rank_idx := 4;
  elsif x >= 600 then rank_text := 'Command Crafter'; rank_idx := 3;
  elsif x >= 300 then rank_text := 'Terminal Tinkerer'; rank_idx := 2;
  elsif x >= 120 then rank_text := 'Shell Scout'; rank_idx := 1;
  end if;

  update public.profiles
  set xp=x,
      rank_name=rank_text,
      rank_level=rank_idx,
      streak_days=streak,
      commands_explored=commands,
      last_active_at=now(),
      updated_at=now()
  where id=me;

  return jsonb_build_object(
    'xp',x,
    'rankName',rank_text,
    'rankLevel',rank_idx,
    'streakDays',streak,
    'commandsExplored',commands
  );
end;
$$;

revoke all on function public.refresh_my_linuxaid_rank() from public, anon;
grant execute on function public.refresh_my_linuxaid_rank() to authenticated, service_role;
