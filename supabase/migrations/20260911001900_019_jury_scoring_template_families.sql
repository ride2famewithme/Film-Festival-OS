alter table public.jury_scoring_forms
add column if not exists template_family text not null default 'general_film',
add column if not exists division_key text not null default 'open',
add column if not exists description text,
add column if not exists is_master_template boolean not null default false;

alter table public.jury_scoring_forms
drop constraint if exists jury_scoring_forms_template_family_check;

alter table public.jury_scoring_forms
add constraint jury_scoring_forms_template_family_check
check (
  template_family in (
    'general_film',
    'documentary',
    'ai_film',
    'drone_film',
    'screenplay',
    'animation_2d',
    'animation_3d',
    'original_score',
    'music_video',
    'sound_sfx',
    'custom'
  )
);

create index if not exists jury_scoring_forms_family_idx
on public.jury_scoring_forms (
  tenant_id,
  template_family,
  division_key,
  status
);
