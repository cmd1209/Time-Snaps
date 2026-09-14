-- Already applied manually to the initial project. Run once for a new project.
create table public.calendars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null default 'Unnamed Calendar',
  calendar_url text not null,
  created_at timestamptz not null default now()
);
create index calendars_user_id_idx on public.calendars(user_id);
alter table public.calendars enable row level security;
revoke all on public.calendars from anon;
grant select, insert, update, delete on public.calendars to authenticated;
create policy "Read own calendars" on public.calendars for select to authenticated using (auth.uid() = user_id);
create policy "Insert own calendars" on public.calendars for insert to authenticated with check (auth.uid() = user_id);
create policy "Update own calendars" on public.calendars for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Delete own calendars" on public.calendars for delete to authenticated using (auth.uid() = user_id);
