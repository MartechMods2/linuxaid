create index if not exists community_replies_author_idx on public.community_replies(author_id);
create index if not exists community_votes_user_idx on public.community_votes(user_id);

drop policy if exists profiles_own_read on public.profiles;
create policy profiles_own_read on public.profiles for select to authenticated using (id = (select auth.uid()) or public.is_linuxaid_admin((select auth.uid())));
drop policy if exists profiles_own_insert on public.profiles;
create policy profiles_own_insert on public.profiles for insert to authenticated with check (id = (select auth.uid()));
drop policy if exists profiles_own_update on public.profiles;
create policy profiles_own_update on public.profiles for update to authenticated using (id = (select auth.uid()) or public.is_linuxaid_admin((select auth.uid()))) with check (id = (select auth.uid()) or public.is_linuxaid_admin((select auth.uid())));

drop policy if exists learner_state_own_read on public.learner_state;
create policy learner_state_own_read on public.learner_state for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists learner_state_own_insert on public.learner_state;
create policy learner_state_own_insert on public.learner_state for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists learner_state_own_update on public.learner_state;
create policy learner_state_own_update on public.learner_state for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists community_posts_own_insert on public.community_posts;
create policy community_posts_own_insert on public.community_posts for insert to authenticated with check (author_id = (select auth.uid()));
drop policy if exists community_posts_own_update on public.community_posts;
create policy community_posts_own_update on public.community_posts for update to authenticated using (author_id = (select auth.uid()) or public.is_linuxaid_admin((select auth.uid()))) with check (author_id = (select auth.uid()) or public.is_linuxaid_admin((select auth.uid())));
drop policy if exists community_posts_own_delete on public.community_posts;
create policy community_posts_own_delete on public.community_posts for delete to authenticated using (author_id = (select auth.uid()) or public.is_linuxaid_admin((select auth.uid())));

drop policy if exists community_replies_own_insert on public.community_replies;
create policy community_replies_own_insert on public.community_replies for insert to authenticated with check (author_id = (select auth.uid()) and exists(select 1 from public.community_posts where id = post_id and not is_locked));
drop policy if exists community_replies_own_update on public.community_replies;
create policy community_replies_own_update on public.community_replies for update to authenticated using (author_id = (select auth.uid()) or public.is_linuxaid_admin((select auth.uid()))) with check (author_id = (select auth.uid()) or public.is_linuxaid_admin((select auth.uid())));
drop policy if exists community_replies_own_delete on public.community_replies;
create policy community_replies_own_delete on public.community_replies for delete to authenticated using (author_id = (select auth.uid()) or public.is_linuxaid_admin((select auth.uid())));

drop policy if exists community_votes_own_insert on public.community_votes;
create policy community_votes_own_insert on public.community_votes for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists community_votes_own_delete on public.community_votes;
create policy community_votes_own_delete on public.community_votes for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists notifications_own_read on public.notifications;
create policy notifications_own_read on public.notifications for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists notifications_own_update on public.notifications;
create policy notifications_own_update on public.notifications for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
