-- Storage RLS policies for post_media bucket
-- Allow authenticated users to upload
CREATE POLICY "Authenticated uploads to post_media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'post_media');

-- Allow anyone to read from post_media (public bucket)
CREATE POLICY "Public read access to post_media"
ON storage.objects
FOR SELECT
USING (bucket_id = 'post_media');

-- Allow authenticated users to delete their own uploads
CREATE POLICY "Authenticated delete own uploads"
ON storage.objects
FOR DELETE
USING (bucket_id = 'post_media' AND auth.uid() = owner);

-- Also add policies for avatars, covers, posts buckets
CREATE POLICY "Authenticated uploads to avatars"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Public read access to avatars"
ON storage.objects
FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Authenticated uploads to covers"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'covers');

CREATE POLICY "Public read access to covers"
ON storage.objects
FOR SELECT
USING (bucket_id = 'covers');

CREATE POLICY "Authenticated uploads to posts"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'posts');

CREATE POLICY "Public read access to posts"
ON storage.objects
FOR SELECT
USING (bucket_id = 'posts');
