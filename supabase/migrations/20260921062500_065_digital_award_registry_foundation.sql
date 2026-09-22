begin;

-- CATEGORY-LEVEL DEFAULT CONTROLS
-- All default ON, as approved.
alter table public.festival_categories
  add column if not exists award_enabled boolean not null default true,
  add column if not exists nft_award_enabled boolean not null default true,
  add column if not exists winner_design_style text not null default 'golden';

-- INDIVIDUAL PUBLISHED AWARD / LAUREL OUTPUT CONTROLS
alter table public.laurel_outputs
  add column if not exists award_enabled boolean not null default true,
  add column if not exists nft_enabled boolean not null default true,
  add column if not exists placement text not null default 'winner',
  add column if not exists design_style text not null default 'golden',
  add column if not exists asset_url text,
  add column if not exists nft_url text,
  add column if not exists marketplace_url text;

comment on column public.festival_categories.award_enabled is
  'Season/event switch. Default ON. Authorised management may disable an award category without deleting it.';

comment on column public.festival_categories.nft_award_enabled is
  'Default ON. Controls whether this category normally receives a digital/NFT award.';

comment on column public.festival_categories.winner_design_style is
  'Winner design default. FFOS standard is golden.';

comment on column public.laurel_outputs.placement is
  'winner, second_place, third_place, jury_choice, audience_choice or special_recognition';

comment on column public.laurel_outputs.design_style is
  'golden, platinum, diamond, ruby, sapphire, emerald, pearl, silver, bronze or special design';

notify pgrst, 'reload schema';

commit;
