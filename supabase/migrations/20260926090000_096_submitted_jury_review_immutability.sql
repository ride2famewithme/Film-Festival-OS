-- Film Festival OS™ — staged migration 096
-- Protect submitted jury review rows before the final result is locked.
-- Does not alter existing reviews. Apply to live Supabase only after separate approval.
-- Direct clients may edit draft score/notes/recommendation only; submission uses
-- the trusted submit_criterion_jury_review RPC.

create or replace function public.enforce_submitted_jury_review_immutability()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' or new.submitted_at is not null then
      raise exception using
        errcode = '42501',
        message = 'Jury reviews must be created as drafts.';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception using
        errcode = '42501',
        message = 'Submitted jury reviews cannot be deleted.';
    end if;
    return old;
  end if;

  if old.status <> 'draft' then
    raise exception using
      errcode = '42501',
      message = 'Submitted jury reviews cannot be changed.';
  end if;

  if new.id is distinct from old.id
     or new.tenant_id is distinct from old.tenant_id
     or new.assignment_id is distinct from old.assignment_id
     or new.submission_id is distinct from old.submission_id
     or new.juror_user_id is distinct from old.juror_user_id then
    raise exception using
      errcode = '42501',
      message = 'Jury review identity cannot be changed.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_submitted_jury_review_immutability
on public.jury_reviews;

create trigger trg_enforce_submitted_jury_review_immutability
before insert or update or delete on public.jury_reviews
for each row
execute function public.enforce_submitted_jury_review_immutability();

-- Remove the table-wide UPDATE privilege, which would otherwise override any
-- column-level restriction. The SECURITY DEFINER submission RPC runs with its
-- owner privileges and can still finalize the review atomically.
revoke update on table public.jury_reviews from authenticated;
revoke update on table public.jury_reviews from public;
grant update (score, recommendation, notes)
on table public.jury_reviews to authenticated;
