-- Drop calorie tables first (reference agent tables via FK)
drop table if exists public.calorie_entries cascade;
drop table if exists public.calorie_meals cascade;
drop table if exists public.calorie_day_logs cascade;
drop table if exists public.calorie_reference_overrides cascade;

-- Drop agent tables (agent_runs and agent_messages reference agent_threads)
drop table if exists public.agent_runs cascade;
drop table if exists public.agent_attachments cascade;
drop table if exists public.agent_messages cascade;
drop table if exists public.agent_threads cascade;

-- Remove the orphaned migration record so history stays clean
delete from supabase_migrations.schema_migrations where version = '20260527193000';
