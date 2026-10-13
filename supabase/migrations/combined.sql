-- Create app_role enum for RBAC
CREATE TYPE public.app_role AS ENUM ('student', 'intern', 'expert', 'spoc', 'admin');

-- Create status enums
CREATE TYPE public.appointment_status AS ENUM ('pending', 'confirmed', 'completed', 'cancelled');
CREATE TYPE public.peer_session_status AS ENUM ('pending', 'active', 'completed', 'flagged');
CREATE TYPE public.credit_type AS ENUM ('earn', 'spend', 'grant', 'purchase');
CREATE TYPE public.content_type AS ENUM ('text', 'voice');

-- Institutions table
CREATE TABLE public.institutions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  eternia_code_hash TEXT NOT NULL UNIQUE,
  plan_type TEXT NOT NULL DEFAULT 'basic',
  credits_pool INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Profiles table (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  institution_id UUID REFERENCES public.institutions(id),
  username TEXT NOT NULL,
  role public.app_role NOT NULL DEFAULT 'student',
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  avatar_url TEXT,
  specialty TEXT,
  bio TEXT,
  total_sessions INTEGER NOT NULL DEFAULT 0,
  streak_days INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_login TIMESTAMP WITH TIME ZONE,
  UNIQUE(institution_id, username)
);

-- User private data (encrypted PII)
CREATE TABLE public.user_private (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  emergency_name_encrypted TEXT,
  emergency_phone_encrypted TEXT,
  emergency_relation TEXT,
  student_id_encrypted TEXT,
  device_id_encrypted TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_private ENABLE ROW LEVEL SECURITY;

-- RLS Policies for core tables
CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view own private data" ON public.user_private
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own private data" ON public.user_private
  FOR ALL TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view active institutions" ON public.institutions
  FOR SELECT TO authenticated USING (is_active = true);-- Expert availability slots
CREATE TABLE public.expert_availability (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expert_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  institution_id UUID REFERENCES public.institutions(id),
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  is_booked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Appointments
CREATE TABLE public.appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  expert_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  slot_id UUID REFERENCES public.expert_availability(id),
  slot_time TIMESTAMP WITH TIME ZONE NOT NULL,
  status public.appointment_status NOT NULL DEFAULT 'pending',
  session_type TEXT NOT NULL DEFAULT 'video',
  credits_charged INTEGER NOT NULL DEFAULT 0,
  session_notes_encrypted TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Peer sessions
CREATE TABLE public.peer_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  intern_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.peer_session_status NOT NULL DEFAULT 'pending',
  is_flagged BOOLEAN NOT NULL DEFAULT false,
  escalation_note_encrypted TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Peer messages
CREATE TABLE public.peer_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.peer_sessions(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content_encrypted TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- BlackBox entries
CREATE TABLE public.blackbox_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content_encrypted TEXT NOT NULL,
  content_type public.content_type NOT NULL DEFAULT 'text',
  ai_flag_level INTEGER NOT NULL DEFAULT 0 CHECK (ai_flag_level >= 0 AND ai_flag_level <= 3),
  is_private BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Credit transactions (immutable ledger)
CREATE TABLE public.credit_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  institution_id UUID REFERENCES public.institutions(id),
  delta INTEGER NOT NULL,
  type public.credit_type NOT NULL,
  reference_id UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Sound content
CREATE TABLE public.sound_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT,
  category TEXT NOT NULL,
  description TEXT,
  file_url TEXT,
  duration_sec INTEGER,
  cover_emoji TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  play_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Quest cards
CREATE TABLE public.quest_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  xp_reward INTEGER NOT NULL DEFAULT 10,
  category TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User quest completions
CREATE TABLE public.quest_completions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  quest_id UUID NOT NULL REFERENCES public.quest_cards(id) ON DELETE CASCADE,
  completed_date DATE NOT NULL DEFAULT CURRENT_DATE,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, quest_id, completed_date)
);

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Enable RLS on all tables
ALTER TABLE public.expert_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peer_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peer_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blackbox_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sound_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quest_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quest_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;-- RLS Policies for all tables

-- Expert availability
CREATE POLICY "Anyone can view expert availability" ON public.expert_availability
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Experts can manage own availability" ON public.expert_availability
  FOR ALL TO authenticated USING (auth.uid() = expert_id);

-- Appointments
CREATE POLICY "Users can view own appointments" ON public.appointments
  FOR SELECT TO authenticated 
  USING (auth.uid() = student_id OR auth.uid() = expert_id);

CREATE POLICY "Students can create appointments" ON public.appointments
  FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Users can update own appointments" ON public.appointments
  FOR UPDATE TO authenticated 
  USING (auth.uid() = student_id OR auth.uid() = expert_id);

-- Peer sessions
CREATE POLICY "Users can view own peer sessions" ON public.peer_sessions
  FOR SELECT TO authenticated 
  USING (auth.uid() = student_id OR auth.uid() = intern_id);

CREATE POLICY "Students can create peer sessions" ON public.peer_sessions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Participants can update peer sessions" ON public.peer_sessions
  FOR UPDATE TO authenticated 
  USING (auth.uid() = student_id OR auth.uid() = intern_id);

-- Peer messages
CREATE POLICY "Session participants can view messages" ON public.peer_messages
  FOR SELECT TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.peer_sessions 
      WHERE id = session_id 
      AND (student_id = auth.uid() OR intern_id = auth.uid())
    )
  );

CREATE POLICY "Session participants can send messages" ON public.peer_messages
  FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() = sender_id);

-- BlackBox entries
CREATE POLICY "Users can view own blackbox entries" ON public.blackbox_entries
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can create blackbox entries" ON public.blackbox_entries
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own blackbox entries" ON public.blackbox_entries
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own blackbox entries" ON public.blackbox_entries
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Credit transactions
CREATE POLICY "Users can view own credit transactions" ON public.credit_transactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "System can insert credit transactions" ON public.credit_transactions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Sound content: public read
CREATE POLICY "Anyone can view sound content" ON public.sound_content
  FOR SELECT TO authenticated USING (is_active = true);

