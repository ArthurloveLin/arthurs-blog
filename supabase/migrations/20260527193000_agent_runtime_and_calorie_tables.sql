create table if not exists public.agent_threads (
  id uuid primary key default gen_random_uuid(),
  app_key text not null check (char_length(trim(app_key)) > 0),
  task_key text not null check (char_length(trim(task_key)) > 0),
  owner_user_id uuid references auth.users(id) on delete cascade,
  title text,
  status text not null default 'active'
    check (status in ('active', 'archived', 'closed')),
  metadata jsonb not null default '{}'::jsonb,
  latest_run_id uuid,
  created_at timestamp with time zone not null default timezone('utc', now()),
  updated_at timestamp with time zone not null default timezone('utc', now())
);

create table if not exists public.agent_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.agent_threads(id) on delete cascade,
  role text not null check (role in ('system', 'user', 'assistant', 'tool')),
  text_content text,
  structured_content jsonb not null default '{}'::jsonb,
  source_kind text not null default 'manual'
    check (source_kind in ('manual', 'upload', 'runtime', 'system_seed')),
  created_at timestamp with time zone not null default timezone('utc', now()),
  check (
    coalesce(length(trim(text_content)), 0) > 0
    or structured_content <> '{}'::jsonb
  )
);

create table if not exists public.agent_attachments (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.agent_threads(id) on delete cascade,
  message_id uuid references public.agent_messages(id) on delete set null,
  media_type text not null,
  storage_backend text not null
    check (storage_backend in ('r2', 'local')),
  storage_key text not null,
  public_url text,
  local_cache_path text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default timezone('utc', now())
);

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.agent_threads(id) on delete cascade,
  app_key text not null check (char_length(trim(app_key)) > 0),
  task_key text not null check (char_length(trim(task_key)) > 0),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed', 'needs_confirmation', 'cancelled')),
  prompt_version text,
  knowledge_version text,
  request_payload jsonb not null default '{}'::jsonb,
  parsed_output jsonb not null default '{}'::jsonb,
  raw_stdout text,
  raw_stderr text,
  error_message text,
  started_at timestamp with time zone,
  finished_at timestamp with time zone,
  created_at timestamp with time zone not null default timezone('utc', now())
);

alter table public.agent_threads
  drop constraint if exists agent_threads_latest_run_id_fkey;

alter table public.agent_threads
  add constraint agent_threads_latest_run_id_fkey
  foreign key (latest_run_id) references public.agent_runs(id) on delete set null;

create index if not exists idx_agent_threads_owner_updated
  on public.agent_threads (owner_user_id, updated_at desc);

create index if not exists idx_agent_threads_app_task
  on public.agent_threads (app_key, task_key, created_at desc);

create index if not exists idx_agent_messages_thread_created
  on public.agent_messages (thread_id, created_at asc);

create index if not exists idx_agent_attachments_thread_created
  on public.agent_attachments (thread_id, created_at desc);

create index if not exists idx_agent_runs_thread_created
  on public.agent_runs (thread_id, created_at desc);

create index if not exists idx_agent_runs_status_created
  on public.agent_runs (status, created_at desc);

create table if not exists public.calorie_day_logs (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  target_calories integer not null default 1900,
  target_protein_g numeric(10, 2) not null default 130,
  target_gap_min integer not null default 300,
  target_gap_max integer not null default 400,
  status text not null default 'open'
    check (status in ('open', 'locked', 'archived')),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  latest_summary_run_id uuid references public.agent_runs(id) on delete set null,
  created_at timestamp with time zone not null default timezone('utc', now()),
  updated_at timestamp with time zone not null default timezone('utc', now()),
  unique (owner_user_id, log_date)
);

create table if not exists public.calorie_meals (
  id uuid primary key default gen_random_uuid(),
  day_log_id uuid not null references public.calorie_day_logs(id) on delete cascade,
  meal_type text not null
    check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack', 'custom')),
  meal_label text,
  occurred_at timestamp with time zone,
  source_thread_id uuid references public.agent_threads(id) on delete set null,
  source_message_id uuid references public.agent_messages(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default timezone('utc', now()),
  updated_at timestamp with time zone not null default timezone('utc', now())
);

create table if not exists public.calorie_entries (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.calorie_meals(id) on delete cascade,
  food_name text not null,
  food_alias text,
  quantity_text text,
  grams numeric(10, 2),
  calories numeric(10, 2),
  protein_g numeric(10, 2),
  fat_g numeric(10, 2),
  carbs_g numeric(10, 2),
  fiber_g numeric(10, 2),
  sugar_g numeric(10, 2),
  sodium_mg numeric(10, 2),
  estimate_level text not null default 'estimated'
    check (estimate_level in ('confirmed', 'database', 'estimated')),
  source_kind text not null default 'agent'
    check (source_kind in ('agent', 'knowledge_db', 'reference_override', 'ocr', 'manual')),
  source_ref jsonb not null default '{}'::jsonb,
  confidence_score numeric(5, 4),
  needs_review boolean not null default true,
  created_at timestamp with time zone not null default timezone('utc', now()),
  updated_at timestamp with time zone not null default timezone('utc', now())
);

create table if not exists public.calorie_reference_overrides (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  canonical_name text not null,
  aliases text[] not null default '{}'::text[],
  nutrition jsonb not null default '{}'::jsonb,
  source_attachment_id uuid references public.agent_attachments(id) on delete set null,
  source_run_id uuid references public.agent_runs(id) on delete set null,
  status text not null default 'active'
    check (status in ('active', 'archived')),
  created_at timestamp with time zone not null default timezone('utc', now()),
  updated_at timestamp with time zone not null default timezone('utc', now())
);

create index if not exists idx_calorie_day_logs_owner_date
  on public.calorie_day_logs (owner_user_id, log_date desc);

create index if not exists idx_calorie_meals_day_occurred
  on public.calorie_meals (day_log_id, occurred_at asc);

create index if not exists idx_calorie_entries_meal_created
  on public.calorie_entries (meal_id, created_at asc);

create index if not exists idx_calorie_reference_overrides_owner_name
  on public.calorie_reference_overrides (owner_user_id, canonical_name);

create index if not exists idx_calorie_reference_overrides_aliases
  on public.calorie_reference_overrides using gin (aliases);

alter table public.agent_threads enable row level security;
alter table public.agent_messages enable row level security;
alter table public.agent_attachments enable row level security;
alter table public.agent_runs enable row level security;
alter table public.calorie_day_logs enable row level security;
alter table public.calorie_meals enable row level security;
alter table public.calorie_entries enable row level security;
alter table public.calorie_reference_overrides enable row level security;