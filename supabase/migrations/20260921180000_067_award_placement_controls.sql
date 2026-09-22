begin;

alter table public.festival_categories
  add column if not exists winner_enabled boolean not null default true,
  add column if not exists second_place_enabled boolean not null default true,
  add column if not exists third_place_enabled boolean not null default true,
  add column if not exists jury_choice_enabled boolean not null default true,
  add column if not exists audience_choice_enabled boolean not null default true,
  add column if not exists special_recognition_enabled boolean not null default true;

notify pgrst, 'reload schema';

commit;
