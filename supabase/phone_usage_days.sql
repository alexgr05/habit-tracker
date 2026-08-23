create table if not exists public.phone_usage_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  total_screen_minutes integer not null default 0,
  social_minutes integer not null default 0,
  late_night_minutes integer not null default 0,
  app_breakdown jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

alter table public.phone_usage_days enable row level security;

create policy "Users can read their own phone usage"
on public.phone_usage_days
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert their own phone usage"
on public.phone_usage_days
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own phone usage"
on public.phone_usage_days
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own phone usage"
on public.phone_usage_days
for delete
to authenticated
using (auth.uid() = user_id);

grant select, insert, update, delete on table public.phone_usage_days to authenticated;
