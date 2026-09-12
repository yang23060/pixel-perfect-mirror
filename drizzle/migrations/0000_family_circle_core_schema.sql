
-- ============ enums ============
create type public.family_role as enum ('admin','adult','child');
create type public.post_type as enum ('update','celebration','question','announcement','appreciation','memory');
create type public.event_category as enum ('birthday','gathering','appointment','school','travel','anniversary','reminder','other');
create type public.rsvp_status as enum ('going','maybe','cannot');
create type public.checkin_status as enum ('great','good','okay','tired','need_support');

-- ============ profiles ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  birthday date,
  anniversary date,
  bio text,
  favorite_things text,
  timezone text default 'UTC',
  contact_email text,
  contact_phone text,
  share_contact boolean not null default false,
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

-- ============ families / members ============
create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cover_url text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.families to authenticated;
grant all on public.families to service_role;
alter table public.families enable row level security;

create table public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.family_role not null default 'adult',
  relationship text,
  joined_at timestamptz not null default now(),
  unique (family_id, user_id)
);
create index on public.family_members (user_id);
create index on public.family_members (family_id);
grant select, insert, update, delete on public.family_members to authenticated;
grant all on public.family_members to service_role;
alter table public.family_members enable row level security;

-- ============ helper functions ============
create or replace function public.is_family_member(_family uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.family_members m where m.family_id = _family and m.user_id = auth.uid());
$$;

create or replace function public.is_family_admin(_family uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.family_members m where m.family_id = _family and m.user_id = auth.uid() and m.role = 'admin');
$$;

create or replace function public.shares_family_with(_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.family_members a
    join public.family_members b on a.family_id = b.family_id
    where a.user_id = auth.uid() and b.user_id = _user
  );
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- profiles policies
create policy "own profile read" on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_family_with(id));
create policy "own profile insert" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid());

-- families policies
create policy "families read" on public.families for select to authenticated using (public.is_family_member(id));
create policy "families insert" on public.families for insert to authenticated with check (created_by = auth.uid());
create policy "families update" on public.families for update to authenticated using (public.is_family_admin(id));
create policy "families delete" on public.families for delete to authenticated using (public.is_family_admin(id));

-- family_members policies
create policy "members read" on public.family_members for select to authenticated
  using (user_id = auth.uid() or public.is_family_member(family_id));
create policy "members self insert" on public.family_members for insert to authenticated
  with check (user_id = auth.uid() or public.is_family_admin(family_id));
create policy "members update" on public.family_members for update to authenticated
  using (public.is_family_admin(family_id));
create policy "members delete" on public.family_members for delete to authenticated
  using (user_id = auth.uid() or public.is_family_admin(family_id));

-- ============ invites ============
create table public.family_invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  code text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  role public.family_role not null default 'adult',
  expires_at timestamptz,
  active boolean not null default true,
  uses integer not null default 0,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.family_invites to authenticated;
grant all on public.family_invites to service_role;
alter table public.family_invites enable row level security;
create policy "invites read" on public.family_invites for select to authenticated using (public.is_family_member(family_id));
create policy "invites insert" on public.family_invites for insert to authenticated with check (public.is_family_admin(family_id) and created_by = auth.uid());
create policy "invites update" on public.family_invites for update to authenticated using (public.is_family_admin(family_id));
create policy "invites delete" on public.family_invites for delete to authenticated using (public.is_family_admin(family_id));

create or replace function public.create_family(_name text, _cover_url text, _relationship text)
returns uuid language plpgsql security definer set search_path = public as $$
declare fid uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into public.families (name, cover_url, created_by) values (_name, _cover_url, auth.uid()) returning id into fid;
  insert into public.family_members (family_id, user_id, role, relationship) values (fid, auth.uid(), 'admin', _relationship);
  insert into public.chats (family_id, name, is_main, created_by) values (fid, 'Family Chat', true, auth.uid());
  insert into public.family_invites (family_id, code, created_by)
  values (fid, upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)), auth.uid());
  return fid;
