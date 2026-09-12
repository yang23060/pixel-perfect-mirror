
-- avatars: path is <user_id>/<file>
create policy "avatars read" on storage.objects for select to authenticated
using (bucket_id = 'avatars' and (
  (storage.foldername(name))[1] = auth.uid()::text
  or public.shares_family_with(((storage.foldername(name))[1])::uuid)
));
create policy "avatars insert" on storage.objects for insert to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars update" on storage.objects for update to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars delete" on storage.objects for delete to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- family-media: path is <family_id>/<...>
create policy "family media read" on storage.objects for select to authenticated
using (bucket_id = 'family-media' and public.is_family_member(((storage.foldername(name))[1])::uuid));
create policy "family media insert" on storage.objects for insert to authenticated
with check (bucket_id = 'family-media' and public.is_family_member(((storage.foldername(name))[1])::uuid) and owner = auth.uid());
create policy "family media update" on storage.objects for update to authenticated
using (bucket_id = 'family-media' and owner = auth.uid());
create policy "family media delete" on storage.objects for delete to authenticated
using (bucket_id = 'family-media' and (owner = auth.uid() or public.is_family_admin(((storage.foldername(name))[1])::uuid)));
