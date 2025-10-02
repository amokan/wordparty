create table public.story_templates (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  template jsonb not null,
  category text,
  created_at timestamptz default now()
);

create index idx_templates_category on public.story_templates(category);