end; $$;

create or replace function public.join_family_with_code(_code text, _relationship text)
returns uuid language plpgsql security definer set search_path = public as $$
declare inv public.family_invites;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into inv from public.family_invites
   where upper(code) = upper(trim(_code)) and active = true
     and (expires_at is null or expires_at > now());
  if inv.id is null then raise exception 'Invalid or expired invitation code'; end if;
  insert into public.family_members (family_id, user_id, role, relationship)
  values (inv.family_id, auth.uid(), inv.role, _relationship)
  on conflict (family_id, user_id) do nothing;
  update public.family_invites set uses = uses + 1 where id = inv.id;
  return inv.family_id;
end; $$;

-- ============ posts ============
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  post_type public.post_type not null default 'update',
  mood text,
  is_highlight boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.posts (family_id, created_at desc);
grant select, insert, update, delete on public.posts to authenticated;
grant all on public.posts to service_role;
alter table public.posts enable row level security;
create policy "posts read" on public.posts for select to authenticated using (public.is_family_member(family_id));
create policy "posts insert" on public.posts for insert to authenticated with check (author_id = auth.uid() and public.is_family_member(family_id));
create policy "posts update" on public.posts for update to authenticated using (author_id = auth.uid() or public.is_family_admin(family_id));
create policy "posts delete" on public.posts for delete to authenticated using (author_id = auth.uid() or public.is_family_admin(family_id));
create trigger posts_touch before update on public.posts for each row execute function public.touch_updated_at();

create table public.post_images (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  url text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index on public.post_images (post_id);
grant select, insert, update, delete on public.post_images to authenticated;
grant all on public.post_images to service_role;
alter table public.post_images enable row level security;
create policy "post images read" on public.post_images for select to authenticated using (public.is_family_member(family_id));
create policy "post images write" on public.post_images for insert to authenticated with check (public.is_family_member(family_id));
create policy "post images delete" on public.post_images for delete to authenticated using (exists (select 1 from public.posts p where p.id = post_id and (p.author_id = auth.uid() or public.is_family_admin(p.family_id))));

create table public.post_mentions (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  primary key (post_id, user_id)
);
grant select, insert, delete on public.post_mentions to authenticated;
grant all on public.post_mentions to service_role;
alter table public.post_mentions enable row level security;
create policy "mentions read" on public.post_mentions for select to authenticated using (public.is_family_member(family_id));
create policy "mentions insert" on public.post_mentions for insert to authenticated with check (public.is_family_member(family_id));
create policy "mentions delete" on public.post_mentions for delete to authenticated using (public.is_family_member(family_id));

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.comments (post_id, created_at);
grant select, insert, update, delete on public.comments to authenticated;
grant all on public.comments to service_role;
alter table public.comments enable row level security;
create policy "comments read" on public.comments for select to authenticated using (public.is_family_member(family_id));
create policy "comments insert" on public.comments for insert to authenticated with check (author_id = auth.uid() and public.is_family_member(family_id));
create policy "comments update" on public.comments for update to authenticated using (author_id = auth.uid());
create policy "comments delete" on public.comments for delete to authenticated using (author_id = auth.uid() or public.is_family_admin(family_id));
create trigger comments_touch before update on public.comments for each row execute function public.touch_updated_at();

create table public.reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);
grant select, insert, update, delete on public.reactions to authenticated;
grant all on public.reactions to service_role;
alter table public.reactions enable row level security;
create policy "reactions read" on public.reactions for select to authenticated using (public.is_family_member(family_id));
create policy "reactions insert" on public.reactions for insert to authenticated with check (user_id = auth.uid() and public.is_family_member(family_id));
create policy "reactions update" on public.reactions for update to authenticated using (user_id = auth.uid());
create policy "reactions delete" on public.reactions for delete to authenticated using (user_id = auth.uid());

-- ============ events ============
create table public.events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  location text,
  category public.event_category not null default 'other',
  cover_url text,
  reminder_minutes integer,
  recurrence text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.events (family_id, starts_at);
