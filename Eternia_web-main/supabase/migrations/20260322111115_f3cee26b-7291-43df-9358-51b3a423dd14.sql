
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
