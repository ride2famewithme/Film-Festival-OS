-- Film Festival OS™
-- Jury Scoring Criteria Immutability Hard Control
-- Prevent modification or deletion once a scoring form leaves draft status.

create or replace function public.enforce_jury_scoring_criterion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  form_tenant uuid;
  form_status text;
  old_form_status text;
  existing_weight numeric := 0;
begin
  if tg_op = 'UPDATE' then
    select status
    into old_form_status
    from public.jury_scoring_forms
    where id = old.form_id;

    if not found then
      raise exception 'Original scoring form does not exist.';
    end if;

    if old_form_status <> 'draft' then
      raise exception
        'Scoring criteria may only be changed while the form is in draft status.';
    end if;

    if new.form_id is distinct from old.form_id then
      raise exception 'Scoring criteria cannot be moved between forms.';
    end if;

    if new.tenant_id is distinct from old.tenant_id then
      raise exception 'Scoring criterion tenant cannot be changed.';
    end if;
  end if;

  select tenant_id, status
  into form_tenant, form_status
  from public.jury_scoring_forms
  where id = new.form_id;

  if not found then
    raise exception 'Scoring form does not exist.';
  end if;

  if new.tenant_id <> form_tenant then
    raise exception 'Criterion tenant must match scoring form tenant.';
  end if;

  if form_status <> 'draft' then
    raise exception
      'Scoring criteria may only be changed while the form is in draft status.';
  end if;

  select coalesce(sum(weight_percent),0)
  into existing_weight
  from public.jury_scoring_criteria
  where form_id = new.form_id
    and id <> new.id;

  if existing_weight + new.weight_percent > 100 then
    raise exception
      'Total scoring criterion weighting cannot exceed 100 percent.';
  end if;

  new.updated_at := now();

  return new;
end;
$$;


create or replace function public.enforce_jury_scoring_criterion_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  form_status text;
begin
  select status
  into form_status
  from public.jury_scoring_forms
  where id = old.form_id;

  if not found then
    raise exception 'Scoring form does not exist.';
  end if;

  if form_status <> 'draft' then
    raise exception
      'Scoring criteria may only be deleted while the form is in draft status.';
  end if;

  return old;
end;
$$;


drop trigger if exists trg_enforce_jury_scoring_criterion_delete
on public.jury_scoring_criteria;

create trigger trg_enforce_jury_scoring_criterion_delete
before delete
on public.jury_scoring_criteria
for each row
execute function public.enforce_jury_scoring_criterion_delete();
