-- Function to check if all participants are ready and template is selected
create or replace function public.check_game_start_conditions()
returns trigger
language plpgsql
security definer
set search_path = ''
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
    update public.games
    set status = 'playing', started_at = now()
    where id = NEW.game_id and status = 'waiting';

    -- Broadcast game start via realtime
    perform realtime.broadcast_changes(
      'game:' || NEW.game_id::text,
      'UPDATE',
      'games',
      (select row_to_json(g.*) from public.games g where g.id = NEW.game_id),
      null
    );
  end if;

  return NEW;
end;
$$;

-- Trigger on game_participants updates to check start conditions
create trigger check_game_start_trigger
after insert or update of is_ready
on public.game_participants
for each row
execute function public.check_game_start_conditions();
