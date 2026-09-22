begin;

create unique index if not exists
festival_seasons_tenant_label_idx
on public.festival_seasons
(tenant_id, lower(label));

create or replace function public.rollover_festival_season(
  p_source_season_id uuid,
  p_new_label text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_new_season uuid;
  v_categories integer := 0;
  v_jurors integer := 0;
  v_benefits integer := 0;
begin

  select tenant_id
  into v_tenant
  from public.festival_seasons
  where id = p_source_season_id;

  if v_tenant is null then
    raise exception 'Source season not found';
  end if;

  if not (
    public.is_platform_admin()
    or public.has_tenant_role(
      v_tenant,
      array['festival_owner','festival_staff']
    )
  ) then
    raise exception 'Permission denied';
  end if;

  insert into public.festival_seasons(
    tenant_id,
    label,
    status,
    updated_at
  )
  values(
    v_tenant,
    btrim(p_new_label),
    'draft',
    now()
  )
  returning id into v_new_season;


  insert into public.festival_categories(
    tenant_id, season_id, name, status,
    currency, regular_fee,
    runtime_max_minutes, completion_year_min,
    rules_version, updated_at,
    award_enabled, nft_award_enabled,
    winner_design_style,
    winner_enabled, second_place_enabled,
    third_place_enabled, jury_choice_enabled,
    audience_choice_enabled,
    special_recognition_enabled,
    winner_reference_eth,
    second_place_reference_eth,
    third_place_reference_eth,
    jury_choice_reference_eth,
    audience_choice_reference_eth,
    special_recognition_reference_eth,
    nft_value_override_enabled
  )
  select
    tenant_id, v_new_season, name, status,
    currency, regular_fee,
    runtime_max_minutes, completion_year_min,
    case
      when btrim(p_new_label) ~ '^[0-9]{4}$'
        then btrim(p_new_label) || '.1'
      else rules_version
    end,
    now(),
    award_enabled, nft_award_enabled,
    winner_design_style,
    winner_enabled, second_place_enabled,
    third_place_enabled, jury_choice_enabled,
    audience_choice_enabled,
    special_recognition_enabled,
    winner_reference_eth,
    second_place_reference_eth,
    third_place_reference_eth,
    jury_choice_reference_eth,
    audience_choice_reference_eth,
    special_recognition_reference_eth,
    nft_value_override_enabled
  from public.festival_categories
  where tenant_id = v_tenant
    and season_id = p_source_season_id;

  get diagnostics v_categories = row_count;


  insert into public.jury_panel_members(
    tenant_id, season_id, auth_user_id,
    display_label, juror_kind,
    weight_percent, status,
    conflict_status, identity_visibility,
    consent_to_reveal,
    invited_at, recused_at,
    created_by, updated_at
  )
  select
    tenant_id, v_new_season, auth_user_id,
    display_label, juror_kind,
    weight_percent, 'invited',
    'clear', identity_visibility,
    false,
    now(), null,
    auth.uid(), now()
  from public.jury_panel_members
  where tenant_id = v_tenant
    and season_id = p_source_season_id;

  get diagnostics v_jurors = row_count;


  insert into public.benefit_codes(
    tenant_id, season_id, code,
    kind, value, status,
    usage_limit, uses_count,
    expires_at, category_id,
    updated_at
  )
  select
    b.tenant_id,
    v_new_season,
    b.code,
    b.kind,
    b.value,
    b.status,
    b.usage_limit,
    0,
    null,
    target.id,
    now()
  from public.benefit_codes b
  left join public.festival_categories source
    on source.id = b.category_id
  left join public.festival_categories target
    on target.tenant_id = b.tenant_id
   and target.season_id = v_new_season
   and lower(target.name) = lower(source.name)
  where b.tenant_id = v_tenant
    and b.season_id = p_source_season_id;

  get diagnostics v_benefits = row_count;


  return jsonb_build_object(
    'newSeasonId', v_new_season,
    'newLabel', btrim(p_new_label),
    'categoriesCopied', v_categories,
    'jurorsInvited', v_jurors,
    'benefitsCopied', v_benefits
  );

end;
$$;

revoke all on function
public.rollover_festival_season(uuid,text)
from public;

grant execute on function
public.rollover_festival_season(uuid,text)
to authenticated;

notify pgrst, 'reload schema';

commit;
