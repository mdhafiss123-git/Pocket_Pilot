-- Daily reminder preferences for Pocket Pilot.
create table if not exists public.user_notification_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  daily_reminder_enabled boolean not null default false,
  reminder_time time not null default '09:00',
  updated_at timestamptz not null default now()
);

alter table public.user_notification_settings enable row level security;

drop policy if exists "own notification settings" on public.user_notification_settings;
create policy "own notification settings"
  on public.user_notification_settings
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
