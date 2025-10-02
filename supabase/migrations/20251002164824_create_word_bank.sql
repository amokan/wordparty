-- Create word_bank table for example words
create table public.word_bank (
  id uuid primary key default uuid_generate_v4(),
  word citext unique not null,
  type word_type not null,
  active boolean default true,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.word_bank enable row level security;

-- RLS Policies - Public read access to active words
create policy "Active words are viewable by everyone"
  on public.word_bank for select
  using (active = true);

-- Create indexes for performance
create index idx_word_bank_type on public.word_bank(type);
create index idx_word_bank_active on public.word_bank(type, active);
