-- Add deletion_requested_at column for 30-day grace period
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deletion_requested_at timestamptz DEFAULT NULL;

-- Allow interns to create escalation requests for peer sessions
CREATE POLICY "Interns can create escalation requests" ON public.escalation_requests
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'intern'::app_role));