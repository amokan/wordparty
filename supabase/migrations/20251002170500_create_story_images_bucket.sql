-- Create storage bucket for story images
insert into storage.buckets (id, name, public)
values ('story-images', 'story-images', true)
on conflict (id) do nothing;

-- Set up RLS policies for story images bucket
create policy "Anyone can view story images"
on storage.objects for select
using (bucket_id = 'story-images');

create policy "Service role can upload story images"
on storage.objects for insert
with check (bucket_id = 'story-images' and auth.role() = 'service_role');

create policy "Service role can update story images"
on storage.objects for update
using (bucket_id = 'story-images' and auth.role() = 'service_role');
