CREATE TABLE public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  session_hash text NOT NULL,
  event_type text NOT NULL DEFAULT 'page_view',
  page_path text NOT NULL,
  referrer text,
  user_agent text,
  screen_size text,
  country text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_analytics_events_created ON public.analytics_events(created_at DESC);
CREATE INDEX idx_analytics_events_page ON public.analytics_events(page_path, created_at DESC);
CREATE INDEX idx_analytics_events_session ON public.analytics_events(session_hash);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view analytics"
ON public.analytics_events FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert analytics events"
ON public.analytics_events FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Anon can insert analytics events"
ON public.analytics_events FOR INSERT TO anon
WITH CHECK (user_id IS NULL);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cookie_consent text NOT NULL DEFAULT 'pending';