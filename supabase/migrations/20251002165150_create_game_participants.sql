-- Create game_participants table (tracks players in each game)
create table public.game_participants (
  game_id uuid references public.games(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  is_ready boolean default false,
  words_assigned integer[], -- array of position numbers assigned to this player
  joined_at timestamptz default now(),
  primary key (game_id, user_id)
);

-- Enable RLS
alter table public.game_participants enable row level security;

-- RLS Policies
create policy "Game participants are viewable by everyone"
  on public.game_participants for select
  using (true);

create policy "Users can join games in their room"
  on public.game_participants for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.games
      join public.room_participants on games.room_id = room_participants.room_id
      where games.id = game_id
      and room_participants.user_id = auth.uid()
    )
  );

create policy "Users can update their own participant status"
  on public.game_participants for update
  using (auth.uid() = user_id);

-- Create indexes for performance
create index idx_game_participants_game on public.game_participants(game_id);
create index idx_game_participants_user on public.game_participants(user_id);
create index idx_game_participants_ready on public.game_participants(game_id, is_ready);
