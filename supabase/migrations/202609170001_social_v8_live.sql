-- LinuxAid Social V8
-- Brings the checked-in database schema in line with the live social UI.
-- Safe to run repeatedly where possible through IF NOT EXISTS / CREATE OR REPLACE.

-- ---------------------------------------------------------------------------
-- Public profile discovery fields
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists headline text not null default '';
alter table public.profiles add column if not exists bio text not null default '';
alter table public.profiles add column if not exists is_public boolean not null default false;
alter table public.profiles add column if not exists follower_count integer not null default 0;
alter table public.profiles add column if not exists following_count integer not null default 0;
alter table public.profiles add column if not exists xp integer not null default 0;
alter table public.profiles add column if not exists rank_name text not null default 'Kernel Seed';
alter table public.profiles add column if not exists last_active_at timestamptz not null default now();
alter table public.profiles add column if not exists post_count integer not null default 0;

alter table public.profiles drop constraint if exists profiles_username_length;
alter table public.profiles add constraint profiles_username_length check (username is null or char_length(username) between 3 and 30);
alter table public.profiles drop constraint if exists profiles_headline_length;
alter table public.profiles add constraint profiles_headline_length check (char_length(headline) <= 120);
alter table public.profiles drop constraint if exists profiles_bio_length;
alter table public.profiles add constraint profiles_bio_length check (char_length(bio) <= 1000);
alter table public.profiles drop constraint if exists profiles_counts_nonnegative;
alter table public.profiles add constraint profiles_counts_nonnegative check (follower_count >= 0 and following_count >= 0 and xp >= 0 and post_count >= 0);

create unique index if not exists profiles_username_unique_idx on public.profiles(lower(username)) where username is not null;
create index if not exists profiles_public_activity_idx on public.profiles(is_public, last_active_at desc);
create index if not exists profiles_rank_xp_idx on public.profiles(xp desc);

-- ---------------------------------------------------------------------------
-- Rich community posts
-- ---------------------------------------------------------------------------
alter table public.community_posts add column if not exists tags text[] not null default '{}'::text[];
alter table public.community_posts add column if not exists is_solved boolean not null default false;
alter table public.community_posts add column if not exists reaction_counts jsonb not null default '{}'::jsonb;
alter table public.community_posts add column if not exists bookmark_count integer not null default 0;

alter table public.community_posts drop constraint if exists community_posts_tags_limit;
alter table public.community_posts add constraint community_posts_tags_limit check (cardinality(tags) <= 5);
alter table public.community_posts drop constraint if exists community_posts_bookmark_nonnegative;
alter table public.community_posts add constraint community_posts_bookmark_nonnegative check (bookmark_count >= 0);
create index if not exists community_posts_tags_idx on public.community_posts using gin(tags);
create index if not exists community_posts_updated_idx on public.community_posts(updated_at desc);

create table if not exists public.community_reactions (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null check (reaction in ('like','helpful','insightful','solved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(post_id,user_id)
);
create index if not exists community_reactions_user_idx on public.community_reactions(user_id,created_at desc);

create table if not exists public.community_bookmarks (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(post_id,user_id)
);
create index if not exists community_bookmarks_user_idx on public.community_bookmarks(user_id,created_at desc);

create table if not exists public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(follower_id,following_id),
  constraint follows_not_self check (follower_id <> following_id)
);
create index if not exists follows_following_idx on public.follows(following_id,created_at desc);

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('post','reply','profile','message')),
  target_id uuid not null,
  reason text not null check (char_length(reason) between 3 and 500),
  status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);
create index if not exists content_reports_status_idx on public.content_reports(status,created_at desc);
create index if not exists content_reports_reporter_idx on public.content_reports(reporter_id,created_at desc);

-- ---------------------------------------------------------------------------
-- Private conversations and messages
-- ---------------------------------------------------------------------------
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  title text,
  is_group boolean not null default false,
  created_by uuid not null references auth.users(id) on delete cascade,
  last_message_at timestamptz,
  last_message_preview text not null default '',
  last_sender_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint conversations_title_length check (title is null or char_length(title) <= 120),
  constraint conversations_preview_length check (char_length(last_message_preview) <= 220)
);
create index if not exists conversations_last_message_idx on public.conversations(last_message_at desc nulls last);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key(conversation_id,user_id)
);
create index if not exists conversation_members_user_idx on public.conversation_members(user_id,conversation_id);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);
create index if not exists messages_conversation_idx on public.messages(conversation_id,created_at);
create index if not exists messages_sender_idx on public.messages(sender_id,created_at desc);

-- ---------------------------------------------------------------------------
-- Helper functions / counters
-- ---------------------------------------------------------------------------
create or replace function public.linuxaid_is_conversation_member(target_conversation uuid, check_uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.conversation_members
    where conversation_id = target_conversation and user_id = check_uid
  );
