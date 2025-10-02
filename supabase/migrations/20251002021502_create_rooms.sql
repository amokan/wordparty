create table public.rooms (
  id uuid primary key default uuid_generate_v4(),
  code text unique not null,
  host_id uuid references public.users(id) on delete set null,
  template_id uuid references public.story_templates(id),
  status room_status default 'waiting',
  created_at timestamptz default now()
);

create index idx_rooms_code on public.rooms(code);

alter table public.rooms enable row level security;

create policy "Public can see room status and counts"
  on public.rooms for select
  using (true);
