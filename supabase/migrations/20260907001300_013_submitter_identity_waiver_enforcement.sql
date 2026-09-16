-- Film Festival OS™
-- Migration 013 — Submitter Identity Waiver Enforcement
-- Reconstructed from verified live database
-- 08 Sep 2026


-- ============================================================
-- Benefit redemption identity linkage
-- ============================================================

alter table public.benefit_code_redemptions
add column if not exists submitter_identity_id uuid
references public.submitter_identities(id)
on delete set null;


-- ============================================================
-- Identity consistency enforcement
-- ============================================================

create or replace function
public.enforce_submitter_identity_waiver_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  identity_record public.submitter_identities%rowtype;
begin

  if new.submitter_identity_id is null then
    return new;
  end if;


  select *
  into identity_record
  from public.submitter_identities
  where id = new.submitter_identity_id
    and tenant_id = new.tenant_id;


  if not found then
    raise exception
      'Submitter identity does not belong to tenant.';
  end if;


  if identity_record.status = 'blocked' then
    raise exception
      'Blocked submitter identity cannot redeem benefit codes.';
  end if;


  if identity_record.verification_status = 'blocked' then
    raise exception
      'Blocked verification identity cannot redeem benefit codes.';
  end if;


  return new;

end;
$$;


drop trigger if exists
trg_enforce_submitter_identity_waiver_link
on public.benefit_code_redemptions;


create trigger
trg_enforce_submitter_identity_waiver_link
before insert or update
on public.benefit_code_redemptions
for each row
execute function
public.enforce_submitter_identity_waiver_link();



-- ============================================================
-- Identity index
-- ============================================================

create index if not exists
benefit_code_redemptions_submitter_identity_idx
on public.benefit_code_redemptions(submitter_identity_id);



grant select, insert, update
on public.benefit_code_redemptions
to authenticated;


