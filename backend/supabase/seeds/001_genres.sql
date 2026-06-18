-- ============================================================
-- SOUNDWAVE — Seed Data
-- File: seeds/001_genres.sql
-- Run AFTER migrations. Populates base genres.
-- ============================================================

INSERT INTO public.genres (name, slug, description) VALUES
  ('Pop',             'pop',             'Popular mainstream music'),
  ('Hip-Hop',         'hip-hop',         'Rap, beats, and urban music'),
  ('R&B',             'rnb',             'Rhythm and blues'),
  ('Rock',            'rock',            'Rock and alternative music'),
  ('Electronic',      'electronic',      'EDM, house, techno, synth'),
  ('Jazz',            'jazz',            'Jazz and blues classics'),
  ('Classical',       'classical',       'Orchestral and classical compositions'),
  ('Indie',           'indie',           'Independent and alternative artists'),
  ('Metal',           'metal',           'Heavy metal and sub-genres'),
  ('Folk',            'folk',            'Folk, acoustic, and country'),
  ('Reggae',          'reggae',          'Reggae and dancehall'),
  ('Latin',           'latin',           'Latin pop, salsa, reggaeton'),
  ('Bollywood',       'bollywood',       'Hindi film music'),
  ('Punjabi',         'punjabi',         'Punjabi pop and bhangra'),
  ('Bengali',         'bengali',         'Bengali music and Rabindra Sangeet'),
  ('Tamil',           'tamil',           'Tamil film and independent music'),
  ('Telugu',          'telugu',          'Telugu film music'),
  ('Devotional',      'devotional',      'Bhajans, qawwalis, spiritual music'),
  ('Lo-fi',           'lo-fi',           'Lo-fi beats and chill music'),
  ('Ambient',         'ambient',         'Ambient and atmospheric music'),
  ('Podcast',         'podcast',         'Spoken word and podcasts'),
  ('Instrumental',    'instrumental',    'Instrumental and background music'),
  ('World Music',     'world-music',     'Global and fusion sounds')
ON CONFLICT (slug) DO NOTHING;