grant select, insert, update, delete on public.events to authenticated;
grant all on public.events to service_role;
alter table public.events enable row level security;
create policy "events read" on public.events for select to authenticated using (public.is_family_member(family_id));
create policy "events insert" on public.events for insert to authenticated with check (created_by = auth.uid() and public.is_family_member(family_id));
create policy "events update" on public.events for update to authenticated using (created_by = auth.uid() or public.is_family_admin(family_id));
create policy "events delete" on public.events for delete to authenticated using (created_by = auth.uid() or public.is_family_admin(family_id));
create trigger events_touch before update on public.events for each row execute function public.touch_updated_at();

create table public.event_attendees (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status public.rsvp_status,
  invited boolean not null default true,
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);
grant select, insert, update, delete on public.event_attendees to authenticated;
grant all on public.event_attendees to service_role;
alter table public.event_attendees enable row level security;
create policy "attendees read" on public.event_attendees for select to authenticated using (public.is_family_member(family_id));
create policy "attendees insert" on public.event_attendees for insert to authenticated with check (public.is_family_member(family_id));
create policy "attendees update" on public.event_attendees for update to authenticated using (user_id = auth.uid() or public.is_family_admin(family_id));
create policy "attendees delete" on public.event_attendees for delete to authenticated using (user_id = auth.uid() or public.is_family_admin(family_id));

