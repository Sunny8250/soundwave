-- Admin roles and reports support.
-- This keeps creator/listener roles in public.users.role and adds a separate
-- admin privilege layer for super admins, admins, and moderators.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.admin_roles (
  user_id     UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'moderator'
              CHECK (role IN ('super_admin', 'admin', 'moderator')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.reports (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  content_type  TEXT NOT NULL CHECK (content_type IN ('track', 'user', 'album', 'playlist')),
  content_id    UUID NOT NULL,
  reason        TEXT NOT NULL,
  description   TEXT,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'resolved', 'dismissed')),
  priority      TEXT NOT NULL DEFAULT 'normal'
                CHECK (priority IN ('low', 'normal', 'high')),
  resolved_by   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_roles_role ON public.admin_roles(role);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_content ON public.reports(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON public.reports(reporter_id);

-- Backfill existing app admins into the new admin privilege table.
-- This is safer than promoting an arbitrary "first user" from public.users.
INSERT INTO public.admin_roles (user_id, role)
SELECT id, 'super_admin'
FROM public.users
WHERE role = 'admin'
ON CONFLICT (user_id) DO UPDATE
SET role = CASE
  WHEN public.admin_roles.role = 'super_admin' THEN public.admin_roles.role
  ELSE EXCLUDED.role
END;

CREATE OR REPLACE FUNCTION public.is_admin_user(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_roles
    WHERE user_id = check_user_id
      AND role IN ('super_admin', 'admin', 'moderator')
  )
  OR EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = check_user_id
      AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin_user(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_roles
    WHERE user_id = check_user_id
      AND role = 'super_admin'
  )
  OR EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = check_user_id
      AND role = 'admin'
  );
$$;

ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_read_roles" ON public.admin_roles;
CREATE POLICY "admins_read_roles" ON public.admin_roles
  FOR SELECT USING (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "super_admins_manage_roles" ON public.admin_roles;
CREATE POLICY "super_admins_manage_roles" ON public.admin_roles
  FOR ALL USING (public.is_super_admin_user(auth.uid()))
  WITH CHECK (public.is_super_admin_user(auth.uid()));

DROP POLICY IF EXISTS "anyone_can_report" ON public.reports;
CREATE POLICY "anyone_can_report" ON public.reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "admins_read_reports" ON public.reports;
CREATE POLICY "admins_read_reports" ON public.reports
  FOR SELECT USING (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "admins_update_reports" ON public.reports;
CREATE POLICY "admins_update_reports" ON public.reports
  FOR UPDATE USING (public.is_admin_user(auth.uid()));
