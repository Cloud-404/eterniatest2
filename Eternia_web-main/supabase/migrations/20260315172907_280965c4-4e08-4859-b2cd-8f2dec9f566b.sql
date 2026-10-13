-- Allow admins to insert credit_transactions for any user (for credit grants)
CREATE POLICY "Admins can insert credit transactions"
ON public.credit_transactions
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'spoc'::app_role)
);

-- Allow admins to view all credit transactions
CREATE POLICY "Admins can view all credit transactions"
ON public.credit_transactions
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'spoc'::app_role)
);