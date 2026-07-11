
DROP POLICY IF EXISTS "Authenticated can read workspace_data" ON public.workspace_data;
DROP POLICY IF EXISTS "Authenticated can update workspace_data" ON public.workspace_data;

CREATE OR REPLACE FUNCTION public.current_space_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE (auth.jwt() ->> 'email')
    WHEN 'test1@timetablemaster.local' THEN 'space1'
    WHEN 'test2@timetablemaster.local' THEN 'space2'
    ELSE NULL
  END
$$;

CREATE POLICY "Users read own workspace"
ON public.workspace_data
FOR SELECT
TO authenticated
USING (space_id = public.current_space_id());

CREATE POLICY "Users update own workspace"
ON public.workspace_data
FOR UPDATE
TO authenticated
USING (space_id = public.current_space_id())
WITH CHECK (space_id = public.current_space_id());
