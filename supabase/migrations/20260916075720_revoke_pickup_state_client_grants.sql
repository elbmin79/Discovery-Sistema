-- Defense in depth: match pickup_history / pickup_late_history.
-- Admin dashboard history uses getSupabaseAdmin() (service_role) + query_pickup_history RPC;
-- this revoke does not touch service_role or history tables.
revoke all on table public.pickup_state from anon, authenticated;
grant all on table public.pickup_state to service_role;
