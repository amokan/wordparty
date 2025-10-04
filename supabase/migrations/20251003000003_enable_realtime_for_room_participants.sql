-- Enable realtime for game-related tables
-- This allows real-time updates for multiplayer functionality

-- Enable realtime for room participants (join/leave room updates)
alter publication supabase_realtime add table room_participants;

-- Enable realtime for games table (status changes, game start notifications)
alter publication supabase_realtime add table games;

-- Enable realtime for game participants (ready status, participant changes)
alter publication supabase_realtime add table game_participants;

-- Enable realtime for word submissions (word submission progress)
alter publication supabase_realtime add table word_submissions;

-- Enable realtime for completed stories (story completion notifications)
alter publication supabase_realtime add table completed_stories;