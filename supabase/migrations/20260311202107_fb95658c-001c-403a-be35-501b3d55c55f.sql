-- Admin RLS policies
CREATE POLICY "Admins can view all appointments"
ON public.appointments FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all peer sessions"
ON public.peer_sessions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all blackbox entries"
ON public.blackbox_entries FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all blackbox sessions"
ON public.blackbox_sessions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Atomic play_count increment function
CREATE OR REPLACE FUNCTION public.increment_play_count(_track_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE public.sound_content
  SET play_count = COALESCE(play_count, 0) + 1
  WHERE id = _track_id;
$$;
