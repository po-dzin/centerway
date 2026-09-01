alter table public.lms_authors
  add column if not exists profile_facts jsonb null,
  add column if not exists profile_blocks jsonb null,
  add column if not exists experience_badge text null,
  add column if not exists achievement_badge text null,
  add column if not exists consultation_enabled boolean not null default false,
  add column if not exists consultation_title text null,
  add column if not exists consultation_summary text null,
  add column if not exists consultation_points jsonb null,
  add column if not exists consultation_contact_url text null;

alter table public.lms_authors
  drop constraint if exists lms_authors_profile_facts_shape,
  add constraint lms_authors_profile_facts_shape check (
    profile_facts is null or (jsonb_typeof(profile_facts) = 'array' and jsonb_array_length(profile_facts) <= 6)
  ),
  drop constraint if exists lms_authors_profile_blocks_shape,
  add constraint lms_authors_profile_blocks_shape check (
    profile_blocks is null or (jsonb_typeof(profile_blocks) = 'array' and jsonb_array_length(profile_blocks) <= 12)
  ),
  drop constraint if exists lms_authors_consultation_points_shape,
  add constraint lms_authors_consultation_points_shape check (
    consultation_points is null or (jsonb_typeof(consultation_points) = 'array' and jsonb_array_length(consultation_points) <= 3)
  );

-- Move the founder facts already published on /consult into the shared author
-- row. COALESCE preserves any field filled before this migration is applied.
update public.lms_authors
set profile_facts = coalesce(profile_facts, '["12 років практики", "Магістр комплементарної медицини та інтегративної психології", "Інструктор з йоги та практикуючий йогін", "Засновник центру CenterWay", "Аюрведична дієтологія — Керала, Індія", "Заслужений натуропат Європи"]'::jsonb),
    profile_blocks = coalesce(profile_blocks, jsonb_build_array(
      jsonb_build_object(
        'id', 'story',
        'kind', 'text',
        'label', 'Про автора',
        'title', 'Мій шлях до CenterWay',
        'body', E'Привіт! Давайте знайомитись: я — Євгеній Корякін, дослідник і практик аюрведи, магістр комплементарної медицини і засновник центру CenterWay.\n\nУ дитинстві я хотів бути лікарем, а питання здоров’я і розвитку фізичної форми людини цікавили мене завжди. Любов до фізкультури і філософських наук підштовхнула мене до вивчення тіла людини як предмета вищого творіння.\n\nТехнічна освіта не задовольняла сутність мого внутрішнього світу. Я почав цікавитись йогою і масажем, а практики і філософія показали мені шлях. Масаж став провідником у світ тонкого устрою реальності — у світ без слів і концепцій.'
      ),
      jsonb_build_object(
        'id', 'education-path',
        'kind', 'timeline',
        'label', 'Освіта і шлях',
        'title', 'Від технічної освіти до системи CenterWay',
        'items', jsonb_build_array(
          'Київський політехнічний інститут, інформатика і обчислювальна техніка.',
          '2009 р. — базовий курс класичного, антицелюлітного і дитячого масажу; повний курс тайського масажу.',
          '2010–2011 рр. — Інститут натуральної медицини, Ганновер, спеціальність «бакалавр натуральної медицини».',
          '2010–2013 рр. — оздоровчий центр Healsyjoy: китайські масажні техніки, гуа-ша, хіромасаж живота, моделювання і лімфодренаж обличчя.',
          '2012 р. — Чакрапані аюрведа-клініка, напрям «аюрведична марма-терапія».',
          '2012–2013 рр. — Інститут міждисциплінарних досліджень і освіти, Ганновер: магістр комплементарної медицини і інтегративної психології.',
          'Магістерська робота: «Способи корекції ваги і очищення організму з допомогою засобів аюрведи».',
          '2014 р. — засновано центр CenterWay.',
          '2016 р. — Сіббі Керала Аюрведа-центр, Індія: аюрведична дієтологія, стиль життя і йога-терапія.',
          '2017 р. — орден «Заслужений натуропат Європи».'
        )
      )
    )),
    experience_badge = coalesce(experience_badge, '12 років практики'),
    achievement_badge = coalesce(achievement_badge, 'Засновник CenterWay'),
    consultation_enabled = true,
    consultation_title = coalesce(consultation_title, 'Аюрведична консультація'),
    consultation_summary = coalesce(consultation_summary, 'Персональна онлайн-консультація до 90 хвилин: стан, харчування, ритм і зрозумілий план на 2–4 тижні.'),
    consultation_points = coalesce(consultation_points, '["розбір поточного стану, конституції, харчування і ритму", "онлайн-зустріч тривалістю до 90 хвилин", "персональні пріоритети та план дій на 2–4 тижні"]'::jsonb),
    consultation_contact_url = coalesce(consultation_contact_url, 'https://t.me/E_Koriakin')
where slug = 'koriakin';

alter table public.lms_authors
  drop constraint if exists lms_authors_listed_badges_complete,
  add constraint lms_authors_listed_badges_complete check (
    listed = false
    or (
      nullif(btrim(experience_badge), '') is not null
      and nullif(btrim(achievement_badge), '') is not null
    )
  ) not valid,
  drop constraint if exists lms_authors_consultation_complete,
  add constraint lms_authors_consultation_complete check (
    consultation_enabled = false
    or (
      nullif(btrim(consultation_title), '') is not null
      and nullif(btrim(consultation_summary), '') is not null
      and nullif(btrim(consultation_contact_url), '') is not null
    )
  );

-- These two published programmes are the founder's catalogue. The separate
-- Short/IREM author flow is deliberately excluded.
update public.lms_courses c
set author_profile_id = a.id
from public.lms_authors a
where a.slug = 'koriakin'
  and c.slug in ('way21', 'natural-body')
  and c.author_profile_id is null;
