-- Create games table (individual game sessions within rooms)
create table public.games (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid references public.rooms(id) on delete cascade,
  template_id uuid references public.story_templates(id) on delete set null,
  status game_status default 'waiting',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.games enable row level security;

-- RLS Policies
create policy "Games are viewable by everyone"
  on public.games for select
  using (true);

create policy "Room hosts can create games"
  on public.games for insert
  with check (
    exists (
      select 1 from public.rooms
      where rooms.id = room_id
      and rooms.host_id = (select auth.uid())
    )
  );

create policy "Room hosts can update their games"
  on public.games for update
  using (
    exists (
      select 1 from public.rooms
      where rooms.id = room_id
      and rooms.host_id = (select auth.uid())
    )
  );

-- Create indexes for performance
create index idx_games_room on public.games(room_id);
create index idx_games_status on public.games(room_id, status);
create index idx_games_template on public.games(template_id);
