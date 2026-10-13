-- Drop the restrictive policy and recreate as permissive
DROP POLICY IF EXISTS "Users can manage own recovery credentials" ON public.recovery_credentials;

CREATE POLICY "Users can manage own recovery credentials"
ON public.recovery_credentials
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);