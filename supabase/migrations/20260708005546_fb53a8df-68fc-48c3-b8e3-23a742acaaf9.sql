
CREATE TABLE public.workspace_data (
  space_id TEXT NOT NULL PRIMARY KEY CHECK (space_id IN ('space1','space2')),
  staff JSONB NOT NULL DEFAULT '[]'::jsonb,
  subjects JSONB NOT NULL DEFAULT '[]'::jsonb,
  classes JSONB NOT NULL DEFAULT '[]'::jsonb,
  timetables JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.workspace_data (space_id) VALUES ('space1'), ('space2');

GRANT SELECT, INSERT, UPDATE ON public.workspace_data TO authenticated;
GRANT ALL ON public.workspace_data TO service_role;

ALTER TABLE public.workspace_data ENABLE ROW LEVEL SECURITY;

-- Any signed-in user (either shared account) can read/update any space row.
-- Isolation is enforced client-side by which space the user signed in as.
-- (Both accounts are trusted shared logins; this table has no PII.)
CREATE POLICY "Authenticated can read workspace_data"
  ON public.workspace_data FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can update workspace_data"
  ON public.workspace_data FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
