-- Update template selection trigger to allow single player mode

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

    -- If all participants are ready and at least 1 player (allow single player)
    if ready_participants = total_participants
       and total_participants >= 1 then

      -- Update game status to 'playing'
      -- Supabase realtime will automatically broadcast this change
      NEW.status := 'playing';
      NEW.started_at := now();
    end if;
  end if;

  return NEW;
end;
$$;