-- Copy portfolio: lineage columns + owner opt-out.
-- Run in Supabase SQL editor, then reload the API schema cache.
--
-- Backs POST /api/paper/portfolios/:id/copy and
--       GET  /api/public/paper/portfolios/:id/copy-preview
--
-- copied_from_snapshot stores the source holdings + prices at the moment of the copy.
-- It is deliberately denormalized: it must survive the source account being deleted or
-- unpublished, and it is the diff baseline if mirror/follow mode is added later.

alter table public.paper_accounts
  add column if not exists copied_from_account_id uuid null
    references public.paper_accounts(id) on delete set null,
  add column if not exists copied_at timestamptz null,
  add column if not exists copied_from_snapshot jsonb null,
  add column if not exists allow_copy boolean not null default true;

-- Powers the "copied N times" count on a published portfolio.
create index if not exists idx_paper_accounts_copied_from
  on public.paper_accounts (copied_from_account_id)
  where copied_from_account_id is not null;

-- A copy of a copy is fine, but an account may never point at itself.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_paper_accounts_copy_not_self') then
    alter table public.paper_accounts
      add constraint chk_paper_accounts_copy_not_self
      check (copied_from_account_id is null or copied_from_account_id <> id);
  end if;
end $$;
