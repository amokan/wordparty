create table public.completed_stories (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid unique references public.rooms(id) on delete cascade,
  final_text text not null,
  illustrations text[],
  created_at timestamptz default now()
);
