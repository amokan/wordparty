-- Create users table linked to auth.users
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  avatar_url text,
  games_played integer default 0,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.users enable row level security;

-- RLS Policies
create policy "Public profiles are viewable by everyone"
  on public.users for select
  using (true);

create policy "Users can update own profile"
  on public.users for update
  using ((select auth.uid()) = id);

create policy "Users can insert own profile"
  on public.users for insert
  with check ((select auth.uid()) = id);

-- Create index for performance
create index idx_users_username on public.users(username);
