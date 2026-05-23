create table if not exists public.memo_habit_occurrences (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.comments(id) on delete cascade,
  owner_user_id uuid not null,
  visibility text not null default 'public'
    check (visibility in ('public', 'admin_only')),
  item_key text not null,
  item_label text not null,
  line_text text not null,
  due_at timestamp with time zone not null,
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'missed', 'delayed')),
  reminder_sent_at timestamp with time zone,
  completed_at timestamp with time zone,
  delayed_to timestamp with time zone,
  completion_source text
    check (completion_source in ('manual_check', 'reminder_confirm')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default timezone('utc', now()),
  updated_at timestamp with time zone not null default timezone('utc', now()),
  unique (note_id, item_key, due_at)
);

create index if not exists idx_memo_habit_occurrences_owner_due
  on public.memo_habit_occurrences (owner_user_id, due_at desc);

create index if not exists idx_memo_habit_occurrences_owner_status
  on public.memo_habit_occurrences (owner_user_id, status, due_at desc);

create index if not exists idx_memo_habit_occurrences_note_item
  on public.memo_habit_occurrences (note_id, item_key, due_at desc);