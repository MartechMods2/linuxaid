-- LinuxAid V10 progression/security hardening

create or replace function public.protect_linuxaid_rank_fields()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  -- Direct browser writes run as anon/authenticated. Rank fields are maintained
  -- by trusted server functions; users may not assign them directly.
  if current_user in ('anon','authenticated') then
    if tg_op = 'INSERT' then
      new.xp := 0;
      new.rank_name := 'Kernel Seed';
      new.rank_level := 0;
      new.streak_days := 0;
      new.commands_explored := 0;
    else
      new.xp := old.xp;
      new.rank_name := old.rank_name;
      new.rank_level := old.rank_level;
      new.streak_days := old.streak_days;
      new.commands_explored := old.commands_explored;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_linuxaid_rank_fields_trigger on public.profiles;
create trigger protect_linuxaid_rank_fields_trigger
before insert or update on public.profiles
for each row execute function public.protect_linuxaid_rank_fields();

revoke all on function public.protect_linuxaid_rank_fields() from public, anon, authenticated;

-- The AI quota function is only used by the server-side AI function.
revoke all on function public.consume_linuxaid_ai_quota(uuid, integer) from public, anon, authenticated;
grant execute on function public.consume_linuxaid_ai_quota(uuid, integer) to service_role;

-- User-facing security-definer RPCs should only be callable by signed-in users.
revoke all on function public.refresh_my_linuxaid_rank() from public, anon;
grant execute on function public.refresh_my_linuxaid_rank() to authenticated, service_role;

revoke all on function public.linuxaid_start_direct_conversation(uuid) from public, anon;
grant execute on function public.linuxaid_start_direct_conversation(uuid) to authenticated, service_role;
