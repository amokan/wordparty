-- Function to check if game is complete and generate story
create or replace function public.check_game_completion()
returns trigger
security definer
language plpgsql
as $$
declare
  template_data jsonb;
  total_placeholders integer;
  submitted_words integer;
  final_story text;
  story_template text;
  placeholder_record record;
  replacement_word text;
begin
  -- Get the template for this game
  select st.template into template_data
  from public.games g
  join public.story_templates st on g.template_id = st.id
  where g.id = NEW.game_id;

  -- Count total placeholders needed
  select jsonb_array_length(template_data->'placeholders') into total_placeholders;

  -- Count submitted words for this game
  select count(*) into submitted_words
  from public.word_submissions
  where game_id = NEW.game_id;

  -- If all words are submitted, complete the game
  if submitted_words = total_placeholders then

    -- Start with the story template
    story_template := template_data->>'story';

    -- Replace each placeholder with submitted word
    for placeholder_record in
      select
        (p.value->>'position')::integer as position,
        ws.word
      from jsonb_array_elements(template_data->'placeholders') as p
      join public.word_submissions ws
        on ws.game_id = NEW.game_id
        and ws.position = (p.value->>'position')::integer
      order by (p.value->>'position')::integer
    loop
      story_template := replace(
        story_template,
        '{' || placeholder_record.position || '}',
        placeholder_record.word
      );
    end loop;

    final_story := story_template;

    -- Update game status to finished
    update public.games
    set status = 'finished', completed_at = now()
    where id = NEW.game_id;

    -- Create completed story record
    insert into public.completed_stories (game_id, story_text)
    values (NEW.game_id, final_story);

    -- Broadcast completion via realtime
    perform realtime.broadcast_changes(
      'game:' || NEW.game_id::text,
      'INSERT',
      'completed_stories',
      (select row_to_json(cs.*) from public.completed_stories cs where cs.game_id = NEW.game_id),
      null
    );
  end if;

  return NEW;
end;
$$;

-- Trigger on word_submissions to check completion
create trigger check_game_completion_trigger
after insert
on public.word_submissions
for each row
execute function public.check_game_completion();
