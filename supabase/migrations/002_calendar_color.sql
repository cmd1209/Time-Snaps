-- Run once in the Supabase SQL Editor. Existing ownership policies still apply.
alter table public.calendars
  add column color text
  check (color is null or color ~ '^#[0-9A-Fa-f]{6}$');