$$;

create or replace function public.linuxaid_refresh_follow_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare follower uuid; following uuid;
begin
  follower := coalesce(new.follower_id,old.follower_id);
  following := coalesce(new.following_id,old.following_id);
  update public.profiles set following_count=(select count(*) from public.follows where follower_id=follower) where id=follower;
  update public.profiles set follower_count=(select count(*) from public.follows where following_id=following) where id=following;
  return coalesce(new,old);
end;
$$;
drop trigger if exists linuxaid_refresh_follow_counts_trigger on public.follows;
create trigger linuxaid_refresh_follow_counts_trigger after insert or delete on public.follows for each row execute function public.linuxaid_refresh_follow_counts();

create or replace function public.linuxaid_refresh_post_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid;
begin
  uid := coalesce(new.author_id,old.author_id);
  update public.profiles set post_count=(select count(*) from public.community_posts where author_id=uid) where id=uid;
  return coalesce(new,old);
end;
$$;
drop trigger if exists linuxaid_refresh_post_count_trigger on public.community_posts;
create trigger linuxaid_refresh_post_count_trigger after insert or delete on public.community_posts for each row execute function public.linuxaid_refresh_post_count();

create or replace function public.linuxaid_refresh_reactions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare target uuid;
begin
  target := coalesce(new.post_id,old.post_id);
  update public.community_posts set reaction_counts=jsonb_build_object(
    'like',(select count(*) from public.community_reactions where post_id=target and reaction='like'),
    'helpful',(select count(*) from public.community_reactions where post_id=target and reaction='helpful'),
    'insightful',(select count(*) from public.community_reactions where post_id=target and reaction='insightful'),
    'solved',(select count(*) from public.community_reactions where post_id=target and reaction='solved')
  ), updated_at=now() where id=target;
  return coalesce(new,old);
end;
$$;
drop trigger if exists linuxaid_refresh_reactions_trigger on public.community_reactions;
create trigger linuxaid_refresh_reactions_trigger after insert or update or delete on public.community_reactions for each row execute function public.linuxaid_refresh_reactions();

create or replace function public.linuxaid_refresh_bookmarks()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare target uuid;
begin
  target := coalesce(new.post_id,old.post_id);
  update public.community_posts set bookmark_count=(select count(*) from public.community_bookmarks where post_id=target) where id=target;
  return coalesce(new,old);
end;
$$;
drop trigger if exists linuxaid_refresh_bookmarks_trigger on public.community_bookmarks;
create trigger linuxaid_refresh_bookmarks_trigger after insert or delete on public.community_bookmarks for each row execute function public.linuxaid_refresh_bookmarks();

create or replace function public.linuxaid_refresh_conversation_preview()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations set
    last_message_at=new.created_at,
    last_message_preview=left(new.body,220),
    last_sender_id=new.sender_id
  where id=new.conversation_id;
  return new;
end;
$$;
drop trigger if exists linuxaid_refresh_conversation_preview_trigger on public.messages;
create trigger linuxaid_refresh_conversation_preview_trigger after insert on public.messages for each row execute function public.linuxaid_refresh_conversation_preview();

