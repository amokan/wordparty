-- Create completed_stories table (final stories with AI-generated images)
create table public.completed_stories (
  id uuid primary key default gen_random_uuid(),
  game_id uuid unique references public.games(id) on delete cascade,
  story_text text not null,
  image_urls text[],
  images_generated boolean default false,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.completed_stories enable row level security;

-- RLS Policies
create policy "Completed stories are viewable by game participants"
  on public.completed_stories for select
  using (
    exists (
      select 1 from public.game_participants
      where game_participants.game_id = completed_stories.game_id
      and game_participants.user_id = (select auth.uid())
    )
  );

create policy "System can insert completed stories"
  on public.completed_stories for insert
  with check (true);

create policy "System can update completed stories"
  on public.completed_stories for update
  using (true);

-- Create indexes for performance
create index idx_completed_stories_game on public.completed_stories(game_id);
create index idx_completed_stories_images_generated on public.completed_stories(images_generated);