-- ============ albums / photos ============
create table public.albums (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  event_date date,
  cover_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.albums (family_id, created_at desc);
grant select, insert, update, delete on public.albums to authenticated;
grant all on public.albums to service_role;
alter table public.albums enable row level security;
create policy "albums read" on public.albums for select to authenticated using (public.is_family_member(family_id));
create policy "albums insert" on public.albums for insert to authenticated with check (created_by = auth.uid() and public.is_family_member(family_id));
create policy "albums update" on public.albums for update to authenticated using (created_by = auth.uid() or public.is_family_admin(family_id));
create policy "albums delete" on public.albums for delete to authenticated using (created_by = auth.uid() or public.is_family_admin(family_id));
create trigger albums_touch before update on public.albums for each row execute function public.touch_updated_at();

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  album_id uuid references public.albums(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  uploader_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  caption text,
  taken_at date,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.photos (album_id);
create index on public.photos (family_id, created_at desc);
grant select, insert, update, delete on public.photos to authenticated;
grant all on public.photos to service_role;
alter table public.photos enable row level security;
create policy "photos read" on public.photos for select to authenticated using (public.is_family_member(family_id));
create policy "photos insert" on public.photos for insert to authenticated with check (uploader_id = auth.uid() and public.is_family_member(family_id));
create policy "photos update" on public.photos for update to authenticated using (public.is_family_member(family_id));
create policy "photos delete" on public.photos for delete to authenticated using (uploader_id = auth.uid() or public.is_family_admin(family_id));

create table public.photo_tags (
  photo_id uuid not null references public.photos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  primary key (photo_id, user_id)
);
grant select, insert, delete on public.photo_tags to authenticated;
grant all on public.photo_tags to service_role;
alter table public.photo_tags enable row level security;
create policy "photo tags read" on public.photo_tags for select to authenticated using (public.is_family_member(family_id));
create policy "photo tags insert" on public.photo_tags for insert to authenticated with check (public.is_family_member(family_id));
create policy "photo tags delete" on public.photo_tags for delete to authenticated using (public.is_family_member(family_id));

create table public.photo_comments (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.photos(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.photo_comments to authenticated;
grant all on public.photo_comments to service_role;
alter table public.photo_comments enable row level security;
create policy "photo comments read" on public.photo_comments for select to authenticated using (public.is_family_member(family_id));
create policy "photo comments insert" on public.photo_comments for insert to authenticated with check (author_id = auth.uid() and public.is_family_member(family_id));
create policy "photo comments delete" on public.photo_comments for delete to authenticated using (author_id = auth.uid() or public.is_family_admin(family_id));

create table public.photo_reactions (
  photo_id uuid not null references public.photos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  emoji text not null default '❤️',
  primary key (photo_id, user_id)
);
grant select, insert, update, delete on public.photo_reactions to authenticated;
grant all on public.photo_reactions to service_role;
alter table public.photo_reactions enable row level security;
create policy "photo reactions read" on public.photo_reactions for select to authenticated using (public.is_family_member(family_id));
create policy "photo reactions insert" on public.photo_reactions for insert to authenticated with check (user_id = auth.uid() and public.is_family_member(family_id));
create policy "photo reactions delete" on public.photo_reactions for delete to authenticated using (user_id = auth.uid());

-- ============ chats ============
create table public.chats (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null,
  is_main boolean not null default false,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index on public.chats (family_id);
grant select, insert, update, delete on public.chats to authenticated;
grant all on public.chats to service_role;
alter table public.chats enable row level security;
create policy "chats read" on public.chats for select to authenticated using (public.is_family_member(family_id));
create policy "chats insert" on public.chats for insert to authenticated with check (created_by = auth.uid() and public.is_family_member(family_id));
create policy "chats update" on public.chats for update to authenticated using (created_by = auth.uid() or public.is_family_admin(family_id));
create policy "chats delete" on public.chats for delete to authenticated using (created_by = auth.uid() or public.is_family_admin(family_id));

create table public.chat_members (
  chat_id uuid not null references public.chats(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (chat_id, user_id)
);
grant select, insert, update, delete on public.chat_members to authenticated;
grant all on public.chat_members to service_role;
alter table public.chat_members enable row level security;
create policy "chat members read" on public.chat_members for select to authenticated using (public.is_family_member(family_id));
create policy "chat members insert" on public.chat_members for insert to authenticated with check (public.is_family_member(family_id));
create policy "chat members update" on public.chat_members for update to authenticated using (user_id = auth.uid());
create policy "chat members delete" on public.chat_members for delete to authenticated using (user_id = auth.uid() or public.is_family_admin(family_id));

create or replace function public.can_read_chat(_chat uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.chats c
    where c.id = _chat
      and exists (select 1 from public.family_members m where m.family_id = c.family_id and m.user_id = auth.uid())
      and (c.is_main or not exists (select 1 from public.chat_members cm where cm.chat_id = c.id)
           or exists (select 1 from public.chat_members cm where cm.chat_id = c.id and cm.user_id = auth.uid()))
  );
$$;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  content text,
  image_url text,
  reply_to uuid references public.messages(id) on delete set null,
  edited_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.messages (chat_id, created_at);
grant select, insert, update, delete on public.messages to authenticated;
grant all on public.messages to service_role;
alter table public.messages enable row level security;
create policy "messages read" on public.messages for select to authenticated using (public.can_read_chat(chat_id));
create policy "messages insert" on public.messages for insert to authenticated with check (sender_id = auth.uid() and public.can_read_chat(chat_id));
create policy "messages update" on public.messages for update to authenticated using (sender_id = auth.uid());
create policy "messages delete" on public.messages for delete to authenticated using (sender_id = auth.uid() or public.is_family_admin(family_id));

create table public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  emoji text not null,
  primary key (message_id, user_id, emoji)
);
grant select, insert, delete on public.message_reactions to authenticated;
grant all on public.message_reactions to service_role;
alter table public.message_reactions enable row level security;
create policy "message reactions read" on public.message_reactions for select to authenticated using (public.is_family_member(family_id));
create policy "message reactions insert" on public.message_reactions for insert to authenticated with check (user_id = auth.uid() and public.is_family_member(family_id));
create policy "message reactions delete" on public.message_reactions for delete to authenticated using (user_id = auth.uid());

-- ============ polls ============
create table public.polls (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  question text not null,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.polls to authenticated;
grant all on public.polls to service_role;
alter table public.polls enable row level security;
create policy "polls read" on public.polls for select to authenticated using (public.is_family_member(family_id));
create policy "polls insert" on public.polls for insert to authenticated with check (created_by = auth.uid() and public.is_family_member(family_id));
create policy "polls update" on public.polls for update to authenticated using (created_by = auth.uid() or public.is_family_admin(family_id));
create policy "polls delete" on public.polls for delete to authenticated using (created_by = auth.uid() or public.is_family_admin(family_id));

create table public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  label text not null,
  position integer not null default 0
);
grant select, insert, update, delete on public.poll_options to authenticated;
grant all on public.poll_options to service_role;
alter table public.poll_options enable row level security;
create policy "poll options read" on public.poll_options for select to authenticated using (public.is_family_member(family_id));
create policy "poll options insert" on public.poll_options for insert to authenticated with check (public.is_family_member(family_id));
create policy "poll options delete" on public.poll_options for delete to authenticated using (public.is_family_member(family_id));

create table public.poll_votes (
  poll_id uuid not null references public.polls(id) on delete cascade,
  option_id uuid not null references public.poll_options(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);
grant select, insert, update, delete on public.poll_votes to authenticated;
grant all on public.poll_votes to service_role;
alter table public.poll_votes enable row level security;
create policy "poll votes read" on public.poll_votes for select to authenticated using (public.is_family_member(family_id));
create policy "poll votes insert" on public.poll_votes for insert to authenticated with check (user_id = auth.uid() and public.is_family_member(family_id));
create policy "poll votes update" on public.poll_votes for update to authenticated using (user_id = auth.uid());
create policy "poll votes delete" on public.poll_votes for delete to authenticated using (user_id = auth.uid());

-- ============ appreciations / check-ins ============
create table public.appreciations (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  to_user_id uuid references auth.users(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.appreciations to authenticated;
grant all on public.appreciations to service_role;
alter table public.appreciations enable row level security;
create policy "appreciations read" on public.appreciations for select to authenticated using (public.is_family_member(family_id));
create policy "appreciations insert" on public.appreciations for insert to authenticated with check (author_id = auth.uid() and public.is_family_member(family_id));
create policy "appreciations delete" on public.appreciations for delete to authenticated using (author_id = auth.uid() or public.is_family_admin(family_id));

create table public.check_ins (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status public.checkin_status not null,
  note text,
  created_at timestamptz not null default now()
);
create index on public.check_ins (family_id, created_at desc);
grant select, insert, update, delete on public.check_ins to authenticated;
grant all on public.check_ins to service_role;
alter table public.check_ins enable row level security;
create policy "checkins read" on public.check_ins for select to authenticated using (public.is_family_member(family_id));
create policy "checkins insert" on public.check_ins for insert to authenticated with check (user_id = auth.uid() and public.is_family_member(family_id));
create policy "checkins delete" on public.check_ins for delete to authenticated using (user_id = auth.uid());

-- ============ notifications ============
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  type text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications (user_id, created_at desc);
grant select, insert, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "notifications read" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "notifications insert" on public.notifications for insert to authenticated with check (family_id is null or public.is_family_member(family_id));
create policy "notifications update" on public.notifications for update to authenticated using (user_id = auth.uid());
create policy "notifications delete" on public.notifications for delete to authenticated using (user_id = auth.uid());

create table public.notification_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  comments boolean not null default true,
  reactions boolean not null default true,
  mentions boolean not null default true,
  events boolean not null default true,
  birthdays boolean not null default true,
  albums boolean not null default true,
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.notification_prefs to authenticated;
grant all on public.notification_prefs to service_role;
alter table public.notification_prefs enable row level security;
create policy "prefs all" on public.notification_prefs for select to authenticated using (user_id = auth.uid());
create policy "prefs insert" on public.notification_prefs for insert to authenticated with check (user_id = auth.uid());
create policy "prefs update" on public.notification_prefs for update to authenticated using (user_id = auth.uid());

-- realtime
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.posts;
alter publication supabase_realtime add table public.comments;
alter publication supabase_realtime add table public.reactions;
