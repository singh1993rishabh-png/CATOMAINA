-- ================================================================
-- CATOMAINA — Complete Schema + RLS Fix  (v5 — run this FRESH)
-- Run in: Supabase Dashboard → SQL Editor → Run All
-- ================================================================


-- ── 1. contest_results — ensure ALL required columns exist ─────
-- The table must have these columns for saving and insights to work

alter table if exists contest_results
  add column if not exists answers     jsonb        default null,
  add column if not exists total_marks integer      default 0,
  add column if not exists time_taken  integer      default 0,
  add column if not exists created_at  timestamptz  default now();

-- Drop the FK on contest_id so catquestion_sets UUIDs can be stored
alter table if exists contest_results
  drop constraint if exists contest_results_contest_id_fkey;

-- Ensure the UNIQUE constraint exists with the EXACT name the upsert uses
-- Drop first (handles renamed variants), then recreate
alter table if exists contest_results
  drop constraint if exists contest_results_user_id_contest_id_key;
alter table if exists contest_results
  drop constraint if exists contest_results_pkey_user_contest;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'contest_results_user_id_contest_id_key'
      and conrelid = 'contest_results'::regclass
  ) then
    alter table contest_results
      add constraint contest_results_user_id_contest_id_key
      unique (user_id, contest_id);
  end if;
exception when others then null;
end $$;


-- ── 2. profiles — time tracking + login tracking columns ────────
alter table if exists profiles
  add column if not exists today_secs    integer      default 0,
  add column if not exists today_date    date         default null,
  add column if not exists total_secs    integer      default 0,
  add column if not exists last_login_at timestamptz  default null;


-- ── 3. catquestions — solution columns ────────────────────────
alter table if exists catquestions
  add column if not exists solution_text      text default null,
  add column if not exists solution_image_url text default null,
  add column if not exists solution_video_url text default null;


-- ── 4. profiles RLS ───────────────────────────────────────────
drop policy if exists "Users can insert own profile"           on profiles;
drop policy if exists "Users can update own profile"           on profiles;
drop policy if exists "Users can read own profile"             on profiles;
drop policy if exists "Authenticated users read profiles"      on profiles;

create policy "Authenticated users read profiles"
  on profiles for select to authenticated using (true);

create policy "Users can insert own profile"
  on profiles for insert with check (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);


-- ── 5. contest_results RLS ────────────────────────────────────
alter table if exists contest_results enable row level security;

drop policy if exists "Users can insert own results"   on contest_results;
drop policy if exists "Users can update own results"   on contest_results;
drop policy if exists "Users can upsert own results"   on contest_results;
drop policy if exists "Anyone can read results"        on contest_results;

create policy "Anyone can read results"
  on contest_results for select to authenticated using (true);

create policy "Users can insert own results"
  on contest_results for insert with check (auth.uid() = user_id);

create policy "Users can update own results"
  on contest_results for update using (auth.uid() = user_id);


-- ── 6. contests RLS ───────────────────────────────────────────
alter table if exists contests enable row level security;
drop policy if exists "Anyone can read contests" on contests;
create policy "Anyone can read contests"
  on contests for select using (true);


-- ── 7. catquestion_sets & catquestions RLS ────────────────────
alter table if exists catquestion_sets enable row level security;
alter table if exists catquestions     enable row level security;

drop policy if exists "Anyone can read catquestion_sets"          on catquestion_sets;
drop policy if exists "Anyone can read catquestions"              on catquestions;
drop policy if exists "Authenticated can modify catquestion_sets" on catquestion_sets;
drop policy if exists "Authenticated can modify catquestions"     on catquestions;

create policy "Anyone can read catquestion_sets"
  on catquestion_sets for select using (true);

create policy "Anyone can read catquestions"
  on catquestions for select using (true);

create policy "Authenticated can modify catquestion_sets"
  on catquestion_sets for all to authenticated
  using (true) with check (true);

create policy "Authenticated can modify catquestions"
  on catquestions for all to authenticated
  using (true) with check (true);


-- ── 8. Refresh schema cache ───────────────────────────────────
notify pgrst, 'reload schema';


-- ================================================================
-- VERIFICATION QUERIES — run these after to confirm everything OK
-- ================================================================
-- select column_name, data_type from information_schema.columns
--   where table_name = 'contest_results'
--   order by ordinal_position;
--
-- select conname from pg_constraint
--   where conrelid = 'contest_results'::regclass;
-- ================================================================


-- ================================================================
-- STUDY MODULE (v1) — Topic Learning with PDF + Video + Practice
-- ================================================================

-- ── 9. study_topics ───────────────────────────────────────────
-- One row per learnable topic (e.g. "Percentages", "Para Jumbles")
create table if not exists study_topics (
  id              uuid primary key default gen_random_uuid(),
  subject_section text not null,          -- 'qa' | 'dilr' | 'varc'
  module          text not null,          -- e.g. 'Arithmetic'
  topic           text not null,          -- e.g. 'Percentages'
  description     text,                   -- short blurb shown on card
  difficulty      text default 'moderate',-- 'easy' | 'moderate' | 'hard'
  -- Content
  pdf_url         text,                   -- public URL to PDF (Supabase storage)
  video_url       text,                   -- YouTube link OR direct mp4 URL
  video_type      text default 'youtube', -- 'youtube' | 'upload'
  -- Meta
  estimated_mins  integer default 20,    -- reading+watch time hint
  is_published    boolean default false,  -- only published ones show to students
  created_at      timestamptz default now()
);

-- ── 10. study_questions ───────────────────────────────────────
-- Practice questions linked to a study topic (no negative marking)
create table if not exists study_questions (
  id              uuid primary key default gen_random_uuid(),
  topic_id        uuid references study_topics(id) on delete cascade,
  question_text   text not null,
  question_image_url text,
  question_type   text default 'mcq',    -- 'mcq' | 'tita'
  options         jsonb,                  -- [{id:'A',t:'...'}, ...] for MCQ
  correct_option  text not null,         -- 'A'|'B'|'C'|'D' or numeric string
  difficulty      text default 'moderate',
  solution_text   text,
  solution_image_url text,
  order_index     integer default 0,
  created_at      timestamptz default now()
);

-- ── 11. RLS for study tables ──────────────────────────────────
alter table study_topics    enable row level security;
alter table study_questions enable row level security;

-- Students: read published topics + their questions
drop policy if exists "Students read published topics"    on study_topics;
drop policy if exists "Students read study questions"     on study_questions;
drop policy if exists "Admins manage study topics"        on study_topics;
drop policy if exists "Admins manage study questions"     on study_questions;

create policy "Students read published topics"
  on study_topics for select using (is_published = true);

create policy "Students read study questions"
  on study_questions for select using (true);

create policy "Admins manage study topics"
  on study_topics for all to authenticated using (true) with check (true);

create policy "Admins manage study questions"
  on study_questions for all to authenticated using (true) with check (true);

notify pgrst, 'reload schema';
