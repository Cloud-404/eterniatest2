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
  FOR SELECT TO authenticated USING (is_active = true);