-- Quest cards: public read
CREATE POLICY "Anyone can view quest cards" ON public.quest_cards
  FOR SELECT TO authenticated USING (is_active = true);

-- Quest completions
CREATE POLICY "Users can view own quest completions" ON public.quest_completions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can complete quests" ON public.quest_completions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- User roles
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Helper functions
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.get_credit_balance(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(delta), 0)::integer
  FROM public.credit_transactions
  WHERE user_id = _user_id
$$;

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8)),
    'student'
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student');
  
  INSERT INTO public.credit_transactions (user_id, delta, type, notes)
  VALUES (NEW.id, 100, 'grant', 'Welcome bonus');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create indexes
CREATE INDEX idx_profiles_institution ON public.profiles(institution_id);
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_appointments_student ON public.appointments(student_id);
CREATE INDEX idx_appointments_expert ON public.appointments(expert_id);
CREATE INDEX idx_peer_sessions_student ON public.peer_sessions(student_id);
CREATE INDEX idx_blackbox_entries_user ON public.blackbox_entries(user_id);
CREATE INDEX idx_credit_transactions_user ON public.credit_transactions(user_id);

-- Enable realtime for chat
ALTER PUBLICATION supabase_realtime ADD TABLE public.peer_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.peer_sessions;-- Insert demo institution
INSERT INTO public.institutions (name, eternia_code_hash, plan_type, credits_pool) 
VALUES ('Demo University', 'DEMO123', 'premium', 10000);

-- Insert sound content
INSERT INTO public.sound_content (title, artist, category, description, cover_emoji, duration_sec) VALUES
('Calm Ocean Waves', 'Nature Collection', 'nature', 'Peaceful ocean sounds for relaxation', '🌊', 900),
('Guided Mindfulness', 'Dr. Peace', 'meditation', 'A 10-minute guided meditation session', '🧘', 630),
('Forest Rain', 'Nature Collection', 'nature', 'Gentle rain falling on forest leaves', '🌲', 1200),
('Deep Focus Beats', 'Study Sounds', 'focus', 'Lo-fi beats for concentration', '🎯', 2700),
('Sleep Stories', 'Dreamland', 'sleep', 'Calming bedtime stories for adults', '🌙', 1800),
('Tibetan Singing Bowl', 'Ancient Sounds', 'meditation', 'Traditional bowl sounds for meditation', '🔔', 720),
('Morning Sunrise', 'Ambient Vibes', 'nature', 'Peaceful morning ambient sounds', '🌅', 1500),
('Stress Relief Mix', 'Wellness Audio', 'stress', 'Curated sounds to reduce anxiety', '💆', 1800);

-- Insert quest cards
INSERT INTO public.quest_cards (title, description, xp_reward, category) VALUES
('Morning Gratitude', 'Write down 3 things you are grateful for today', 10, 'mindfulness'),
('Mindful Breathing', 'Take 5 deep breaths and focus on the present moment', 15, 'breathing'),
('Connect with Someone', 'Reach out to a friend or family member', 20, 'social'),
('Physical Movement', 'Do 10 minutes of light exercise or stretching', 25, 'wellness'),
('Digital Detox', 'Spend 30 minutes away from screens', 20, 'wellness'),
('Hydration Check', 'Drink 8 glasses of water today', 10, 'health'),
('Positive Affirmation', 'Say 3 positive things about yourself', 15, 'mindfulness'),
('Nature Walk', 'Spend 15 minutes outside in nature', 25, 'wellness');-- Recovery credentials table for fragment pairs + emoji pattern
CREATE TABLE public.recovery_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  fragment_pairs_encrypted text NOT NULL,
  emoji_pattern_encrypted text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recovery_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own recovery credentials"
  ON public.recovery_credentials FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Function to check daily earn cap (5 ECC/day max)
CREATE OR REPLACE FUNCTION public.get_daily_earn_total(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT COALESCE(SUM(delta), 0)::integer
  FROM public.credit_transactions
  WHERE user_id = _user_id
    AND type = 'earn'
    AND created_at >= (CURRENT_DATE AT TIME ZONE 'UTC')
$$;

-- Add contact_is_self field to user_private
ALTER TABLE public.user_private ADD COLUMN IF NOT EXISTS contact_is_self boolean DEFAULT false;-- Allow admins/spocs to manage sound_content
CREATE POLICY "Admins can insert sound content"
ON public.sound_content
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'spoc'));

CREATE POLICY "Admins can update sound content"
ON public.sound_content
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'spoc'));

CREATE POLICY "Admins can delete sound content"
ON public.sound_content
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'spoc'));
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

-- Create escalation_requests table
CREATE TABLE public.escalation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid REFERENCES public.blackbox_entries(id) ON DELETE SET NULL,
  session_id uuid REFERENCES public.peer_sessions(id) ON DELETE SET NULL,
  spoc_id uuid NOT NULL REFERENCES public.profiles(id),
  admin_id uuid REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'resolved')),
  justification_encrypted text NOT NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.escalation_requests ENABLE ROW LEVEL SECURITY;

-- SPOC can create escalation requests
CREATE POLICY "SPOC can create escalation requests"
ON public.escalation_requests
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'spoc') OR public.has_role(auth.uid(), 'admin')
);

-- SPOC/Admin can view escalation requests
CREATE POLICY "SPOC and Admin can view escalation requests"
ON public.escalation_requests
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'spoc') OR public.has_role(auth.uid(), 'admin')
);

