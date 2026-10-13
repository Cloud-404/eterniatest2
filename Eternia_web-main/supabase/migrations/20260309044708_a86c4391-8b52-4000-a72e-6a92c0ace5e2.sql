-- RLS Policies for all tables

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
ALTER PUBLICATION supabase_realtime ADD TABLE public.peer_sessions;