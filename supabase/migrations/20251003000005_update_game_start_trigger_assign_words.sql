-- Update the game start trigger to assign word positions when all participants are ready

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
  template_data jsonb;
  total_positions integer;
  positions_per_player integer;
  remainder integer;
  current_position integer;
  participant_record record;
  participant_index integer;
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

  -- If all participants are ready, template is selected, and at least 1 player (single player mode allowed)
  if ready_participants = total_participants
     and total_participants >= 1
     and game_template_id is not null then

    -- Get template data to calculate word positions
    select template into template_data
    from public.story_templates
    where id = game_template_id;

    total_positions := jsonb_array_length(template_data->'placeholders');
    positions_per_player := total_positions / total_participants;
    remainder := total_positions % total_participants;
    current_position := 0;
    participant_index := 0;

    -- Assign word positions to all participants
    for participant_record in
      select user_id from public.game_participants
      where game_id = NEW.game_id
      order by user_id
    loop
      declare
        num_positions integer;
        assigned_positions integer[];
      begin
        -- Calculate number of positions for this participant
        num_positions := positions_per_player + (case when participant_index < remainder then 1 else 0 end);

        -- Create array of assigned positions
        assigned_positions := array(
          select current_position + i
          from generate_series(0, num_positions - 1) as i
        );

        -- Update participant with assigned positions
        update public.game_participants
        set words_assigned = assigned_positions
        where game_id = NEW.game_id and user_id = participant_record.user_id;

        current_position := current_position + num_positions;
        participant_index := participant_index + 1;
      end;
    end loop;

    -- Update game status to 'playing'
    update public.games
    set status = 'playing', started_at = now()
    where id = NEW.game_id and status = 'waiting';
  end if;

  return NEW;
end;
$$;