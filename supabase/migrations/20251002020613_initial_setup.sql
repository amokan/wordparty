-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create custom type for room status
create type room_status as enum ('waiting', 'playing', 'finished');
