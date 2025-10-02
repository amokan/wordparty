-- Create word_submissions table (tracks submitted words during gameplay)
create table public.word_submissions (
  id uuid primary key default uuid_generate_v4(),
  game_id uuid references public.games(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  position integer not null,
  word text not null,
  word_bank_id uuid references public.word_bank(id) on delete set null,
  auto_submitted boolean default false,
  created_at timestamptz default now(),
  unique(game_id, position)
);

-- Enable RLS
alter table public.word_submissions enable row level security;

-- RLS Policies
create policy "Word submissions are viewable by game participants"
  on public.word_submissions for select
  using (
    exists (
      select 1 from public.game_participants
      where game_participants.game_id = word_submissions.game_id
      and game_participants.user_id = (select auth.uid())
    )
  );

create policy "Game participants can submit words"
  on public.word_submissions for insert
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.game_participants
      where game_participants.game_id = word_submissions.game_id
      and game_participants.user_id = (select auth.uid())
    )
  );

-- Create indexes for performance
create index idx_word_submissions_game on public.word_submissions(game_id);
create index idx_word_submissions_user on public.word_submissions(user_id);
create index idx_word_submissions_position on public.word_submissions(game_id, position);
