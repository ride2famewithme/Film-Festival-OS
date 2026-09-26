-- Film Festival OS™ — staged migration 096
-- Protect submitted jury review rows before the final result is locked.
-- Does not alter existing reviews. Apply to live Supabase only after separate approval.

create or replace function public.enforce_submitted_jury_review_immutability()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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
before update or delete on public.jury_reviews
for each row
execute function public.enforce_submitted_jury_review_immutability();
