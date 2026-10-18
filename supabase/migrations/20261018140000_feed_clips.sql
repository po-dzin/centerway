-- СТРІЧКА: короткі відео-ролики в дописах (2026-10-18).
--
-- Зачем. G 18.10: автор може додати до допису власне коротке відео — до 30
-- секунд у Full HD. Файл іде напряму в бакет `feed-media` за одноразовою
-- адресою (він завеликий для запиту функції), тому бакет сам тримає межу:
-- до 60 МБ і лише відео типів, які грають усі браузери.
--
-- Аддитивно й повторюваний: змінює ліміт і дозволені типи бакета.
--
-- Відкат:
--   update storage.buckets set file_size_limit = 20971520,
--     allowed_mime_types = array['image/webp','image/gif','audio/webm','audio/mp4','audio/mpeg','audio/ogg']
--   where id = 'feed-media';

begin;

update storage.buckets
   set file_size_limit = 62914560,
       allowed_mime_types = array[
         'image/webp', 'image/gif',
         'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg',
         'video/mp4', 'video/webm', 'video/quicktime'
       ]
 where id = 'feed-media';

commit;