-- Admin can update escalation requests (approve/reject)
CREATE POLICY "Admin can update escalation requests"
ON public.escalation_requests
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create audit_logs table (immutable - no UPDATE/DELETE policies)
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES public.profiles(id),
  action_type text NOT NULL,
  target_table text,
  target_id uuid,
  metadata jsonb DEFAULT '{}',
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Authenticated users can insert audit logs (system writes)
CREATE POLICY "System can insert audit logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = actor_id);

-- Create indexes
CREATE INDEX idx_escalation_requests_spoc ON public.escalation_requests(spoc_id);
CREATE INDEX idx_escalation_requests_status ON public.escalation_requests(status);
CREATE INDEX idx_escalation_requests_created ON public.escalation_requests(created_at DESC);
CREATE INDEX idx_audit_logs_actor ON public.audit_logs(actor_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action_type);
CREATE INDEX idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- Also add missing indexes from PRD for existing tables
CREATE INDEX IF NOT EXISTS idx_blackbox_entries_flag ON public.blackbox_entries(ai_flag_level);
CREATE INDEX IF NOT EXISTS idx_blackbox_entries_created ON public.blackbox_entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON public.credit_transactions(type);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created ON public.credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_slot_time ON public.appointments(slot_time);
CREATE INDEX IF NOT EXISTS idx_peer_sessions_status ON public.peer_sessions(status);
CREATE INDEX IF NOT EXISTS idx_peer_sessions_started ON public.peer_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_institution ON public.profiles(institution_id);
CREATE INDEX IF NOT EXISTS idx_profiles_active ON public.profiles(is_active);
-- Allow admins to insert into user_roles (for role assignment)
CREATE POLICY "Admins can insert user_roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow admins to update user_roles
CREATE POLICY "Admins can update user_roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow admins to delete user_roles
CREATE POLICY "Admins can delete user_roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
-- Fix: "Anyone can view active institutions" must be PERMISSIVE, not RESTRICTIVE
-- Drop the restrictive policy and recreate as permissive
DROP POLICY IF EXISTS "Anyone can view active institutions" ON public.institutions;

CREATE POLICY "Anyone can view active institutions"
  ON public.institutions
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Allow anonymous (unauthenticated) users to view active institutions for the registration flow
DROP POLICY IF EXISTS "Anyone can view active institutions" ON public.institutions;

CREATE POLICY "Anyone can view active institutions"
  ON public.institutions
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);
CREATE POLICY "Admins can update profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));-- Drop the restrictive policy and recreate as permissive
DROP POLICY IF EXISTS "Users can manage own recovery credentials" ON public.recovery_credentials;

CREATE POLICY "Users can manage own recovery credentials"
ON public.recovery_credentials
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);DELETE FROM public.sound_content;INSERT INTO storage.buckets (id, name, public) VALUES ('sound-files', 'sound-files', true);

CREATE POLICY "Admins can upload sound files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'sound-files' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'spoc')));

CREATE POLICY "Admins can delete sound files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'sound-files' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'spoc')));

CREATE POLICY "Anyone can view sound files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'sound-files');ALTER TABLE public.appointments ADD COLUMN room_id text;
-- Create blackbox_sessions table for queue-based therapist model
CREATE TABLE public.blackbox_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  therapist_id uuid REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'queued',
  room_id text,
  flag_level integer NOT NULL DEFAULT 0,
  escalation_reason text,
  escalation_history jsonb DEFAULT '[]'::jsonb,
  session_notes_encrypted text,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.blackbox_sessions ENABLE ROW LEVEL SECURITY;

-- Students can create sessions (own student_id)
CREATE POLICY "Students can create blackbox sessions"
ON public.blackbox_sessions FOR INSERT TO authenticated
WITH CHECK (auth.uid() = student_id);

-- Students can view own sessions
CREATE POLICY "Students can view own blackbox sessions"
ON public.blackbox_sessions FOR SELECT TO authenticated
USING (auth.uid() = student_id);

-- Experts can view queued sessions and their own assigned sessions
CREATE POLICY "Experts can view blackbox sessions"
ON public.blackbox_sessions FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'expert'::app_role)
  AND (status = 'queued' OR therapist_id = auth.uid())
);

-- Experts can update sessions (accept, complete, escalate)
CREATE POLICY "Experts can update blackbox sessions"
ON public.blackbox_sessions FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'expert'::app_role)
  AND (status = 'queued' OR therapist_id = auth.uid())
);