create or replace function public.linuxaid_start_direct_conversation(target_user uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare me uuid := auth.uid(); convo uuid;
begin
  if me is null then raise exception 'Authentication required'; end if;
  if target_user is null or target_user = me then raise exception 'Invalid conversation target'; end if;
  if not exists(select 1 from public.profiles where id=target_user and is_public=true) then raise exception 'User is not available for new conversations'; end if;

  select c.id into convo
  from public.conversations c
  where c.is_group=false
    and exists(select 1 from public.conversation_members m where m.conversation_id=c.id and m.user_id=me)
    and exists(select 1 from public.conversation_members m where m.conversation_id=c.id and m.user_id=target_user)
    and (select count(*) from public.conversation_members m where m.conversation_id=c.id)=2
  order by c.created_at desc limit 1;

  if convo is null then
    insert into public.conversations(created_by,is_group) values(me,false) returning id into convo;
    insert into public.conversation_members(conversation_id,user_id,last_read_at) values(convo,me,now()),(convo,target_user,null);
  end if;
  return convo;
end;
$$;

create or replace function public.linuxaid_mark_conversation_read(target_conversation uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update public.conversation_members set last_read_at=now()
  where conversation_id=target_conversation and user_id=auth.uid();
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.community_reactions enable row level security;
alter table public.community_bookmarks enable row level security;
alter table public.follows enable row level security;
alter table public.content_reports enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

-- Profiles: owner/admin can always read; discoverable profiles are readable by signed-in users.
drop policy if exists profiles_own_read on public.profiles;
drop policy if exists profiles_discoverable_read on public.profiles;
create policy profiles_discoverable_read on public.profiles for select to authenticated using (
  id=(select auth.uid()) or is_public=true or public.is_linuxaid_admin((select auth.uid()))
);

-- Reactions are private per user; aggregate counts live on community_posts.
drop policy if exists community_reactions_own_read on public.community_reactions;
create policy community_reactions_own_read on public.community_reactions for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists community_reactions_own_insert on public.community_reactions;
create policy community_reactions_own_insert on public.community_reactions for insert to authenticated with check (user_id=(select auth.uid()));
drop policy if exists community_reactions_own_update on public.community_reactions;
create policy community_reactions_own_update on public.community_reactions for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
drop policy if exists community_reactions_own_delete on public.community_reactions;
create policy community_reactions_own_delete on public.community_reactions for delete to authenticated using (user_id=(select auth.uid()));

-- Bookmarks are private.
drop policy if exists community_bookmarks_own_read on public.community_bookmarks;
create policy community_bookmarks_own_read on public.community_bookmarks for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists community_bookmarks_own_insert on public.community_bookmarks;
create policy community_bookmarks_own_insert on public.community_bookmarks for insert to authenticated with check (user_id=(select auth.uid()));
drop policy if exists community_bookmarks_own_delete on public.community_bookmarks;
create policy community_bookmarks_own_delete on public.community_bookmarks for delete to authenticated using (user_id=(select auth.uid()));

-- Follows: a user manages only their outgoing follows. Either side can read the relationship.
drop policy if exists follows_member_read on public.follows;
create policy follows_member_read on public.follows for select to authenticated using (follower_id=(select auth.uid()) or following_id=(select auth.uid()));
drop policy if exists follows_own_insert on public.follows;
create policy follows_own_insert on public.follows for insert to authenticated with check (follower_id=(select auth.uid()) and follower_id<>following_id);
drop policy if exists follows_own_delete on public.follows;
create policy follows_own_delete on public.follows for delete to authenticated using (follower_id=(select auth.uid()));

-- Reports: users can submit; admins can review.
drop policy if exists content_reports_own_insert on public.content_reports;
create policy content_reports_own_insert on public.content_reports for insert to authenticated with check (reporter_id=(select auth.uid()));
drop policy if exists content_reports_admin_read on public.content_reports;
create policy content_reports_admin_read on public.content_reports for select to authenticated using (public.is_linuxaid_admin((select auth.uid())));
drop policy if exists content_reports_admin_update on public.content_reports;
create policy content_reports_admin_update on public.content_reports for update to authenticated using (public.is_linuxaid_admin((select auth.uid()))) with check (public.is_linuxaid_admin((select auth.uid())));

-- Conversations/messages are visible only to members.
drop policy if exists conversations_member_read on public.conversations;
create policy conversations_member_read on public.conversations for select to authenticated using (public.linuxaid_is_conversation_member(id,(select auth.uid())));
drop policy if exists conversations_member_update on public.conversations;
create policy conversations_member_update on public.conversations for update to authenticated using (public.linuxaid_is_conversation_member(id,(select auth.uid()))) with check (public.linuxaid_is_conversation_member(id,(select auth.uid())));

-- conversation_members uses the SECURITY DEFINER helper to avoid recursive RLS checks.
drop policy if exists conversation_members_member_read on public.conversation_members;
create policy conversation_members_member_read on public.conversation_members for select to authenticated using (public.linuxaid_is_conversation_member(conversation_id,(select auth.uid())));
drop policy if exists conversation_members_own_update on public.conversation_members;
create policy conversation_members_own_update on public.conversation_members for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));

-- Direct inserts into conversations/member rows are intentionally not exposed to clients;
-- linuxaid_start_direct_conversation() creates them through a controlled RPC.

drop policy if exists messages_member_read on public.messages;
create policy messages_member_read on public.messages for select to authenticated using (public.linuxaid_is_conversation_member(conversation_id,(select auth.uid())));
drop policy if exists messages_member_insert on public.messages;
create policy messages_member_insert on public.messages for insert to authenticated with check (sender_id=(select auth.uid()) and public.linuxaid_is_conversation_member(conversation_id,(select auth.uid())));
drop policy if exists messages_sender_update on public.messages;
create policy messages_sender_update on public.messages for update to authenticated using (sender_id=(select auth.uid())) with check (sender_id=(select auth.uid()));

-- Lock down helper execution to signed-in users where relevant.
revoke all on function public.linuxaid_start_direct_conversation(uuid) from public;
revoke all on function public.linuxaid_mark_conversation_read(uuid) from public;
grant execute on function public.linuxaid_start_direct_conversation(uuid) to authenticated;
grant execute on function public.linuxaid_mark_conversation_read(uuid) to authenticated;

grant execute on function public.linuxaid_is_conversation_member(uuid,uuid) to authenticated;
