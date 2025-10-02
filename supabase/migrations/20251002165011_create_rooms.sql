-- Create rooms table (persistent lobbies)
create table public.rooms (
  id uuid primary key default uuid_generate_v4(),
  room_code text unique not null,
  host_id uuid references public.users(id) on delete set null,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.rooms enable row level security;

-- RLS Policies
create policy "Rooms are viewable by everyone"
  on public.rooms for select
  using (true);

create policy "Authenticated users can create rooms"
  on public.rooms for insert
  with check ((select auth.uid()) = host_id);

create policy "Host can update their room"
  on public.rooms for update
  using ((select auth.uid()) = host_id);

-- Create index for room code lookups
create index idx_rooms_code on public.rooms(room_code);
create index idx_rooms_host on public.rooms(host_id);
