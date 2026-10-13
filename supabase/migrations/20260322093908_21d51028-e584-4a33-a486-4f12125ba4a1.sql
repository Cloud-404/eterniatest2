CREATE POLICY "Students can view staff profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (role IN ('expert', 'therapist', 'intern'));