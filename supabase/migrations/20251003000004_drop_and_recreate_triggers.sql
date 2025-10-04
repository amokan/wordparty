-- Drop existing triggers and functions that are causing realtime.broadcast_changes errors
-- Then recreate them without the problematic broadcast calls

-- Drop existing triggers
drop trigger if exists check_game_start_trigger on public.game_participants;
drop trigger if exists check_template_trigger on public.games;

-- Drop existing functions
drop function if exists public.check_game_start_conditions();
drop function if exists public.check_template_selected();

-- Recreate the game start check function (without manual broadcasts)
create or replace function public.check_game_start_conditions()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  total_participants integer;
  ready_participants integer;
  game_template_id uuid;
  game_room_id uuid;
begin
  -- Get game details
  select template_id, room_id into game_template_id, game_room_id
  from public.games
  where id = NEW.game_id;

  -- Count total and ready participants
  select count(*), count(*) filter (where is_ready = true)
  into total_participants, ready_participants
  from public.game_participants
  where game_id = NEW.game_id;

  -- If all participants are ready, template is selected, and at least 2 players
  if ready_participants = total_participants
     and total_participants >= 2
     and game_template_id is not null then

    -- Update game status to 'playing'
    -- Supabase realtime will automatically broadcast this change
    update public.games
    set status = 'playing', started_at = now()
    where id = NEW.game_id and status = 'waiting';
  end if;

  return NEW;
end;
$$;

-- Recreate the template selection check function (without manual broadcasts)
create or replace function public.check_template_selected()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  total_participants integer;
  ready_participants integer;
begin
  -- Only proceed if template was just set and status is waiting
  if NEW.template_id is not null and OLD.template_id is null and NEW.status = 'waiting' then

    -- Count total and ready participants
    select count(*), count(*) filter (where is_ready = true)
    into total_participants, ready_participants
    from public.game_participants
    where game_id = NEW.id;

    -- If all participants are ready and at least 2 players
    if ready_participants = total_participants
       and total_participants >= 2 then

      -- Update game status to 'playing'
      -- Supabase realtime will automatically broadcast this change
      NEW.status := 'playing';
      NEW.started_at := now();
    end if;
  end if;

  return NEW;
end;
$$;

-- Recreate triggers
create trigger check_game_start_trigger
after insert or update of is_ready
on public.game_participants
for each row
execute function public.check_game_start_conditions();

create trigger check_template_trigger
before update of template_id
on public.games
for each row
execute function public.check_template_selected();