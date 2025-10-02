create table public.room_participants (
  room_id uuid references public.rooms(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (room_id, user_id)
);

alter table public.room_participants enable row level security;

create policy "See participants in your rooms only"
  on public.room_participants for select using (
    auth.uid() in (
      select user_id from public.room_participants rp
      where rp.room_id = room_participants.room_id
    )
  );

create index idx_room_participants_user on public.room_participants(user_id);
