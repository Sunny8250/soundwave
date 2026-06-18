-- Admin audit log for sensitive admin actions.
-- Run this in Supabase SQL Editor after 008_admin_roles_and_reports.sql.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id       UUID REFERENCES public.users(id) ON DELETE SET NULL,
  target_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action         TEXT NOT NULL,
  old_values     JSONB,
  new_values     JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_actor
  ON public.admin_audit_logs(actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target
  ON public.admin_audit_logs(target_user_id, created_at DESC);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_read_audit_logs" ON public.admin_audit_logs;
CREATE POLICY "admins_read_audit_logs" ON public.admin_audit_logs
  FOR SELECT USING (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "admins_insert_audit_logs" ON public.admin_audit_logs;
CREATE POLICY "admins_insert_audit_logs" ON public.admin_audit_logs
  FOR INSERT WITH CHECK (public.is_admin_user(auth.uid()));
