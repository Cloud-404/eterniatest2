CREATE POLICY "Users can insert own credit transactions"
ON public.credit_transactions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);