-- Allow admins/spocs to manage sound_content
CREATE POLICY "Admins can insert sound content"
ON public.sound_content
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'spoc'));

CREATE POLICY "Admins can update sound content"
ON public.sound_content
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'spoc'));

CREATE POLICY "Admins can delete sound content"
ON public.sound_content
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'spoc'));