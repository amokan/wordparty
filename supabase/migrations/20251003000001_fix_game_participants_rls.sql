-- Fix RLS policy for game_participants to allow hosts to add all participants
-- when creating a game

-- Drop the existing restrictive policy
drop policy if exists "Users can join games in their room" on public.game_participants;

-- Create a new policy that allows:
-- 1. Users to join games themselves (self-insertion)
-- 2. Room hosts to add participants when creating games
create policy "Users can join games or hosts can add participants"
  on public.game_participants for insert
  with check (
    -- Case 1: User is adding themselves to a game in their room
    (
      (select auth.uid()) = user_id
      and exists (
        select 1 from public.games
        join public.room_participants on games.room_id = room_participants.room_id
        where games.id = game_id
        and room_participants.user_id = (select auth.uid())
      )
    )
    or
    -- Case 2: Host is adding participants when starting a game
    (
      exists (
        select 1 from public.games
        join public.rooms on games.room_id = rooms.id
        where games.id = game_id
        and rooms.host_id = (select auth.uid())
      )
      and exists (
        select 1 from public.room_participants
        join public.games on room_participants.room_id = games.room_id
        where games.id = game_id
        and room_participants.user_id = game_participants.user_id
      )
    )
  );