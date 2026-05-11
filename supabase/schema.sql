-- Sombra Supabase schema
-- Run this manually in the Supabase SQL editor for the shared project.
-- Codex must not execute this against Supabase directly.

create extension if not exists pgcrypto;

create table if not exists public.sombra_audit_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_type text not null default 'event',
  object_type text,
  object_id text,
  event jsonb not null default '{}'::jsonb
);

create index if not exists sombra_audit_events_created_at_idx
  on public.sombra_audit_events (created_at desc);

create index if not exists sombra_audit_events_event_type_idx
  on public.sombra_audit_events (event_type);

create index if not exists sombra_audit_events_object_idx
  on public.sombra_audit_events (object_type, object_id);

alter table public.sombra_audit_events enable row level security;

create table if not exists public.sombra_feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text,
  email text,
  organization text,
  interest_area text,
  objective text,
  payload jsonb not null default '{}'::jsonb
);

create index if not exists sombra_feedback_created_at_idx
  on public.sombra_feedback (created_at desc);

alter table public.sombra_feedback enable row level security;

comment on table public.sombra_audit_events is 'Sombra audit, decision, and investigation evidence events.';
comment on table public.sombra_feedback is 'Sombra open-source feedback and collaboration requests.';
