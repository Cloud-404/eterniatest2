INSERT INTO storage.buckets (id, name, public) VALUES ('sound-files', 'sound-files', true);

CREATE POLICY "Admins can upload sound files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'sound-files' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'spoc')));

CREATE POLICY "Admins can delete sound files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'sound-files' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'spoc')));

CREATE POLICY "Anyone can view sound files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'sound-files');