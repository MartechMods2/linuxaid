-- LinuxAid Supabase backend
-- Auth + profiles + synced learner state + community + notifications + AI quotas.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'LinuxAid Learner' check (char_length(display_name) between 1 and 80),
  distro text not null default '' check (char_length(distro) <= 40),
  learning_goal text not null default '' check (char_length(learning_goal) <= 500),
  avatar_url text not null default '' check (char_length(avatar_url) <= 500),
  role text not null default 'learner' check (role in ('learner','moderator','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.learner_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  chat_history jsonb not null default '[]'::jsonb,
  progress jsonb not null default '{}'::jsonb,
  learning jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint chat_history_is_array check (jsonb_typeof(chat_history) = 'array'),
  constraint progress_is_object check (jsonb_typeof(progress) = 'object'),
  constraint learning_is_object check (jsonb_typeof(learning) = 'object'),
  constraint settings_is_object check (jsonb_typeof(settings) = 'object')
);

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null default 'LinuxAid Learner' check (char_length(author_name) <= 80),
  title text not null check (char_length(title) between 8 and 160),
  body text not null check (char_length(body) between 20 and 8000),
  upvotes_count integer not null default 0 check (upvotes_count >= 0),
  reply_count integer not null default 0 check (reply_count >= 0),
  is_locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists community_posts_created_idx on public.community_posts(created_at desc);
create index if not exists community_posts_author_idx on public.community_posts(author_id, created_at desc);

create table if not exists public.community_replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null default 'LinuxAid Learner' check (char_length(author_name) <= 80),
  body text not null check (char_length(body) between 2 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists community_replies_post_idx on public.community_replies(post_id, created_at);

create table if not exists public.community_votes (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(post_id, user_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null default 'info' check (char_length(type) <= 40),
  title text not null check (char_length(title) between 1 and 160),
  body text not null default '' check (char_length(body) <= 2000),
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notification_metadata_is_object check (jsonb_typeof(metadata) = 'object')
);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);

-- Only Edge Functions/service-role code should use this table.
create table if not exists public.ai_daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_day date not null default current_date,
  requests integer not null default 0 check (requests >= 0),
  updated_at timestamptz not null default now(),
  primary key(user_id, usage_day)
);

create or replace function public.is_linuxaid_admin(check_uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.profiles where id = check_uid and role = 'admin');
$$;

create or replace function public.handle_new_linuxaid_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'display_name',''), nullif(new.raw_user_meta_data->>'full_name',''), split_part(coalesce(new.email,'LinuxAid Learner'),'@',1), 'LinuxAid Learner'))
  on conflict (id) do nothing;

  insert into public.learner_state(user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_linuxaid on auth.users;
create trigger on_auth_user_created_linuxaid
after insert on auth.users
for each row execute function public.handle_new_linuxaid_user();

-- Backfill profiles/state if the project already has users.
insert into public.profiles(id, display_name)
select id, coalesce(nullif(raw_user_meta_data->>'display_name',''), nullif(raw_user_meta_data->>'full_name',''), split_part(coalesce(email,'LinuxAid Learner'),'@',1), 'LinuxAid Learner')
from auth.users
on conflict (id) do nothing;
insert into public.learner_state(user_id)
select id from auth.users
on conflict (user_id) do nothing;

create or replace function public.protect_linuxaid_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_linuxaid_admin(auth.uid()) then
    new.role := old.role;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists protect_linuxaid_role_trigger on public.profiles;
create trigger protect_linuxaid_role_trigger
before update on public.profiles
for each row execute function public.protect_linuxaid_role();

create or replace function public.apply_linuxaid_author_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select coalesce(nullif(display_name,''),'LinuxAid Learner') into new.author_name
  from public.profiles where id = new.author_id;
  new.author_name := coalesce(new.author_name,'LinuxAid Learner');
  return new;
end;
$$;

drop trigger if exists community_post_author_name on public.community_posts;
create trigger community_post_author_name
before insert or update of author_id on public.community_posts
for each row execute function public.apply_linuxaid_author_name();

drop trigger if exists community_reply_author_name on public.community_replies;
create trigger community_reply_author_name
before insert or update of author_id on public.community_replies
for each row execute function public.apply_linuxaid_author_name();

create or replace function public.refresh_linuxaid_vote_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare target uuid;
begin
  target := coalesce(new.post_id, old.post_id);
  update public.community_posts
  set upvotes_count = (select count(*) from public.community_votes where post_id = target), updated_at = now()
  where id = target;
  return coalesce(new, old);
end;
$$;

drop trigger if exists refresh_linuxaid_vote_count_trigger on public.community_votes;
create trigger refresh_linuxaid_vote_count_trigger
after insert or delete on public.community_votes
for each row execute function public.refresh_linuxaid_vote_count();

create or replace function public.refresh_linuxaid_reply_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare target uuid;
begin
  target := coalesce(new.post_id, old.post_id);
  update public.community_posts
  set reply_count = (select count(*) from public.community_replies where post_id = target), updated_at = now()
  where id = target;
  return coalesce(new, old);
end;
$$;

drop trigger if exists refresh_linuxaid_reply_count_trigger on public.community_replies;
create trigger refresh_linuxaid_reply_count_trigger
after insert or delete on public.community_replies
for each row execute function public.refresh_linuxaid_reply_count();

alter table public.profiles enable row level security;
alter table public.learner_state enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_replies enable row level security;
alter table public.community_votes enable row level security;
alter table public.notifications enable row level security;
alter table public.ai_daily_usage enable row level security;

-- Profiles are private; author names are copied safely into community rows.
drop policy if exists profiles_own_read on public.profiles;
create policy profiles_own_read on public.profiles for select to authenticated using (id = auth.uid() or public.is_linuxaid_admin());
drop policy if exists profiles_own_insert on public.profiles;
create policy profiles_own_insert on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists profiles_own_update on public.profiles;
create policy profiles_own_update on public.profiles for update to authenticated using (id = auth.uid() or public.is_linuxaid_admin()) with check (id = auth.uid() or public.is_linuxaid_admin());

-- Learner state is private to the signed-in learner.
drop policy if exists learner_state_own_read on public.learner_state;
create policy learner_state_own_read on public.learner_state for select to authenticated using (user_id = auth.uid());
drop policy if exists learner_state_own_insert on public.learner_state;
create policy learner_state_own_insert on public.learner_state for insert to authenticated with check (user_id = auth.uid());
drop policy if exists learner_state_own_update on public.learner_state;
create policy learner_state_own_update on public.learner_state for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Community is publicly readable. Signed-in users own what they publish.
drop policy if exists community_posts_public_read on public.community_posts;
create policy community_posts_public_read on public.community_posts for select using (true);
drop policy if exists community_posts_own_insert on public.community_posts;
create policy community_posts_own_insert on public.community_posts for insert to authenticated with check (author_id = auth.uid());
drop policy if exists community_posts_own_update on public.community_posts;
create policy community_posts_own_update on public.community_posts for update to authenticated using (author_id = auth.uid() or public.is_linuxaid_admin()) with check (author_id = auth.uid() or public.is_linuxaid_admin());
drop policy if exists community_posts_own_delete on public.community_posts;
create policy community_posts_own_delete on public.community_posts for delete to authenticated using (author_id = auth.uid() or public.is_linuxaid_admin());

drop policy if exists community_replies_public_read on public.community_replies;
create policy community_replies_public_read on public.community_replies for select using (true);
drop policy if exists community_replies_own_insert on public.community_replies;
create policy community_replies_own_insert on public.community_replies for insert to authenticated with check (author_id = auth.uid() and exists(select 1 from public.community_posts where id = post_id and not is_locked));
drop policy if exists community_replies_own_update on public.community_replies;
create policy community_replies_own_update on public.community_replies for update to authenticated using (author_id = auth.uid() or public.is_linuxaid_admin()) with check (author_id = auth.uid() or public.is_linuxaid_admin());
drop policy if exists community_replies_own_delete on public.community_replies;
create policy community_replies_own_delete on public.community_replies for delete to authenticated using (author_id = auth.uid() or public.is_linuxaid_admin());

drop policy if exists community_votes_public_read on public.community_votes;
create policy community_votes_public_read on public.community_votes for select using (true);
drop policy if exists community_votes_own_insert on public.community_votes;
create policy community_votes_own_insert on public.community_votes for insert to authenticated with check (user_id = auth.uid());
drop policy if exists community_votes_own_delete on public.community_votes;
create policy community_votes_own_delete on public.community_votes for delete to authenticated using (user_id = auth.uid());

drop policy if exists notifications_own_read on public.notifications;
create policy notifications_own_read on public.notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists notifications_own_update on public.notifications;
create policy notifications_own_update on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- No client policies for ai_daily_usage: only service-role Edge Functions can access it.

-- Avatar storage. Public reads are okay; only a user may write inside their own folder.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('avatars','avatars',true,2097152,array['image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avatar_public_read on storage.objects;
create policy avatar_public_read on storage.objects for select using (bucket_id = 'avatars');
drop policy if exists avatar_own_insert on storage.objects;
create policy avatar_own_insert on storage.objects for insert to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists avatar_own_update on storage.objects;
create policy avatar_own_update on storage.objects for update to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text) with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists avatar_own_delete on storage.objects;
create policy avatar_own_delete on storage.objects for delete to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
