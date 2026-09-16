-- Run once in the Supabase SQL Editor. Avatars are private, not public profiles.
begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp']);

create policy "Read own avatar" on storage.objects for select to authenticated
using (bucket_id = 'avatars' and name = (select auth.uid())::text || '/avatar');

create policy "Upload own avatar" on storage.objects for insert to authenticated
with check (bucket_id = 'avatars' and name = (select auth.uid())::text || '/avatar');

create policy "Replace own avatar" on storage.objects for update to authenticated
using (bucket_id = 'avatars' and name = (select auth.uid())::text || '/avatar')
with check (bucket_id = 'avatars' and name = (select auth.uid())::text || '/avatar');

create policy "Delete own avatar" on storage.objects for delete to authenticated
using (bucket_id = 'avatars' and name = (select auth.uid())::text || '/avatar');

commit;
