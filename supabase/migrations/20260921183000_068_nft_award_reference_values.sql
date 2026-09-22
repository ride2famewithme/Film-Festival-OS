begin;

alter table public.festival_categories
  add column if not exists winner_reference_eth numeric(18,8) not null default 0.00300000,
  add column if not exists second_place_reference_eth numeric(18,8) not null default 0.00050000,
  add column if not exists third_place_reference_eth numeric(18,8) not null default 0.00025000,
  add column if not exists jury_choice_reference_eth numeric(18,8) not null default 0.00020000,
  add column if not exists audience_choice_reference_eth numeric(18,8) not null default 0.00020000,
  add column if not exists special_recognition_reference_eth numeric(18,8) not null default 0.00010000;

notify pgrst, 'reload schema';

commit;
