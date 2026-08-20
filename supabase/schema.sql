-- Web3 Brand Agent — Supabase schema
-- Run this in Supabase → SQL Editor.
-- Creates 4 tables: content_drafts, leads, topic_signals, agent_runs.

create extension if not exists pgcrypto;

-- Drafted X posts/threads (nothing is posted automatically)
create table if not exists content_drafts (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  content text not null,
  status text not null default 'draft',
  format text,
  context text,
  confidence text,
  created_at timestamptz not null default now()
);

-- Evaluated Web3 client leads
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  source text,
  project_name text,
  what_they_need text,
  score integer,
  legitimacy text,
  budget_signal text,
  fit text,
  red_flags text,
  contact_path text,
  pitch_angle text,
  confidence text,
  raw_text text,
  created_at timestamptz not null default now()
);

-- Reserved: trending topics worth drafting on (not used by agents yet)
create table if not exists topic_signals (
  id uuid primary key default gen_random_uuid(),
  topic text,
  signal text,
  created_at timestamptz not null default now()
);

-- Reserved: audit log of agent runs (not used by agents yet)
create table if not exists agent_runs (
  id uuid primary key default gen_random_uuid(),
  agent text,
  input text,
  output text,
  created_at timestamptz not null default now()
);

-- Auto-generated outreach emails (drafted, never sent automatically)
create table if not exists outreach (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  subject text,
  body text,
  to_email text,
  status text not null default 'draft',
  created_at timestamptz not null default now()
);

-- Dedupe: job postings already scanned by the sourcing pipeline
create table if not exists scanned_jobs (
  id uuid primary key default gen_random_uuid(),
  job_url text not null unique,
  created_at timestamptz not null default now()
);