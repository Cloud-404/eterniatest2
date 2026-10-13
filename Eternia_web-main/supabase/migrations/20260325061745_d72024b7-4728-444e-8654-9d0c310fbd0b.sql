
-- 1. get_weekly_earn_total: sums earn transactions from Monday of current week
CREATE OR REPLACE FUNCTION public.get_weekly_earn_total(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(SUM(delta), 0)::integer
  FROM public.credit_transactions
  WHERE user_id = _user_id
    AND type = 'earn'
    AND created_at >= date_trunc('week', CURRENT_TIMESTAMP)
$$;

-- 2. get_blackbox_usage_count: total BlackBox sessions for a user (all-time)
CREATE OR REPLACE FUNCTION public.get_blackbox_usage_count(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COUNT(*)::integer
  FROM public.blackbox_sessions
  WHERE student_id = _user_id
    AND status IN ('completed', 'active', 'accepted', 'queued')
$$;

-- 3. get_blackbox_daily_count: today's BlackBox sessions
CREATE OR REPLACE FUNCTION public.get_blackbox_daily_count(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COUNT(*)::integer
  FROM public.blackbox_sessions
  WHERE student_id = _user_id
    AND created_at >= (CURRENT_DATE AT TIME ZONE 'UTC')
$$;

-- 4. Update handle_new_user: 100 → 80 ECC welcome bonus
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, role, is_verified)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8)),
    'student',
    true
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student');
  
  INSERT INTO public.credit_transactions (user_id, delta, type, notes)
  VALUES (NEW.id, 80, 'grant', 'Welcome bonus');
  
  RETURN NEW;
END;
$$;