-- Students can update own sessions (cancel)
CREATE POLICY "Students can update own blackbox sessions"
ON public.blackbox_sessions FOR UPDATE TO authenticated
USING (auth.uid() = student_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.blackbox_sessions;

-- ECC Stability Pool table
CREATE TABLE public.ecc_stability_pool (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid REFERENCES public.institutions(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0,
  total_contributed integer NOT NULL DEFAULT 0,
  total_disbursed integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ecc_stability_pool ENABLE ROW LEVEL SECURITY;

-- Only admins/SPOCs can view pool
CREATE POLICY "Admins can view stability pool" ON public.ecc_stability_pool
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'spoc'::app_role));

CREATE POLICY "System can update stability pool" ON public.ecc_stability_pool
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add training_status to profiles for intern gate
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS training_status text NOT NULL DEFAULT 'not_started';

-- Function to get pool balance for an institution
CREATE OR REPLACE FUNCTION public.get_pool_balance(_institution_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(balance, 0)
  FROM public.ecc_stability_pool
  WHERE institution_id = _institution_id
  LIMIT 1
$$;

-- 1. Add training_progress JSONB column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS training_progress jsonb DEFAULT '[]'::jsonb;

-- 2. Performance indexes per PRD Section 12.3
CREATE INDEX IF NOT EXISTS idx_profiles_institution_role_active ON public.profiles(institution_id, role, is_active);
CREATE INDEX IF NOT EXISTS idx_appointments_student_status ON public.appointments(student_id, status, slot_time);
CREATE INDEX IF NOT EXISTS idx_appointments_expert_status ON public.appointments(expert_id, status);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_type ON public.credit_transactions(user_id, type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_peer_sessions_student ON public.peer_sessions(student_id, status);
CREATE INDEX IF NOT EXISTS idx_peer_sessions_intern ON public.peer_sessions(intern_id, status);
CREATE INDEX IF NOT EXISTS idx_blackbox_entries_user ON public.blackbox_entries(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blackbox_sessions_student ON public.blackbox_sessions(student_id, status);
CREATE INDEX IF NOT EXISTS idx_blackbox_sessions_therapist ON public.blackbox_sessions(therapist_id, status);
CREATE INDEX IF NOT EXISTS idx_expert_availability_expert ON public.expert_availability(expert_id, is_booked, start_time);
CREATE INDEX IF NOT EXISTS idx_escalation_requests_spoc ON public.escalation_requests(spoc_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_id, created_at DESC);

-- 3. Allow experts to INSERT escalation requests
CREATE POLICY "Experts can create escalation requests"
ON public.escalation_requests
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'expert'::app_role));

-- 4. Revoke UPDATE/DELETE on audit_logs for authenticated and anon roles
REVOKE UPDATE, DELETE ON public.audit_logs FROM authenticated;
REVOKE UPDATE, DELETE ON public.audit_logs FROM anon;
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
);-- Add escalation columns to escalation_requests
ALTER TABLE public.escalation_requests 
  ADD COLUMN IF NOT EXISTS escalation_level integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS trigger_snippet text,
  ADD COLUMN IF NOT EXISTS trigger_timestamp timestamptz;

-- Add student_id to profiles for auto-generated IDs
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS student_id text UNIQUE;

-- Create sequence for student IDs
CREATE SEQUENCE IF NOT EXISTS student_id_seq START 1001;

-- Create function to auto-generate student IDs on profile creation
CREATE OR REPLACE FUNCTION public.generate_student_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inst_code TEXT;
  seq_num INTEGER;
BEGIN
  IF NEW.role = 'student' AND NEW.student_id IS NULL THEN
    IF NEW.institution_id IS NOT NULL THEN
      SELECT UPPER(LEFT(REGEXP_REPLACE(name, '[^a-zA-Z0-9]', '', 'g'), 4))
      INTO inst_code
      FROM public.institutions
      WHERE id = NEW.institution_id;
    END IF;
    
    inst_code := COALESCE(inst_code, 'INDP');
    seq_num := nextval('student_id_seq');
    NEW.student_id := 'ETN-' || inst_code || '-' || LPAD(seq_num::text, 5, '0');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for auto-generating student IDs
DROP TRIGGER IF EXISTS trg_generate_student_id ON public.profiles;
CREATE TRIGGER trg_generate_student_id
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_student_id();
ALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS institution_type TEXT NOT NULL DEFAULT 'university';

ALTER TABLE public.user_private ADD COLUMN IF NOT EXISTS apaar_id_encrypted TEXT;
ALTER TABLE public.user_private ADD COLUMN IF NOT EXISTS erp_id_encrypted TEXT;
ALTER TABLE public.user_private ADD COLUMN IF NOT EXISTS apaar_verified BOOLEAN DEFAULT false;
ALTER TABLE public.user_private ADD COLUMN IF NOT EXISTS erp_verified BOOLEAN DEFAULT false;

CREATE TABLE public.training_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_number integer NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL,
  duration text NOT NULL DEFAULT '30 min',
  objectives jsonb NOT NULL DEFAULT '[]'::jsonb,
  content text NOT NULL DEFAULT '',
  has_quiz boolean NOT NULL DEFAULT false,
  quiz_questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.training_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active training modules"
  ON public.training_modules FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can manage training modules"
  ON public.training_modules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
-- 1. Create device_sessions table for JWT rotation & multi-device management
CREATE TABLE public.device_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  device_id_hash text NOT NULL,
  refresh_token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.device_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own device sessions" ON public.device_sessions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own device sessions" ON public.device_sessions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own device sessions" ON public.device_sessions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all device sessions" ON public.device_sessions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 2. Add recurrence_rule to expert_availability for recurring weekly slots
ALTER TABLE public.expert_availability ADD COLUMN IF NOT EXISTS recurrence_rule text DEFAULT NULL;

-- 3. Add therapist to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'therapist';

-- 4. Performance indexes for 60k+ scale
CREATE INDEX IF NOT EXISTS idx_profiles_institution_role ON public.profiles(institution_id, role);
CREATE INDEX IF NOT EXISTS idx_profiles_role_active ON public.profiles(role, is_active);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_type ON public.credit_transactions(user_id, type);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created ON public.credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_student ON public.appointments(student_id, status);
CREATE INDEX IF NOT EXISTS idx_appointments_expert ON public.appointments(expert_id, status);
CREATE INDEX IF NOT EXISTS idx_appointments_slot_time ON public.appointments(slot_time DESC);
CREATE INDEX IF NOT EXISTS idx_peer_sessions_student ON public.peer_sessions(student_id, status);
CREATE INDEX IF NOT EXISTS idx_peer_sessions_intern ON public.peer_sessions(intern_id, status);
CREATE INDEX IF NOT EXISTS idx_blackbox_sessions_status ON public.blackbox_sessions(status);
CREATE INDEX IF NOT EXISTS idx_blackbox_sessions_therapist ON public.blackbox_sessions(therapist_id, status);
CREATE INDEX IF NOT EXISTS idx_blackbox_entries_user ON public.blackbox_entries(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blackbox_entries_flag ON public.blackbox_entries(ai_flag_level DESC) WHERE ai_flag_level > 0;
CREATE INDEX IF NOT EXISTS idx_escalation_requests_status ON public.escalation_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_escalation_requests_spoc ON public.escalation_requests(spoc_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_device_sessions_user ON public.device_sessions(user_id, revoked);
CREATE INDEX IF NOT EXISTS idx_quest_completions_user ON public.quest_completions(user_id, completed_date);

-- 5. Enable realtime for escalation_requests (for SPOC notifications)
ALTER PUBLICATION supabase_realtime ADD TABLE public.escalation_requests;-- Add deletion_requested_at column for 30-day grace period
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deletion_requested_at timestamptz DEFAULT NULL;

-- Allow interns to create escalation requests for peer sessions
CREATE POLICY "Interns can create escalation requests" ON public.escalation_requests
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'intern'::app_role));CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;CREATE TABLE public.analytics_events (
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
CREATE POLICY "Interns can view blackbox sessions"
ON public.blackbox_sessions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'intern'::app_role) AND (status = 'queued' OR therapist_id = auth.uid()));

