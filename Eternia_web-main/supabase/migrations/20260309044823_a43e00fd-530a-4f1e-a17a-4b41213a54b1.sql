-- Insert demo institution
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
('Nature Walk', 'Spend 15 minutes outside in nature', 25, 'wellness');