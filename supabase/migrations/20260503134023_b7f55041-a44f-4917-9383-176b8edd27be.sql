
-- Public storage bucket for product images
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

-- Public read
create policy "Public read product-images"
on storage.objects for select
using (bucket_id = 'product-images');

-- Admin upload
create policy "Admin insert product-images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'product-images' and public.has_role(auth.uid(), 'admin'::app_role));

-- Admin update
create policy "Admin update product-images"
on storage.objects for update
to authenticated
using (bucket_id = 'product-images' and public.has_role(auth.uid(), 'admin'::app_role));

-- Admin delete
create policy "Admin delete product-images"
on storage.objects for delete
to authenticated
using (bucket_id = 'product-images' and public.has_role(auth.uid(), 'admin'::app_role));
