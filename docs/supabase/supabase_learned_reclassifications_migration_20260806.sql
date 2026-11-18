-- Prerequisite for privacy and security-hardening migrations.
-- Safe to run on the linked remote project: it creates the missing user-owned
-- learned-category table and its RLS boundary without modifying existing rows.

BEGIN;

CREATE TABLE IF NOT EXISTS public.learned_reclassifications (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  normalized_name TEXT NOT NULL,
  category_id INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.learned_reclassifications
  DROP CONSTRAINT IF EXISTS learned_reclassifications_name_length_check;
ALTER TABLE public.learned_reclassifications
  ADD CONSTRAINT learned_reclassifications_name_length_check
  CHECK (char_length(btrim(normalized_name)) > 0 AND char_length(normalized_name) <= 200);

ALTER TABLE public.learned_reclassifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own reclassifications" ON public.learned_reclassifications;
CREATE POLICY "Users can view own reclassifications" ON public.learned_reclassifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own reclassifications" ON public.learned_reclassifications;
CREATE POLICY "Users can insert own reclassifications" ON public.learned_reclassifications
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own reclassifications" ON public.learned_reclassifications;
CREATE POLICY "Users can update own reclassifications" ON public.learned_reclassifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own reclassifications" ON public.learned_reclassifications;
CREATE POLICY "Users can delete own reclassifications" ON public.learned_reclassifications
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_learned_reclassifications_user_id
  ON public.learned_reclassifications(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_learned_reclassifications_user_name_unique
  ON public.learned_reclassifications(user_id, normalized_name);

COMMIT;
