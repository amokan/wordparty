-- Trigger on games table for template selection
create or replace function public.check_template_selected()
returns trigger
security definer
language plpgsql
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
      NEW.status := 'playing';
      NEW.started_at := now();

      -- Broadcast game start via realtime
      perform realtime.broadcast_changes(
        'game:' || NEW.id::text,
        'UPDATE',
        'games',
        row_to_json(NEW),
        row_to_json(OLD)
      );
    end if;
  end if;

  return NEW;
end;
$$;

create trigger check_template_trigger
before update of template_id
on public.games
for each row
execute function public.check_template_selected();
