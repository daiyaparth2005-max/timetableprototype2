
REVOKE EXECUTE ON FUNCTION public.current_space_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_space_id() TO authenticated;
