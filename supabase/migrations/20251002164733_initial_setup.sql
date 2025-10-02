-- Ensure required extensions are in place
create extension if not exists "uuid-ossp" schema extensions;
create extension if not exists "citext" schema extensions;

-- Create custom types for game status
create type game_status as enum ('waiting', 'playing', 'finished');

-- Create custom type for word types (matching traditional Mad Libs categories)
create type word_type as enum (
  'adjective',
  'adverb',
  'noun',
  'noun-plural',
  'noun-person-name',
  'noun-place-name',
  'verb',
  'verb-ending-in-ing',
  'verb-past-tense',
  'body-part',
  'number',
  'color',
  'animal',
  'food',
  'exclamation'
);
