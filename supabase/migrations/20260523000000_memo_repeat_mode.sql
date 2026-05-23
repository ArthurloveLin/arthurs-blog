alter table comments
  add column if not exists repeat_mode text default 'once'
    check (repeat_mode in ('once', 'daily', 'weekdays', 'custom')),
  add column if not exists repeat_days integer[];
