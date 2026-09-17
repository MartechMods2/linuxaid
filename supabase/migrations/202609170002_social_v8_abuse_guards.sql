-- LinuxAid Social V8 abuse controls and discovery policy.

-- Public profiles contain only intentionally public LinuxAid identity fields.
-- This allows signed-out visitors to discover members who opted in with is_public=true,
-- while owners/admins retain their authenticated access.
drop policy if exists profiles_discoverable_read on public.profiles;
create policy profiles_discoverable_read on public.profiles for select using (
  is_public=true
  or id=(select auth.uid())
  or public.is_linuxaid_admin((select auth.uid()))
);

-- Basic database-side flood protection. These complement browser UX and API/firewall limits.
create or replace function public.linuxaid_social_rate_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid(); recent_count integer := 0;
begin
  if uid is null then raise exception 'Authentication required'; end if;

  if tg_table_name='community_posts' then
    select count(*) into recent_count from public.community_posts
    where author_id=uid and created_at > now()-interval '15 seconds';
    if recent_count >= 1 then raise exception 'Please wait a few seconds before publishing another post'; end if;

  elsif tg_table_name='community_replies' then
    select count(*) into recent_count from public.community_replies
    where author_id=uid and created_at > now()-interval '3 seconds';
    if recent_count >= 1 then raise exception 'Please wait before posting another reply'; end if;

  elsif tg_table_name='messages' then
    select count(*) into recent_count from public.messages
    where sender_id=uid and created_at > now()-interval '1 second';
    if recent_count >= 3 then raise exception 'You are sending messages too quickly'; end if;

  elsif tg_table_name='content_reports' then
    select count(*) into recent_count from public.content_reports
    where reporter_id=uid and created_at > now()-interval '30 seconds';
    if recent_count >= 3 then raise exception 'Too many reports. Please wait before submitting more'; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists linuxaid_posts_rate_guard on public.community_posts;
create trigger linuxaid_posts_rate_guard before insert on public.community_posts
for each row execute function public.linuxaid_social_rate_guard();

drop trigger if exists linuxaid_replies_rate_guard on public.community_replies;
create trigger linuxaid_replies_rate_guard before insert on public.community_replies
for each row execute function public.linuxaid_social_rate_guard();

drop trigger if exists linuxaid_messages_rate_guard on public.messages;
create trigger linuxaid_messages_rate_guard before insert on public.messages
for each row execute function public.linuxaid_social_rate_guard();

drop trigger if exists linuxaid_reports_rate_guard on public.content_reports;
create trigger linuxaid_reports_rate_guard before insert on public.content_reports
for each row execute function public.linuxaid_social_rate_guard();

revoke all on function public.linuxaid_social_rate_guard() from public;
