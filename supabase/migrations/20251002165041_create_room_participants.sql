-- Create room_participants table (tracks who's in each room lobby)
create table public.room_participants (
  room_id uuid references public.rooms(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (room_id, user_id)
);

-- Enable RLS
alter table public.room_participants enable row level security;

-- RLS Policies
create policy "Room participants are viewable by everyone"
  on public.room_participants for select
  using (true);

create policy "Users can join rooms"
  on public.room_participants for insert
  with check ((select auth.uid()) = user_id);

create policy "Users can leave rooms"
  on public.room_participants for delete
  using ((select auth.uid()) = user_id);

-- Create indexes for performance
create index idx_room_participants_room on public.room_participants(room_id);
create index idx_room_participants_user on public.room_participants(user_id);
