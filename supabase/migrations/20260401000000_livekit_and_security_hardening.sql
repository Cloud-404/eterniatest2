-- Migration: 20260401000000_livekit_and_security_hardening.sql
-- Description: Hardens credit ledger against direct user fabrication, makes refunds and L3 claims atomic,
-- restricts session table RLS, and supports canonical LiveKit room lifecycles.

-- ============================================================================
-- 1. CREDIT LEDGER HARDENING (F14)
-- ============================================================================

-- Drop the dangerous self-insert policy that was reintroduced in migration 20260322073805
DROP POLICY IF EXISTS "Users can insert own credit transactions" ON public.credit_transactions;
DROP POLICY IF EXISTS "System can insert credit transactions" ON public.credit_transactions;

-- Ensure RLS is active
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- Allow users to view ONLY their own credit transactions (or admins to view all)
DROP POLICY IF EXISTS "Users can view own credit transactions" ON public.credit_transactions;
CREATE POLICY "Users can view own credit transactions"
ON public.credit_transactions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Direct INSERTs from authenticated clients are strictly blocked.
-- Only SECURITY DEFINER functions or service-role clients can insert transactions.

-- 1.1 Atomic RPC for student earning credits from wellness activities
CREATE OR REPLACE FUNCTION public.earn_credits_activity(
  _amount integer,
  _activity text
)
RETURNS TABLE(success boolean, earned integer, weekly_total integer, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _weekly_earned integer := 0;
  _weekly_cap integer := 5;
  _actual_grant integer;
BEGIN
  IF _user_id IS NULL THEN
    RETURN QUERY SELECT false, 0, 0, 'Not authenticated'::text;
    RETURN;
  END IF;

  IF _amount IS NULL OR _amount <= 0 OR _amount > 5 THEN
    RETURN QUERY SELECT false, 0, 0, 'Invalid earn amount (1-5 ECC)'::text;
    RETURN;
  END IF;

  -- Lock user's transactions to prevent concurrency race on weekly cap
  PERFORM 1 FROM credit_transactions WHERE user_id = _user_id FOR UPDATE;

  -- Calculate earned in current week (starting Monday)
  SELECT COALESCE(SUM(delta), 0)::integer INTO _weekly_earned
  FROM credit_transactions
  WHERE user_id = _user_id
    AND type = 'earn'
    AND created_at >= date_trunc('week', now());

  IF _weekly_earned >= _weekly_cap THEN
    RETURN QUERY SELECT false, 0, _weekly_earned, 'Weekly earn cap of 5 ECC reached'::text;
    RETURN;
  END IF;

  _actual_grant := LEAST(_amount, _weekly_cap - _weekly_earned);

  INSERT INTO credit_transactions (user_id, delta, type, notes)
  VALUES (_user_id, _actual_grant, 'earn', COALESCE(_activity, 'Wellness activity'));

  RETURN QUERY SELECT true, _actual_grant, (_weekly_earned + _actual_grant)::integer, 'Credits earned successfully'::text;
END;
$$;

-- 1.2 Atomic RPC for completing quests and granting rewards
CREATE OR REPLACE FUNCTION public.earn_quest_reward(
  _quest_id uuid,
  _answer text DEFAULT NULL
)
RETURNS TABLE(success boolean, reward integer, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _quest record;
  _already_done boolean;
  _actual_reward integer;
BEGIN
  IF _user_id IS NULL THEN
    RETURN QUERY SELECT false, 0, 'Not authenticated'::text;
    RETURN;
  END IF;

  SELECT * INTO _quest FROM quests WHERE id = _quest_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 'Quest not found or inactive'::text;
    RETURN;
  END IF;

  -- Check if already completed
  SELECT EXISTS(
    SELECT 1 FROM quest_completions WHERE user_id = _user_id AND quest_id = _quest_id
  ) INTO _already_done;

  IF _already_done THEN
    RETURN QUERY SELECT false, 0, 'Quest already completed'::text;
    RETURN;
  END IF;

  -- Record completion
  INSERT INTO quest_completions (user_id, quest_id, answer)
  VALUES (_user_id, _quest_id, _answer);

  _actual_reward := COALESCE(_quest.xp_reward, 0);

  IF _actual_reward > 0 THEN
    INSERT INTO credit_transactions (user_id, delta, type, notes, reference_id)
    VALUES (_user_id, _actual_reward, 'earn', 'Quest completed: ' || _quest.title, _quest_id);
  END IF;

  RETURN QUERY SELECT true, _actual_reward, 'Quest completed successfully'::text;
END;
$$;

-- 1.3 Atomic RPC for cancelling appointments with legitimate refund
CREATE OR REPLACE FUNCTION public.cancel_appointment_with_refund(
  _appointment_id uuid
)
RETURNS TABLE(success boolean, refund_amount integer, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _appt record;
  _spend_delta integer;
  _refunded boolean;
BEGIN
  IF _user_id IS NULL THEN
    RETURN QUERY SELECT false, 0, 'Not authenticated'::text;
    RETURN;
  END IF;

  SELECT * INTO _appt FROM appointments WHERE id = _appointment_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 'Appointment not found'::text;
    RETURN;
  END IF;

  IF _appt.student_id != _user_id AND _appt.expert_id != _user_id AND NOT public.has_role(_user_id, 'admin') THEN
    RETURN QUERY SELECT false, 0, 'Not authorized to cancel this appointment'::text;
    RETURN;
  END IF;

  IF _appt.status IN ('completed', 'cancelled') THEN
    RETURN QUERY SELECT false, 0, 'Appointment is already ' || _appt.status::text;
    RETURN;
  END IF;

  -- Update appointment status to cancelled
  UPDATE appointments SET status = 'cancelled' WHERE id = _appointment_id;

  -- Check if spend transaction exists
  SELECT ABS(delta) INTO _spend_delta
  FROM credit_transactions
  WHERE reference_id = _appointment_id AND type = 'spend'
  ORDER BY created_at DESC LIMIT 1;

  IF _spend_delta IS NOT NULL AND _spend_delta > 0 THEN
    -- Check if refund was already given
    SELECT EXISTS(
      SELECT 1 FROM credit_transactions WHERE reference_id = _appointment_id AND type = 'grant'
    ) INTO _refunded;

    IF NOT _refunded THEN
      INSERT INTO credit_transactions (user_id, delta, type, notes, reference_id)
      VALUES (_appt.student_id, _spend_delta, 'grant', 'Expert Connect appointment cancelled — refund', _appointment_id);
      RETURN QUERY SELECT true, _spend_delta, 'Appointment cancelled and refunded'::text;
      RETURN;
    END IF;
  END IF;

  RETURN QUERY SELECT true, 0, 'Appointment cancelled (no refund needed)'::text;
END;
$$;

-- 1.4 Atomic RPC for cancelling blackbox session with legitimate refund
CREATE OR REPLACE FUNCTION public.cancel_blackbox_with_refund(
  _session_id uuid
)
RETURNS TABLE(success boolean, refund_amount integer, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _sess record;
  _spend_delta integer;
  _refunded boolean;
BEGIN
  IF _user_id IS NULL THEN
    RETURN QUERY SELECT false, 0, 'Not authenticated'::text;
    RETURN;
  END IF;

  SELECT * INTO _sess FROM blackbox_sessions WHERE id = _session_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 'Session not found'::text;
    RETURN;
  END IF;

  IF _sess.student_id != _user_id AND NOT public.has_role(_user_id, 'admin') THEN
    RETURN QUERY SELECT false, 0, 'Only the student can cancel their session'::text;
    RETURN;
  END IF;

  IF _sess.status IN ('completed', 'cancelled') THEN
    RETURN QUERY SELECT false, 0, 'Session already ' || _sess.status::text;
    RETURN;
  END IF;

  -- Update session to cancelled
  UPDATE blackbox_sessions
  SET status = 'cancelled', ended_at = now()
  WHERE id = _session_id;

  -- Refund only if student NEVER joined
  IF _sess.student_joined_at IS NULL THEN
    SELECT ABS(delta) INTO _spend_delta
    FROM credit_transactions
    WHERE reference_id = _session_id AND type = 'spend'
    ORDER BY created_at DESC LIMIT 1;

    IF _spend_delta IS NOT NULL AND _spend_delta > 0 THEN
      SELECT EXISTS(
        SELECT 1 FROM credit_transactions WHERE reference_id = _session_id AND type = 'grant'
      ) INTO _refunded;

      IF NOT _refunded THEN
        INSERT INTO credit_transactions (user_id, delta, type, notes, reference_id)
        VALUES (_user_id, _spend_delta, 'grant', 'BlackBox session cancelled — refund', _session_id);
        RETURN QUERY SELECT true, _spend_delta, 'Session cancelled and refunded'::text;
        RETURN;
      END IF;
    END IF;
  END IF;

  RETURN QUERY SELECT true, 0, 'Session cancelled'::text;
END;
$$;


-- ============================================================================
-- 2. ATOMIC BLACKBOX REFUND RPC FOR THERAPISTS (F15 & F16)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.refund_blackbox_session_atomic(
  _session_id uuid,
  _caller_id uuid,
  _reason text DEFAULT 'User unresponsive'
)
RETURNS TABLE(success boolean, refund_amount integer, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _sess record;
  _spend_delta integer := 0;
  _already_refunded boolean := false;
BEGIN
  -- Verify caller has therapist role
  IF NOT public.has_role(_caller_id, 'therapist') AND NOT public.has_role(_caller_id, 'admin') THEN
    RETURN QUERY SELECT false, 0, 'Caller does not possess therapist role'::text;
    RETURN;
  END IF;

  -- Lock session row atomically
  SELECT * INTO _sess FROM blackbox_sessions WHERE id = _session_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 'Session not found'::text;
    RETURN;
  END IF;

  -- Verify assigned therapist ownership
  IF _sess.therapist_id != _caller_id AND NOT public.has_role(_caller_id, 'admin') THEN
    RETURN QUERY SELECT false, 0, 'Only the assigned therapist can issue a refund'::text;
    RETURN;
  END IF;

  -- Idempotency check
  IF _sess.refunded IS TRUE THEN
    RETURN QUERY SELECT false, 0, 'Session has already been refunded'::text;
    RETURN;
  END IF;

  -- Eligibility: student must NOT have joined
  IF _sess.student_joined_at IS NOT NULL THEN
    RETURN QUERY SELECT false, 0, 'Student already joined — not eligible for refund'::text;
    RETURN;
  END IF;

  -- Check spend amount
  SELECT ABS(delta) INTO _spend_delta
  FROM credit_transactions
  WHERE reference_id = _session_id AND type = 'spend'
  ORDER BY created_at DESC LIMIT 1;

  _spend_delta := COALESCE(_spend_delta, 0);

  -- Double-check credit ledger for existing refund grant
  SELECT EXISTS(
    SELECT 1 FROM credit_transactions WHERE reference_id = _session_id AND type = 'grant'
  ) INTO _already_refunded;

  IF _already_refunded THEN
    -- Mark session as refunded to align state without double-crediting
    UPDATE blackbox_sessions
    SET refunded = true, status = 'completed', ended_at = now(),
        escalation_reason = COALESCE(_reason, 'Auto-ended: inactivity')
    WHERE id = _session_id;

    RETURN QUERY SELECT true, 0, 'Session marked refunded (credit was already granted)'::text;
    RETURN;
  END IF;

  -- Insert refund credit if spent
  IF _spend_delta > 0 THEN
    INSERT INTO credit_transactions (user_id, delta, type, notes, reference_id)
    VALUES (_sess.student_id, _spend_delta, 'grant', 'BlackBox session refund: ' || COALESCE(_reason, 'Inactivity refund'), _session_id);
  END IF;

  -- Atomically mark refunded and completed
  UPDATE blackbox_sessions
  SET refunded = true,
      status = 'completed',
      ended_at = now(),
      escalation_reason = COALESCE(_reason, 'Auto-ended: inactivity — refunded')
  WHERE id = _session_id;

  -- Insert audit log
  INSERT INTO audit_logs (actor_id, action_type, target_table, target_id, metadata)
  VALUES (
    _caller_id,
    'session_refund',
    'blackbox_sessions',
    _session_id::text,
    jsonb_build_object(
      'student_id', _sess.student_id,
      'refund_amount', _spend_delta,
      'reason', _reason
    )
  );

  RETURN QUERY SELECT true, _spend_delta, 'Session refunded successfully'::text;
END;
$$;


-- ============================================================================
-- 3. ATOMIC L3 CLAIM RPC (F5)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.claim_l3_session_atomic(
  _session_id uuid,
  _expert_id uuid
)
RETURNS TABLE(success boolean, already_claimed boolean, claimed_by uuid, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _sess record;
  _history jsonb;
  _entry jsonb;
  _existing_claimer uuid := NULL;
  _now text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
BEGIN
  -- Verify caller has expert role
  IF NOT public.has_role(_expert_id, 'expert') AND NOT public.has_role(_expert_id, 'admin') THEN
    RETURN QUERY SELECT false, false, NULL::uuid, 'Caller does not possess expert role'::text;
    RETURN;
  END IF;

  -- Lock session row atomically
  SELECT * INTO _sess FROM blackbox_sessions WHERE id = _session_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, false, NULL::uuid, 'Session not found'::text;
    RETURN;
  END IF;

  -- Verify L3 criteria
  IF COALESCE(_sess.flag_level, 0) < 3 THEN
    RETURN QUERY SELECT false, false, NULL::uuid, 'Session does not meet L3 severity threshold'::text;
    RETURN;
  END IF;

  -- Only non-terminal sessions can be claimed
  IF _sess.status IN ('completed', 'cancelled') THEN
    RETURN QUERY SELECT false, false, NULL::uuid, 'Session is already ' || _sess.status::text;
    RETURN;
  END IF;

  _history := COALESCE(to_jsonb(_sess.escalation_history), '[]'::jsonb);
  IF jsonb_typeof(_history) != 'array' THEN
    _history := '[]'::jsonb;
  END IF;

  -- Inspect history for existing expert claim
  FOR _entry IN SELECT * FROM jsonb_array_elements(_history)
  LOOP
    IF _entry->>'type' = 'expert_claimed' AND _entry->>'expert_id' IS NOT NULL THEN
      _existing_claimer := (_entry->>'expert_id')::uuid;
      EXIT;
    END IF;
  END LOOP;

  IF _existing_claimer IS NOT NULL THEN
    IF _existing_claimer = _expert_id THEN
      -- Already claimed by this expert -> idempotent success
      RETURN QUERY SELECT true, true, _existing_claimer, 'Session is already claimed by you'::text;
      RETURN;
    ELSE
      -- Claimed by a different expert -> reject
      RETURN QUERY SELECT false, true, _existing_claimer, 'Session has already been claimed by another expert'::text;
      RETURN;
    END IF;
  END IF;

  -- Atomically append claim entries to escalation history
  _history := _history || jsonb_build_array(
    jsonb_build_object('type', 'expert_joined', 'expert_id', _expert_id, 'timestamp', _now),
    jsonb_build_object('type', 'expert_claimed', 'expert_id', _expert_id, 'timestamp', _now)
  );

  UPDATE blackbox_sessions
  SET status = 'active',
      escalation_history = _history
  WHERE id = _session_id;

  -- Notify the therapist if assigned
  IF _sess.therapist_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, message, metadata)
    VALUES (
      _sess.therapist_id,
      'expert_joined',
      'Crisis Specialist Joined',
      'An L3 Crisis Specialist has joined your session to provide support.',
      jsonb_build_object('session_id', _session_id, 'expert_id', _expert_id)
    );
  END IF;

  RETURN QUERY SELECT true, false, _expert_id, 'Session claimed successfully'::text;
END;
$$;


-- ============================================================================
-- 4. SESSION TABLE RLS REFINEMENTS (F3 & F6)
-- ============================================================================

-- Ensure students cannot overwrite therapist_id, flag_level, or forge 'accepted' status on blackbox_sessions
CREATE OR REPLACE FUNCTION public.validate_blackbox_session_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- If update is by a regular student (and not a therapist, expert, or admin)
  IF public.has_role(auth.uid(), 'student')
     AND NOT public.has_role(auth.uid(), 'therapist')
     AND NOT public.has_role(auth.uid(), 'expert')
     AND NOT public.has_role(auth.uid(), 'admin') THEN

    -- Student cannot change therapist_id
    IF OLD.therapist_id IS DISTINCT FROM NEW.therapist_id THEN
      RAISE EXCEPTION 'Students cannot modify therapist assignment';
    END IF;

    -- Student cannot alter flag_level
    IF OLD.flag_level IS DISTINCT FROM NEW.flag_level THEN
      RAISE EXCEPTION 'Students cannot modify safety flag level';
    END IF;

    -- Student cannot mark session accepted or active directly
    IF NEW.status IN ('accepted', 'active') AND OLD.status NOT IN ('accepted', 'active') THEN
      RAISE EXCEPTION 'Students cannot transition session to accepted or active';
    END IF;

    -- Student cannot alter room_id once assigned
    IF OLD.room_id IS NOT NULL AND NEW.room_id IS DISTINCT FROM OLD.room_id THEN
      RAISE EXCEPTION 'Cannot modify established session room identifier';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_blackbox_update ON public.blackbox_sessions;
CREATE TRIGGER trg_validate_blackbox_update
BEFORE UPDATE ON public.blackbox_sessions
FOR EACH ROW
EXECUTE FUNCTION public.validate_blackbox_session_update();
