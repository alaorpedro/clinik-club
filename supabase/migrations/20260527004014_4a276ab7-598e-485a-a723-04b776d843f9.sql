insert into storage.buckets (id, name, public) values ('funnel-media', 'funnel-media', true) on conflict (id) do nothing;

create policy "Public read funnel-media"
on storage.objects for select
using (bucket_id = 'funnel-media');

create policy "Authenticated upload funnel-media"
on storage.objects for insert
to authenticated
with check (bucket_id = 'funnel-media' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Owner update funnel-media"
on storage.objects for update
to authenticated
using (bucket_id = 'funnel-media' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Owner delete funnel-media"
on storage.objects for delete
to authenticated
using (bucket_id = 'funnel-media' and auth.uid()::text = (storage.foldername(name))[1]);