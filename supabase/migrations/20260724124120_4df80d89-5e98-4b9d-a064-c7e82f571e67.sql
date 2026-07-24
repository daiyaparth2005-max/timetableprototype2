
DROP POLICY IF EXISTS "Users can view their own workspace" ON public.workspace_data;
DROP POLICY IF EXISTS "Users can update their own workspace" ON public.workspace_data;
DROP POLICY IF EXISTS "Users read own workspace" ON public.workspace_data;
DROP POLICY IF EXISTS "Users update own workspace" ON public.workspace_data;

DROP FUNCTION IF EXISTS public.current_space_id() CASCADE;

CREATE POLICY "Users read own workspace"
ON public.workspace_data
FOR SELECT
TO authenticated
USING (space_id = CASE (auth.jwt() ->> 'email')
  WHEN 'test1@timetablemaster.local' THEN 'space1'
  WHEN 'test2@timetablemaster.local' THEN 'space2'
  ELSE NULL
END);

CREATE POLICY "Users update own workspace"
ON public.workspace_data
FOR UPDATE
TO authenticated
USING (space_id = CASE (auth.jwt() ->> 'email')
  WHEN 'test1@timetablemaster.local' THEN 'space1'
  WHEN 'test2@timetablemaster.local' THEN 'space2'
  ELSE NULL
END)
WITH CHECK (space_id = CASE (auth.jwt() ->> 'email')
  WHEN 'test1@timetablemaster.local' THEN 'space1'
  WHEN 'test2@timetablemaster.local' THEN 'space2'
  ELSE NULL
END);
