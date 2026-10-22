-- Feed-only topics and comment reactions. Server authorization remains in TypeScript.
begin;
alter table public.feed_posts drop constraint if exists feed_posts_topic_known;
alter table public.feed_posts add constraint feed_posts_topic_known check (topic in ('movement','nutrition','cleansing','breathing','meditation','focus','energy','relaxation','art','meaning','technology'));
alter table public.feed_posts drop constraint if exists feed_posts_topics_known;
alter table public.feed_posts add constraint feed_posts_topics_known check (
  cardinality(topics) between 1 and 3 and topics <@ array['movement','nutrition','cleansing','breathing','meditation','focus','energy','relaxation','art','meaning','technology']::text[]
);
create table public.feed_comment_reactions (
  comment_id uuid not null references public.feed_comments(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (emoji ~ '^[a-z0-9-]{1,32}$'),
  created_at timestamptz not null default now(),
  primary key (comment_id, auth_user_id, emoji)
);
alter table public.feed_comment_reactions enable row level security;
-- Reads go through listComments, which checks the post and comment visibility.
-- Direct user-token access is intentionally closed; service role is the API's client.
grant all on public.feed_comment_reactions to service_role;
create function public.feed_comment_reactions_limit() returns trigger language plpgsql set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.comment_id::text || ':' || new.auth_user_id::text, 0));
  if not exists (select 1 from public.feed_comment_reactions where comment_id = new.comment_id and auth_user_id = new.auth_user_id and emoji = new.emoji)
     and (select count(*) from public.feed_comment_reactions where comment_id = new.comment_id and auth_user_id = new.auth_user_id) >= 3 then
    raise exception 'feed_reaction_limit';
  end if;
  return new;
end;
$$;
create trigger feed_comment_reactions_limit before insert on public.feed_comment_reactions for each row execute function public.feed_comment_reactions_limit();
commit;
