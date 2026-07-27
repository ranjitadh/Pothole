-- Push tokens table for Expo push notification support.
-- Stores one record per (user_id, token) pair. The is_active flag is
-- toggled when the user enables / disables notifications in-app without
-- deleting the row so that historical auditing is preserved and re-enable
-- is an O(1) update rather than an insert.

CREATE TABLE IF NOT EXISTS public.push_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token       TEXT NOT NULL,
  platform    TEXT NOT NULL DEFAULT 'android', -- 'android' | 'ios'
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One active record per (user_id, token). Prevents duplicates when the
  -- same device re-registers after reinstall.
  CONSTRAINT push_tokens_user_token_unique UNIQUE (user_id, token)
);

-- Keep updated_at current automatically.
CREATE OR REPLACE FUNCTION public.set_push_token_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER push_tokens_updated_at
  BEFORE UPDATE ON public.push_tokens
  FOR EACH ROW EXECUTE FUNCTION public.set_push_token_updated_at();

-- Fast per-user lookups.
CREATE INDEX IF NOT EXISTS push_tokens_user_id_idx ON public.push_tokens (user_id);

-- ── Row-Level Security ────────────────────────────────────────────────────────
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only select their own tokens.
CREATE POLICY "push_tokens: owner select"
  ON public.push_tokens FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert a token only for themselves.
CREATE POLICY "push_tokens: owner insert"
  ON public.push_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update (activate / deactivate) only their own tokens.
CREATE POLICY "push_tokens: owner update"
  ON public.push_tokens FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete only their own tokens.
CREATE POLICY "push_tokens: owner delete"
  ON public.push_tokens FOR DELETE
  USING (auth.uid() = user_id);
