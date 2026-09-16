-- Restrict SECURITY DEFINER helpers to only the roles that actually need them.
revoke all on function public.apply_linuxaid_author_name() from public, anon, authenticated;
revoke all on function public.handle_new_linuxaid_user() from public, anon, authenticated;
revoke all on function public.protect_linuxaid_role() from public, anon, authenticated;
revoke all on function public.refresh_linuxaid_reply_count() from public, anon, authenticated;
revoke all on function public.refresh_linuxaid_vote_count() from public, anon, authenticated;

-- RLS policies need this helper for signed-in users, but anonymous clients do not.
revoke all on function public.is_linuxaid_admin(uuid) from public, anon;
grant execute on function public.is_linuxaid_admin(uuid) to authenticated;

-- Service-role quota RPC is intentionally inaccessible to browser roles.
revoke all on function public.consume_linuxaid_ai_quota(uuid, integer) from public, anon, authenticated;
grant execute on function public.consume_linuxaid_ai_quota(uuid, integer) to service_role;
