-- Add missing index for word_bank_id foreign key in word_submissions table
-- This improves query performance for foreign key lookups and resolves the Supabase warning

create index if not exists idx_word_submissions_word_bank_id
  on public.word_submissions(word_bank_id);