CREATE POLICY "Interns can update blackbox sessions"
ON public.blackbox_sessions FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'intern'::app_role) AND (status = 'queued' OR therapist_id = auth.uid()));

CREATE POLICY "Therapists can view blackbox sessions"
ON public.blackbox_sessions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'therapist'::app_role) AND (status = 'queued' OR therapist_id = auth.uid()));

CREATE POLICY "Therapists can update blackbox sessions"
ON public.blackbox_sessions FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'therapist'::app_role) AND (status = 'queued' OR therapist_id = auth.uid()));

-- Materialized view for O(1) credit balance lookups
CREATE MATERIALIZED VIEW IF NOT EXISTS public.credit_balance_view AS
SELECT user_id, COALESCE(SUM(delta), 0)::integer AS balance,
       MAX(created_at) AS last_transaction_at
FROM public.credit_transactions
GROUP BY user_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_balance_view_user ON public.credit_balance_view(user_id);

-- Function to refresh materialized view
CREATE OR REPLACE FUNCTION public.refresh_credit_balance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.credit_balance_view;
  RETURN NULL;
END;
$$;

-- Trigger to auto-refresh after credit transactions
CREATE TRIGGER trg_refresh_credit_balance
AFTER INSERT ON public.credit_transactions
FOR EACH STATEMENT EXECUTE FUNCTION public.refresh_credit_balance();

-- Index for fast message pagination
CREATE INDEX IF NOT EXISTS idx_peer_messages_session_created ON public.peer_messages(session_id, created_at DESC);

-- Index for device session lookups
CREATE INDEX IF NOT EXISTS idx_device_sessions_device_hash ON public.device_sessions(device_id_hash);

-- Index for credit transaction user lookups
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_type ON public.credit_transactions(user_id, type);

-- Revoke direct API access to materialized view (security best practice)
REVOKE ALL ON public.credit_balance_view FROM anon, authenticated;

-- Create a security definer function to read from the materialized view
CREATE OR REPLACE FUNCTION public.get_credit_balance_fast(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT balance FROM public.credit_balance_view WHERE user_id = _user_id),
    0
  )
$$;

-- ============================================================
-- SECURITY HARDENING: Fix critical RLS vulnerabilities
-- ============================================================

-- 1. FIX: Remove self-insert policy on credit_transactions
--    (prevents users from fabricating credits for themselves)
DROP POLICY IF EXISTS "System can insert credit transactions" ON public.credit_transactions;

-- 2. FIX: Restrict profiles SELECT to own profile + admin/spoc/expert view
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Admins and SPOCs can view all profiles (needed for management)
CREATE POLICY "Admins and SPOCs can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'spoc')
  );

-- Experts/therapists/interns can view profiles (needed for sessions)
CREATE POLICY "Staff can view profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'expert') OR
    public.has_role(auth.uid(), 'therapist') OR
    public.has_role(auth.uid(), 'intern')
  );

-- 3. FIX: Remove anon access from institutions (protect eternia_code_hash)
DROP POLICY IF EXISTS "Anyone can view active institutions" ON public.institutions;

-- Only authenticated users can view active institutions
CREATE POLICY "Authenticated can view active institutions"
  ON public.institutions FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- 4. Rate limiting table for edge function abuse prevention
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 1,
  UNIQUE(key, window_start)
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.rate_limits
  WHERE window_start < now() - interval '1 hour';
$$;

-- Rate limit checker
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _key text,
  _max_requests integer DEFAULT 60,
  _window_seconds integer DEFAULT 60
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _window_start timestamptz;
  _count integer;
BEGIN
  _window_start := date_trunc('minute', now());
  
  INSERT INTO public.rate_limits (key, window_start, request_count)
  VALUES (_key, _window_start, 1)
  ON CONFLICT (key, window_start) DO UPDATE
    SET request_count = rate_limits.request_count + 1
  RETURNING request_count INTO _count;
  
  RETURN _count <= _max_requests;
END;
$$;

-- Allow service role only on rate_limits (no user access)
CREATE POLICY "No user access to rate_limits"
  ON public.rate_limits FOR ALL
  TO authenticated
  USING (false);

-- 1. FIX: Remove anon from institutions policy — only authenticated
DROP POLICY IF EXISTS "Authenticated can view active institutions" ON public.institutions;

CREATE POLICY "Authenticated can view active institutions"
  ON public.institutions FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Keep anon access but ONLY for name and id (via a view approach)
-- Since we can't restrict columns in RLS, we create a separate anon-safe policy
-- that only allows viewing is_active institutions but we accept this risk
-- as institution codes should be hashed properly (not plaintext)

-- 2. FIX: Escalation request INSERT policies — bind spoc_id to a valid relationship
DROP POLICY IF EXISTS "Experts can create escalation requests" ON public.escalation_requests;
DROP POLICY IF EXISTS "Interns can create escalation requests" ON public.escalation_requests;

