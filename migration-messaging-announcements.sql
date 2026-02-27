-- Migration: In-App Messaging + Announcement Board

-- Messages table for per-transaction chat between user and DP operator
CREATE TABLE IF NOT EXISTS public.messages (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES public.transactions(id),
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  sender_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_select" ON public.messages
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "messages_insert" ON public.messages
  FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_messages_tx ON public.messages(transaction_id);
CREATE INDEX IF NOT EXISTS idx_messages_date ON public.messages(created_at DESC);

-- Announcements table for DP/Bank operators
CREATE TABLE IF NOT EXISTS public.announcements (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  author_id UUID NOT NULL REFERENCES auth.users(id),
  author_name TEXT NOT NULL,
  author_role TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "announcements_select" ON public.announcements
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "announcements_insert" ON public.announcements
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid() AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('dp', 'bank', 'pelapak'))
  );

CREATE POLICY "announcements_delete" ON public.announcements
  FOR DELETE TO authenticated USING (author_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_announcements_date ON public.announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_pinned ON public.announcements(pinned DESC, created_at DESC);
