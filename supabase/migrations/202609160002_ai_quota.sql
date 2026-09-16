-- Atomic AI request quota used only by the LinuxAid Edge Function.
create or replace function public.consume_linuxaid_ai_quota(target_user uuid, daily_limit integer default 40)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare next_count integer;
begin
  if target_user is null then
    raise exception 'target_user is required';
  end if;
  if daily_limit < 1 or daily_limit > 10000 then
    raise exception 'invalid daily limit';
  end if;

  insert into public.ai_daily_usage(user_id, usage_day, requests, updated_at)
  values (target_user, current_date, 1, now())
  on conflict (user_id, usage_day)
  do update set
    requests = public.ai_daily_usage.requests + 1,
    updated_at = now()
  returning requests into next_count;

  if next_count > daily_limit then
    raise exception 'AI_DAILY_LIMIT_REACHED';
  end if;
  return next_count;
end;
$$;

revoke all on function public.consume_linuxaid_ai_quota(uuid, integer) from public, anon, authenticated;
grant execute on function public.consume_linuxaid_ai_quota(uuid, integer) to service_role;