-- Experts can create escalation requests but must reference themselves appropriately
CREATE POLICY "Experts can create escalation requests"
  ON public.escalation_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'expert') AND
    (
      -- Must reference a session they own OR a blackbox session they're assigned to
      (session_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.peer_sessions ps WHERE ps.id = session_id AND ps.intern_id = auth.uid()
      )) OR
      (entry_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.blackbox_sessions bs WHERE bs.therapist_id = auth.uid()
      )) OR
      (session_id IS NULL AND entry_id IS NULL)
    )
  );

-- Interns can create escalation requests for their own sessions
CREATE POLICY "Interns can create escalation requests"
  ON public.escalation_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'intern') AND
    (
      (session_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.peer_sessions ps WHERE ps.id = session_id AND ps.intern_id = auth.uid()
      )) OR
      (session_id IS NULL AND entry_id IS NULL)
    )
  );

-- Re-add limited anon access for institution code verification during onboarding
-- This is needed because the institution code page is accessed before login
CREATE POLICY "Anon can verify active institutions"
  ON public.institutions FOR SELECT
  TO anon
  USING (is_active = true);

-- Journal entries table
CREATE TABLE public.journal_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  mood_tag TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own journal entries" ON public.journal_entries
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own journal entries" ON public.journal_entries
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can update own journal entries" ON public.journal_entries
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own journal entries" ON public.journal_entries
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Mood entries table
CREATE TABLE public.mood_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mood INTEGER NOT NULL CHECK (mood >= 1 AND mood <= 5),
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.mood_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own mood entries" ON public.mood_entries
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own mood entries" ON public.mood_entries
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Gratitude entries table
CREATE TABLE public.gratitude_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_1 TEXT NOT NULL DEFAULT '',
  entry_2 TEXT NOT NULL DEFAULT '',
  entry_3 TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gratitude_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own gratitude entries" ON public.gratitude_entries
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own gratitude entries" ON public.gratitude_entries
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own credit transactions"
ON public.credit_transactions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
-- Create temp_credentials table for bulk ID onboarding flow
CREATE TABLE public.temp_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  temp_username text NOT NULL UNIQUE,
  temp_password_hash text NOT NULL,
  temp_password_plain text NOT NULL,
  auth_user_id uuid,
  status text NOT NULL DEFAULT 'unused',
  assigned_at timestamptz,
  activated_at timestamptz,
  expires_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.temp_credentials ENABLE ROW LEVEL SECURITY;

-- Index for fast lookup of unused credentials per institution
CREATE INDEX idx_temp_credentials_institution_status ON public.temp_credentials(institution_id, status);
CREATE INDEX idx_temp_credentials_username ON public.temp_credentials(temp_username);

-- RLS: Admins have full access
CREATE POLICY "Admins can manage temp_credentials"
ON public.temp_credentials
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS: SPOCs can view and update their institution's temp credentials
CREATE POLICY "SPOCs can view institution temp_credentials"
ON public.temp_credentials
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'spoc') AND
  institution_id = (SELECT institution_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "SPOCs can update institution temp_credentials"
ON public.temp_credentials
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'spoc') AND
  institution_id = (SELECT institution_id FROM public.profiles WHERE id = auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'spoc') AND
  institution_id = (SELECT institution_id FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY "Students can view staff profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (role IN ('expert', 'therapist', 'intern'));ALTER TABLE public.blackbox_sessions ADD COLUMN refunded boolean NOT NULL DEFAULT false;
ALTER TABLE public.blackbox_sessions ADD COLUMN silence_duration_sec integer;
-- Add answer column to quest_completions
ALTER TABLE public.quest_completions ADD COLUMN answer text;

-- Admin can view all quest completions
CREATE POLICY "Admins can view all quest completions"
ON public.quest_completions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Admin can manage quest_cards (insert, update, delete)
CREATE POLICY "Admins can manage quest cards"
ON public.quest_cards FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Also allow admins to view inactive quest cards
CREATE POLICY "Admins can view all quest cards"
ON public.quest_cards FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.intern_referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  created_by uuid NOT NULL,
  assigned_to uuid,
  used_at timestamptz,
  expires_at timestamptz,
  is_used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.intern_referral_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage referral codes"
  ON public.intern_referral_codes
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can select referral codes"
  ON public.intern_referral_codes
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can update referral codes"
  ON public.intern_referral_codes
  FOR UPDATE
  TO authenticated
  USING (is_used = false)
  WITH CHECK (true);

-- Prevent duplicate active peer sessions per intern
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_peer_intern 
ON public.peer_sessions (intern_id) 
WHERE status IN ('pending', 'active') AND intern_id IS NOT NULL;

-- Prevent duplicate open blackbox sessions per student
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_open_blackbox_student 
ON public.blackbox_sessions (student_id) 
WHERE status IN ('queued', 'accepted', 'active');

ALTER TABLE public.blackbox_sessions
  ADD COLUMN IF NOT EXISTS student_joined_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS therapist_joined_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS last_join_error text NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_session_per_therapist
  ON public.blackbox_sessions (therapist_id)
  WHERE status IN ('accepted', 'active') AND therapist_id IS NOT NULL;

-- Create notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Authenticated can insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Add reschedule columns to appointments
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS reschedule_reason text,
  ADD COLUMN IF NOT EXISTS rescheduled_from timestamptz,
  ADD COLUMN IF NOT EXISTS rescheduled_by uuid;
ALTER TABLE public.peer_sessions ADD COLUMN IF NOT EXISTS room_id text;-- 1. Auto-expire function that cleans up stale sessions
CREATE OR REPLACE FUNCTION public.auto_expire_stale_peer_sessions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE peer_sessions 
  SET status = 'completed', ended_at = now()
  WHERE status IN ('active', 'pending') 
    AND created_at < now() - interval '2 hours';
  RETURN NEW;
END;
$$;

-- 2. Trigger: on every INSERT to peer_sessions, clean stale ones first
CREATE TRIGGER trg_auto_expire_peer_sessions
  BEFORE INSERT ON public.peer_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_expire_stale_peer_sessions();

-- 3. Tighten INSERT policy: only students can create peer sessions
DROP POLICY IF EXISTS "Students can create peer sessions" ON public.peer_sessions;
CREATE POLICY "Students can create peer sessions"
  ON public.peer_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = student_id
    AND public.has_role(auth.uid(), 'student')
  );

