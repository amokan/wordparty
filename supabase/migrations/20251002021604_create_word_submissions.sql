create table public.word_submissions (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid references public.rooms(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  prompt_id text not null,
  word text not null,
  submitted_at timestamptz default now()
);
