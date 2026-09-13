-- Harden the SECURITY DEFINER helpers: explicit auth.uid() guards, fully
-- qualified references, fixed search_path, least-privilege EXECUTE grants.

create or replace function public.is_family_member(_family uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
     and _family is not null
     and exists (
       select 1 from public.family_members m
       where m.family_id = _family and m.user_id = auth.uid()
     );
$$;

create or replace function public.is_family_admin(_family uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
     and _family is not null
     and exists (
       select 1 from public.family_members m
       where m.family_id = _family
         and m.user_id = auth.uid()
         and m.role = 'admin'
     );
$$;

create or replace function public.shares_family_with(_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
     and _user is not null
     and exists (
       select 1
       from public.family_members a
       join public.family_members b on a.family_id = b.family_id
       where a.user_id = auth.uid() and b.user_id = _user
     );
$$;

create or replace function public.can_read_chat(_chat uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
     and _chat is not null
     and exists (
       select 1
       from public.chats c
       where c.id = _chat
         and exists (
           select 1 from public.family_members m
           where m.family_id = c.family_id and m.user_id = auth.uid()
         )
         and (
           c.is_main
           or not exists (select 1 from public.chat_members cm where cm.chat_id = c.id)
           or exists (
             select 1 from public.chat_members cm
             where cm.chat_id = c.id and cm.user_id = auth.uid()
           )
         )
     );
$$;

-- Callers may only ask about their own roles; the platform admin may ask about anyone.
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
     and _user_id is not null
     and (
       _user_id = auth.uid()
       or exists (
         select 1 from public.user_roles r
         where r.user_id = auth.uid() and r.role = 'platform_admin'
       )
     )
     and exists (
       select 1 from public.user_roles r
       where r.user_id = _user_id and r.role = _role
     );
$$;

create or replace function public.create_family(_name text, _cover_url text, _relationship text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  fid uuid;
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if coalesce(btrim(_name), '') = '' then raise exception 'family name is required'; end if;
  if exists (select 1 from public.profiles p where p.id = uid and p.suspended_at is not null) then
    raise exception 'account is suspended';
  end if;

  insert into public.families (name, cover_url, created_by)
  values (btrim(_name), _cover_url, uid)
  returning id into fid;

  insert into public.family_members (family_id, user_id, role, relationship)
  values (fid, uid, 'admin', _relationship);

  insert into public.chats (family_id, name, is_main, created_by)
  values (fid, 'Family Chat', true, uid);

  insert into public.family_invites (family_id, code, created_by)
  values (fid, upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)), uid);

  return fid;
end;
$$;

create or replace function public.join_family_with_code(_code text, _relationship text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.family_invites;
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if coalesce(btrim(_code), '') = '' then raise exception 'Invalid or expired invitation code'; end if;
  if exists (select 1 from public.profiles p where p.id = uid and p.suspended_at is not null) then
    raise exception 'account is suspended';
  end if;

  select * into inv
  from public.family_invites i
  where upper(i.code) = upper(btrim(_code))
    and i.active = true
    and (i.expires_at is null or i.expires_at > now())
  limit 1;

  if inv.id is null then raise exception 'Invalid or expired invitation code'; end if;

  insert into public.family_members (family_id, user_id, role, relationship)
  values (inv.family_id, uid, inv.role, _relationship)
  on conflict (family_id, user_id) do nothing;

  update public.family_invites set uses = uses + 1 where id = inv.id;

  return inv.family_id;
end;
$$;

-- Least privilege: nobody but the app roles below may execute these.
revoke all on function public.is_family_member(uuid) from public, anon;
revoke all on function public.is_family_admin(uuid) from public, anon;
revoke all on function public.shares_family_with(uuid) from public, anon;
revoke all on function public.can_read_chat(uuid) from public, anon;
revoke all on function public.has_role(uuid, app_role) from public, anon;
revoke all on function public.create_family(text, text, text) from public, anon;
revoke all on function public.join_family_with_code(text, text) from public, anon;

grant execute on function public.is_family_member(uuid) to authenticated, service_role;
grant execute on function public.is_family_admin(uuid) to authenticated, service_role;
grant execute on function public.shares_family_with(uuid) to authenticated, service_role;
grant execute on function public.can_read_chat(uuid) to authenticated, service_role;
grant execute on function public.has_role(uuid, app_role) to authenticated, service_role;
grant execute on function public.create_family(text, text, text) to authenticated, service_role;
grant execute on function public.join_family_with_code(text, text) to authenticated, service_role;

-- Internal-only routines stay unreachable from the app roles.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.grant_platform_creator_role() from public, anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;