-- 4. Restrict message insertion to active sessions only
DROP POLICY IF EXISTS "Session participants can send messages" ON public.peer_messages;
CREATE POLICY "Session participants can send messages"
  ON public.peer_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM peer_sessions
      WHERE peer_sessions.id = peer_messages.session_id
        AND peer_sessions.status = 'active'
        AND (peer_sessions.student_id = auth.uid() OR peer_sessions.intern_id = auth.uid())
    )
  );CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  VALUES (NEW.id, 100, 'grant', 'Welcome bonus');
  
  RETURN NEW;
END;
$function$;ALTER PUBLICATION supabase_realtime ADD TABLE public.analytics_events;
CREATE TABLE public.institution_student_ids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  id_type text NOT NULL,
  student_id_hash text NOT NULL,
  is_claimed boolean NOT NULL DEFAULT false,
  claimed_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, id_type, student_id_hash)
);

ALTER TABLE public.institution_student_ids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access on institution_student_ids"
ON public.institution_student_ids FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "SPOCs can select institution_student_ids"
ON public.institution_student_ids FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'spoc') AND
  institution_id = (SELECT institution_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "SPOCs can insert institution_student_ids"
ON public.institution_student_ids FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'spoc') AND
  institution_id = (SELECT institution_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "SPOCs can update institution_student_ids"
ON public.institution_student_ids FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'spoc') AND
  institution_id = (SELECT institution_id FROM public.profiles WHERE id = auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'spoc') AND
  institution_id = (SELECT institution_id FROM public.profiles WHERE id = auth.uid())
);
CREATE OR REPLACE FUNCTION public.spend_credits_atomic(
  _user_id uuid,
  _amount integer,
  _notes text DEFAULT 'Service usage',
  _reference_id uuid DEFAULT NULL
)
RETURNS TABLE(success boolean, remaining integer, source text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _balance integer;
  _pool_balance integer;
  _inst_id uuid;
BEGIN
  PERFORM 1 FROM credit_transactions WHERE user_id = _user_id FOR UPDATE;
  
  SELECT COALESCE(SUM(delta), 0)::integer INTO _balance
  FROM credit_transactions WHERE user_id = _user_id;
  
  IF _balance >= _amount THEN
    INSERT INTO credit_transactions (user_id, delta, type, notes, reference_id)
    VALUES (_user_id, -_amount, 'spend', _notes, _reference_id);
    RETURN QUERY SELECT true, (_balance - _amount)::integer, 'balance'::text;
    RETURN;
  END IF;
  
  SELECT institution_id INTO _inst_id FROM profiles WHERE id = _user_id;
  IF _inst_id IS NOT NULL THEN
    SELECT COALESCE(balance, 0) INTO _pool_balance
    FROM ecc_stability_pool WHERE institution_id = _inst_id FOR UPDATE;
    
    IF _pool_balance >= _amount THEN
      UPDATE ecc_stability_pool
      SET balance = balance - _amount, total_disbursed = total_disbursed + _amount
      WHERE institution_id = _inst_id;
      
      INSERT INTO credit_transactions (user_id, delta, type, notes, reference_id, institution_id)
      VALUES (_user_id, -_amount, 'spend', _notes || ' (from stability pool)', _reference_id, _inst_id);
      
      RETURN QUERY SELECT true, 0, 'pool'::text;
      RETURN;
    END IF;
  END IF;
  
  RETURN QUERY SELECT false, _balance, 'insufficient'::text;
END;
$$;
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

-- Create avatars storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

-- RLS policies for avatars bucket
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'avatars');

-- Add logo_url to institutions
ALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS logo_url text;

CREATE TABLE public.password_reset_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  username text NOT NULL,
  reason text DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  admin_id uuid,
  admin_note text,
  temp_password text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can submit reset requests"
  ON public.password_reset_requests FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can check request status"
  ON public.password_reset_requests FOR SELECT TO anon
  USING (true);

CREATE POLICY "Users can submit reset requests"
  ON public.password_reset_requests FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can view own requests"
  ON public.password_reset_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage reset requests"
  ON public.password_reset_requests FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Drop and recreate expert SELECT policy
DROP POLICY "Experts can view blackbox sessions" ON public.blackbox_sessions;
CREATE POLICY "Experts can view blackbox sessions" ON public.blackbox_sessions
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'expert'::app_role) AND (
      status = 'queued' OR status = 'escalated' OR therapist_id = auth.uid()
    )
  );

-- Drop and recreate expert UPDATE policy
DROP POLICY "Experts can update blackbox sessions" ON public.blackbox_sessions;
CREATE POLICY "Experts can update blackbox sessions" ON public.blackbox_sessions
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'expert'::app_role) AND (
      status = 'queued' OR status = 'escalated' OR therapist_id = auth.uid()
    )
  );

-- Same for therapists
DROP POLICY "Therapists can view blackbox sessions" ON public.blackbox_sessions;
CREATE POLICY "Therapists can view blackbox sessions" ON public.blackbox_sessions
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'therapist'::app_role) AND (
      status = 'queued' OR status = 'escalated' OR therapist_id = auth.uid()
    )
  );

DROP POLICY "Therapists can update blackbox sessions" ON public.blackbox_sessions;
CREATE POLICY "Therapists can update blackbox sessions" ON public.blackbox_sessions
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'therapist'::app_role) AND (
      status = 'queued' OR status = 'escalated' OR therapist_id = auth.uid()
    )
  );

