-- 1. Prevent self-granting family admin rights
drop policy if exists "members self insert" on public.family_members;
create policy "members self insert"
on public.family_members
for insert
to authenticated
with check (
  public.is_family_admin(family_id)
  or (user_id = auth.uid() and role <> 'admin'::family_role)
);

-- 2. Prevent non-admins from changing their own suspension state
create or replace function public.guard_profile_suspension()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.suspended_at is distinct from old.suspended_at
      or new.suspended_reason is distinct from old.suspended_reason)
     and not exists (
       select 1 from public.user_roles r
       where r.user_id = auth.uid() and r.role = 'platform_admin'
     )
  then
    new.suspended_at := old.suspended_at;
    new.suspended_reason := old.suspended_reason;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_profile_suspension() from public, anon, authenticated;

drop trigger if exists profiles_guard_suspension on public.profiles;
create trigger profiles_guard_suspension
before update on public.profiles
for each row execute function public.guard_profile_suspension();