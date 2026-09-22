begin;

-- ============================================================
-- FILM FESTIVAL OS™
-- Migration 071 — Public Award Verification™
--
-- Public-safe verification only.
-- No entrant email, jury scores, private notes or internal data.
-- Only published awards can be returned.
-- ============================================================

create or replace function public.get_public_award_verification(
  p_award_id uuid
)
returns table (
  award_id uuid,
  verified boolean,
  festival_name text,
  project_title text,
  creator_name text,
  award_name text,
  result_status text,
  placement text,
  design_style text,
  award_year integer,
  verification_code text,
  asset_url text,
  nft_url text,
  marketplace_url text,
  published_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$

  select
    a.id as award_id,

    true as verified,

    coalesce(
      fp.festival_name,
      t.name,
      'Film Festival OS™'
    )::text as festival_name,

    s.title::text as project_title,

    nullif(
      trim(
        coalesce(
          s.filmmaker_name,
          ''
        )
      ),
      ''
    )::text as creator_name,

    a.award_name::text,

    a.result_status::text,

    coalesce(
      lo.placement,
      case
        when lower(
          coalesce(
            a.result_status,
            ''
          )
        ) = 'winner'
          then 'winner'
        else lower(
          replace(
            coalesce(
              a.result_status,
              'award'
            ),
            ' ',
            '_'
          )
        )
      end
    )::text as placement,

    coalesce(
      lo.design_style,
      'golden'
    )::text as design_style,

    extract(
      year from coalesce(
        a.published_at,
        a.decided_at,
        a.updated_at,
        now()
      )
    )::integer as award_year,

    lo.verification_code::text,

    lo.asset_url::text,

    lo.nft_url::text,

    lo.marketplace_url::text,

    a.published_at

  from public.awards a

  join public.submissions s
    on s.id = a.submission_id
   and s.tenant_id = a.tenant_id

  join public.tenants t
    on t.id = a.tenant_id

  left join lateral (
    select
      p.festival_name
    from public.festival_profiles p
    where p.tenant_id = a.tenant_id
    limit 1
  ) fp on true

  left join lateral (
    select
      l.verification_code,
      l.placement,
      l.design_style,
      l.asset_url,
      l.nft_url,
      l.marketplace_url
    from public.laurel_outputs l
    where l.award_id = a.id
      and l.tenant_id = a.tenant_id
    order by
      l.generated_at desc nulls last,
      l.updated_at desc nulls last
    limit 1
  ) lo on true

  where a.id = p_award_id
    and a.publication_status = 'published'

  limit 1;

$$;


revoke all
on function public.get_public_award_verification(uuid)
from public;

grant execute
on function public.get_public_award_verification(uuid)
to anon, authenticated;


comment on function public.get_public_award_verification(uuid) is
'Public-safe Film Festival OS award verification. Returns published award identity only; excludes private entrant, jury and internal tenant information.';


notify pgrst, 'reload schema';

commit;
