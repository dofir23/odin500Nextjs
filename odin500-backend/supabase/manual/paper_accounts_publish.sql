-- Publish / unpublish paper portfolios for public read-only gallery.
-- Run in Supabase SQL editor.

alter table public.paper_accounts
  add column if not exists is_published boolean not null default false,
  add column if not exists published_at timestamptz null,
  add column if not exists publish_description text null,
  add column if not exists publish_strategy text null;

create index if not exists idx_paper_accounts_published
  on public.paper_accounts (is_published, published_at desc nulls last)
  where is_published = true;