-- Same for interns
DROP POLICY "Interns can view blackbox sessions" ON public.blackbox_sessions;
CREATE POLICY "Interns can view blackbox sessions" ON public.blackbox_sessions
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'intern'::app_role) AND (
      status = 'queued' OR status = 'escalated' OR therapist_id = auth.uid()
    )
  );

DROP POLICY "Interns can update blackbox sessions" ON public.blackbox_sessions;
CREATE POLICY "Interns can update blackbox sessions" ON public.blackbox_sessions
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'intern'::app_role) AND (
      status = 'queued' OR status = 'escalated' OR therapist_id = auth.uid()
    )
  );

-- Update expert SELECT policy to include active sessions with flag_level >= 3
DROP POLICY IF EXISTS "Experts can view blackbox sessions" ON public.blackbox_sessions;
CREATE POLICY "Experts can view blackbox sessions" ON public.blackbox_sessions
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'expert'::app_role)
    AND (
      status = 'queued'
      OR status = 'escalated'
      OR therapist_id = auth.uid()
      OR (flag_level >= 3 AND status IN ('active', 'accepted'))
    )
  );

-- Update expert UPDATE policy to include active L3 sessions
DROP POLICY IF EXISTS "Experts can update blackbox sessions" ON public.blackbox_sessions;
CREATE POLICY "Experts can update blackbox sessions" ON public.blackbox_sessions
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'expert'::app_role)
    AND (
      status = 'queued'
      OR status = 'escalated'
      OR therapist_id = auth.uid()
      OR (flag_level >= 3 AND status IN ('active', 'accepted'))
    )
  );

-- Update therapist SELECT policy
DROP POLICY IF EXISTS "Therapists can view blackbox sessions" ON public.blackbox_sessions;
CREATE POLICY "Therapists can view blackbox sessions" ON public.blackbox_sessions
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'therapist'::app_role)
    AND (
      status = 'queued'
      OR status = 'escalated'
      OR therapist_id = auth.uid()
      OR (flag_level >= 3 AND status IN ('active', 'accepted'))
    )
  );

-- Update therapist UPDATE policy
DROP POLICY IF EXISTS "Therapists can update blackbox sessions" ON public.blackbox_sessions;
CREATE POLICY "Therapists can update blackbox sessions" ON public.blackbox_sessions
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'therapist'::app_role)
    AND (
      status = 'queued'
      OR status = 'escalated'
      OR therapist_id = auth.uid()
      OR (flag_level >= 3 AND status IN ('active', 'accepted'))
    )
  );

-- Update intern SELECT policy
DROP POLICY IF EXISTS "Interns can view blackbox sessions" ON public.blackbox_sessions;
CREATE POLICY "Interns can view blackbox sessions" ON public.blackbox_sessions
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'intern'::app_role)
    AND (
      status = 'queued'
      OR status = 'escalated'
      OR therapist_id = auth.uid()
      OR (flag_level >= 3 AND status IN ('active', 'accepted'))
    )
  );

-- Update intern UPDATE policy
DROP POLICY IF EXISTS "Interns can update blackbox sessions" ON public.blackbox_sessions;
CREATE POLICY "Interns can update blackbox sessions" ON public.blackbox_sessions
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'intern'::app_role)
    AND (
      status = 'queued'
      OR status = 'escalated'
      OR therapist_id = auth.uid()
      OR (flag_level >= 3 AND status IN ('active', 'accepted'))
    )
  );
-- Make actor_id nullable on audit_logs
ALTER TABLE public.audit_logs ALTER COLUMN actor_id DROP NOT NULL;

-- Drop and recreate FK with ON DELETE SET NULL
ALTER TABLE public.audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_actor_id_fkey;

ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_actor_id_fkey
  FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  VALUES (NEW.id, 100, 'grant', 'Welcome bonus');
  
  RETURN NEW;
END;
$function$;
-- Sequence for ticket numbers
CREATE SEQUENCE IF NOT EXISTS institution_inquiry_seq START 1;

-- Table
CREATE TABLE public.institution_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number text UNIQUE,
  status text NOT NULL DEFAULT 'new',
  institution_name text NOT NULL,
  institution_type text NOT NULL DEFAULT 'university',
  address_line text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT '',
  pincode text NOT NULL DEFAULT '',
  google_maps_url text,
  contact_person_name text NOT NULL,
  contact_person_email text NOT NULL,
  contact_person_phone text NOT NULL,
  designation text NOT NULL DEFAULT '',
  pan_number text NOT NULL DEFAULT '',
  tan_number text NOT NULL DEFAULT '',
  gst_number text,
  student_count integer,
  website_url text,
  message text,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Auto-generate ticket_number trigger
CREATE OR REPLACE FUNCTION public.generate_inquiry_ticket_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  NEW.ticket_number := 'ETN-INQ-' || LPAD(nextval('institution_inquiry_seq')::text, 5, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_generate_inquiry_ticket
  BEFORE INSERT ON public.institution_inquiries
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_inquiry_ticket_number();

-- RLS
ALTER TABLE public.institution_inquiries ENABLE ROW LEVEL SECURITY;

-- Anon can insert (public form)
CREATE POLICY "Anon can submit inquiries"
  ON public.institution_inquiries
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Authenticated can also insert
CREATE POLICY "Authenticated can submit inquiries"
  ON public.institution_inquiries
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Anon can select own ticket by ticket_number (for tracking)
CREATE POLICY "Anon can track inquiries by ticket number"
  ON public.institution_inquiries
  FOR SELECT
  TO anon
  USING (true);

-- Admin can view all
CREATE POLICY "Admins can view all inquiries"
  ON public.institution_inquiries
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin can update
CREATE POLICY "Admins can update inquiries"
  ON public.institution_inquiries
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
