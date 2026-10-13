
-- Allow admins to insert institutions
CREATE POLICY "Admins can insert institutions"
ON public.institutions
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow admins to update institutions
CREATE POLICY "Admins can update institutions"
ON public.institutions
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow admins to delete institutions
CREATE POLICY "Admins can delete institutions"
ON public.institutions
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to view ALL institutions (including inactive)
CREATE POLICY "Admins can view all institutions"
ON public.institutions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
