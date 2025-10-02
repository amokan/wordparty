-- Create story_templates table
create table public.story_templates (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  template jsonb not null,
  category citext,
  active boolean default true,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.story_templates enable row level security;

-- RLS Policies - Public read access to active templates
create policy "Active templates are viewable by everyone"
  on public.story_templates for select
  using (active = true);

-- Create indexes for performance
create index idx_templates_category on public.story_templates(category);
create index idx_templates_active on public.story_templates(category, active);

-- Add comment explaining template structure
comment on column public.story_templates.template is
'JSONB structure: {"story": "Once upon a time in {0}...", "placeholders": [{"position": 0, "type": "noun-place-name"}]}';
