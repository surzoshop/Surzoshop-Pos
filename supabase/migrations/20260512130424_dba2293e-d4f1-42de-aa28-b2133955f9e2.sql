
-- Make kyc-docs bucket public so customer photos & NID images can be displayed via getPublicUrl
UPDATE storage.buckets SET public = true WHERE id = 'kyc-docs';

-- Drop old restrictive policies that required shop-uuid folder structure
DROP POLICY IF EXISTS "Shop upload kyc" ON storage.objects;
DROP POLICY IF EXISTS "Shop read kyc" ON storage.objects;
DROP POLICY IF EXISTS "Admin delete kyc" ON storage.objects;

-- New policies: any authenticated user in the system can upload/read/update/delete kyc-docs files
CREATE POLICY "Authenticated upload kyc"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'kyc-docs');

CREATE POLICY "Public read kyc"
ON storage.objects FOR SELECT
USING (bucket_id = 'kyc-docs');

CREATE POLICY "Authenticated update kyc"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'kyc-docs');

CREATE POLICY "Authenticated delete kyc"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'kyc-docs');
