import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_URL) ||
  'https://chzpmbnixvyppuocjjck.supabase.co';

export const SUPABASE_KEY =
  (typeof import.meta !== 'undefined' &&
    import.meta.env &&
    (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_KEY)) ||
  '';

export const SUPABASE_PROJECT_ID =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_PROJECT_ID) ||
  'chzpmbnixvyppuocjjck';

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

export const SUPABASE_SQL_SCRIPT = `-- ========================================================
-- EchoScribe - Supabase Database Migration
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/${SUPABASE_PROJECT_ID}/sql
-- ========================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Meetings Table
CREATE TABLE IF NOT EXISTS public.meetings (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    meeting_date DATE NOT NULL,
    participants TEXT[] NOT NULL DEFAULT '{}',
    transcript TEXT NOT NULL,
    status TEXT DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Decisions Table
CREATE TABLE IF NOT EXISTS public.decisions (
    id TEXT PRIMARY KEY,
    meeting_id TEXT NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    decision TEXT NOT NULL,
    confidence NUMERIC(4, 2) NOT NULL,
    evidence TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Action Items Table
CREATE TABLE IF NOT EXISTS public.action_items (
    id TEXT PRIMARY KEY,
    meeting_id TEXT NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    owner TEXT,
    due_date DATE,
    confidence NUMERIC(4, 2) NOT NULL,
    evidence TEXT,
    status TEXT DEFAULT 'pending',
    needs_review BOOLEAN DEFAULT FALSE,
    review_reason TEXT,
    is_duplicate BOOLEAN DEFAULT FALSE,
    duplicate_of_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id TEXT PRIMARY KEY,
    meeting_id TEXT,
    action_item_id TEXT,
    event TEXT NOT NULL,
    old_value JSONB,
    new_value JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. System Settings Table
CREATE TABLE IF NOT EXISTS public.system_settings (
    id TEXT PRIMARY KEY DEFAULT 'singleton',
    manual_minutes_per_meeting NUMERIC(5, 2) DEFAULT 10,
    automated_minutes_per_meeting NUMERIC(5, 2) DEFAULT 2,
    confidence_threshold NUMERIC(4, 2) DEFAULT 0.70,
    ai_model TEXT DEFAULT 'gemini-3.8-flash',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Create Open Public Access Policies (for anon/publishable key)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'meetings' AND policyname = 'Allow public all on meetings') THEN
    CREATE POLICY "Allow public all on meetings" ON public.meetings FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'decisions' AND policyname = 'Allow public all on decisions') THEN
    CREATE POLICY "Allow public all on decisions" ON public.decisions FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'action_items' AND policyname = 'Allow public all on action_items') THEN
    CREATE POLICY "Allow public all on action_items" ON public.action_items FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audit_logs' AND policyname = 'Allow public all on audit_logs') THEN
    CREATE POLICY "Allow public all on audit_logs" ON public.audit_logs FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'system_settings' AND policyname = 'Allow public all on system_settings') THEN
    CREATE POLICY "Allow public all on system_settings" ON public.system_settings FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
`;
