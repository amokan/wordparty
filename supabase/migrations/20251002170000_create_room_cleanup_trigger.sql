-- Function to delete room when last participant leaves
CREATE OR REPLACE FUNCTION public.cleanup_empty_room()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  participant_count integer;
BEGIN
  -- Count remaining participants in the room
  SELECT count(*) INTO participant_count
  FROM public.room_participants
  WHERE room_id = OLD.room_id;

  -- If no participants left, delete the room
  IF participant_count = 0 THEN
    DELETE FROM public.rooms WHERE id = OLD.room_id;
  END IF;

  RETURN OLD;
END;
$$;

-- Trigger to clean up empty rooms
CREATE TRIGGER cleanup_empty_room_trigger
AFTER DELETE ON public.room_participants
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_empty_room();
