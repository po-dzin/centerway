-- СОЦМЕРЕЖІ АВТОРА у вкладці «Про мене» (2026-10-16).
--
-- Зачем. G выбрал 16.10 (вариант A в «Хабы и типы продуктов»): контакт автора
-- на его публичной странице — это его соцсети и сайт, обычными ссылками во
-- вкладке «Про мене». Это не кнопка консультации: запрос на консультацию идёт
-- через форму платформы.
--
-- `social_links` — jsonb-массив до шести https-адресов в порядке, который
-- выбрал автор. Схема держит форму (массив, не больше шести), как у
-- `profile_facts`; сами адреса (https, хост с точкой) проверяет код
-- (`validateAuthor`, src/lms-core/author.ts).
-- NULL — ссылок нет. Политики не меняются: строку пишет только сервер.

alter table public.lms_authors
  add column if not exists social_links jsonb null;

alter table public.lms_authors
  drop constraint if exists lms_authors_social_links_shape,
  add constraint lms_authors_social_links_shape check (
    social_links is null or (jsonb_typeof(social_links) = 'array' and jsonb_array_length(social_links) <= 6)
  );

comment on column public.lms_authors.social_links is
  'Author''s own pages elsewhere (Instagram, Telegram, YouTube, a site), up to six https URLs, shown under «Про мене».';
