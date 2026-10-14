# Курс CenterWay з матеріалів — інструкція для нейронки

Один файл на все: завдання, правила, схема і приклад. Схема перевіряється тестом
у репозиторії, тож цей документ завжди відповідає тому, що приймає імпорт.

## Як користуватися

1. Відкрийте ChatGPT, Claude або Gemini.
2. Прикріпіть цей файл і свої матеріали (конспект, транскрипт, документ).
3. Напишіть: «Збери курс за інструкцією з файлу».
4. Збережіть відповідь як файл `.json`.
5. У Майстерні: Матеріали → Імпорт курсу → Вибрати JSON. Спершу буде перевірка,
   запис лише після підтвердження. Курс з’явиться як прихована чернетка.

Якщо імпорт покаже помилку, скопіюйте її текст у той самий чат і попросіть
виправити файл.

## Завдання для нейронки

Ти збираєш онлайн-курс для платформи CenterWay з матеріалів, які дав автор.
Поверни **один JSON-об’єкт**, що проходить JSON Schema нижче, в одному блоці
коду ```json і нічого поза ним.

Правила:

- Мова курсу українська (`"locale": "uk"`), звертання на «Ви».
- Голос CenterWay — цілісний погляд на здоров’я: тіло, емоції, розум, енергія,
  ритм. Спокійно, без тиску й без обіцянок вилікувати.
- Нічого не вигадуй. Якщо факту немає в матеріалах (ID відео, ціна, ім’я, строк
  доступу), постав маркер `[ЗАПОВНИ: що саме]`. Майстерня підсвітить його.
- Не пиши `id`, `slug`, `order`, `status`, `version` — платформа заповнить їх сама.
  Поля, яких немає в схемі, не додавай.
- Структура: курс → `modules` → `lessons` → `blocks`. Навіть один модуль
  загортається в масив `modules`.
- `title` курсу до 48 символів, `pretitle` до 44. Довгий заголовок документа
  (наприклад «Назва: пояснення») не вставляй у `title` цілком: коротка назва
  йде в `title`, пояснення — в `tagline`. Двокрапка назву й підзаголовок не ділить.
- Якщо матеріал — документ (.docx, стаття): розділи стають модулями або
  уроками, таблиця — блоком `table`, застереження й протипоказання —
  `boundary_note`, нумеровані кроки — `protocol_step`. Текст не скорочуй і не
  переписуй, лише розклади по блоках.
- `categories`: 2–3 значення зі списку в схемі.
- Щоденний курс (`"schedule": { "mode": "daily" }`): дні уроків можна не
  вказувати, вони підуть за порядком. Модулі-довідники (`"reference": true`)
  днів не мають.
- Кожен урок починається з `lesson_objective`: одне речення «навіщо цей урок».
- Звичайний текст — блок `rich_text` з абзацами `p`, підзаголовками `h3`,
  списками `ul` / `ol`. Текст — рядок або масив фрагментів
  `{ "text", "bold", "italic", "href" }`.
- Кроки протоколу — `protocol_step` з номером `step` від 1. Окрема практика —
  `practice_block`. Що зробити після уроку — `checklist`.
- Відео лише YouTube: `"provider": "youtube"` і `videoId` (11 символів з
  посилання). Без ID — маркер `[ЗАПОВНИ: ID відео YouTube]`.
- Зображення лише з реальним посиланням `https://…` і змістовним `alt`. Якщо
  посилання немає, блок не додавай.
- Будь-який урок з практикою для тіла, і будь-який щоденний курс, містить
  `boundary_note`: межі практики і коли зупинитися чи звернутися до лікаря.
- Для вітрини, якщо є з чого: `tagline`, `summary`, `audience` (для кого),
  `results` (що зміниться), `format` (що всередині), `accessNote` (строк доступу).

## JSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "CenterWay course import",
  "type": "object",
  "additionalProperties": false,
  "required": ["title", "modules"],
  "properties": {
    "title": { "type": "string", "minLength": 1, "maxLength": 48 },
    "pretitle": { "type": "string", "minLength": 1, "maxLength": 44 },
    "tagline": { "type": "string", "minLength": 1 },
    "summary": { "$ref": "#/$defs/inline" },
    "locale": { "enum": ["uk", "en"] },
    "kind": { "enum": ["course", "mini", "checklist"] },
    "categories": {
      "type": "array",
      "minItems": 2,
      "maxItems": 3,
      "uniqueItems": true,
      "items": {
        "enum": ["movement", "nutrition", "cleansing", "breathing", "meditation", "focus", "energy", "relaxation"]
      }
    },
    "durationDays": { "type": "integer", "minimum": 1, "maximum": 366 },
    "audience": { "$ref": "#/$defs/lines" },
    "results": { "$ref": "#/$defs/lines" },
    "format": { "$ref": "#/$defs/lines" },
    "accessNote": { "type": "string", "minLength": 1 },
    "authorNote": { "type": "string", "minLength": 1 },
    "schedule": {
      "type": "object",
      "additionalProperties": false,
      "required": ["mode"],
      "properties": {
        "mode": { "enum": ["open", "sequential", "daily"] },
        "start": { "enum": ["purchase", "date"] },
        "startDate": { "type": "string", "minLength": 1 },
        "gate": { "enum": ["soft", "hard"] },
        "reminderHour": { "type": "integer", "minimum": 0, "maximum": 23 }
      }
    },
    "modules": { "type": "array", "minItems": 1, "items": { "$ref": "#/$defs/module" } }
  },
  "$defs": {
    "span": {
      "type": "object",
      "additionalProperties": false,
      "required": ["text"],
      "properties": {
        "text": { "type": "string", "minLength": 1 },
        "bold": { "type": "boolean" },
        "italic": { "type": "boolean" },
        "href": { "type": "string", "pattern": "^(https?:|mailto:|tel:)" }
      }
    },
    "inline": {
      "anyOf": [
        { "type": "string", "minLength": 1 },
        { "type": "array", "minItems": 1, "items": { "$ref": "#/$defs/span" } }
      ]
    },
    "lines": { "type": "array", "minItems": 1, "items": { "type": "string", "minLength": 1 } },
    "list": { "type": "array", "minItems": 1, "items": { "$ref": "#/$defs/inline" } },
    "module": {
      "type": "object",
      "additionalProperties": false,
      "required": ["title", "lessons"],
      "properties": {
        "title": { "type": "string", "minLength": 1 },
        "reference": { "type": "boolean" },
        "lessons": { "type": "array", "minItems": 1, "items": { "$ref": "#/$defs/lesson" } }
      }
    },
    "lesson": {
      "type": "object",
      "additionalProperties": false,
      "required": ["title", "blocks"],
      "properties": {
        "title": { "type": "string", "minLength": 1 },
        "summary": { "$ref": "#/$defs/inline" },
        "durationMin": { "type": "integer", "minimum": 1 },
        "dayIndex": { "type": "integer", "minimum": 1 },
        "blocks": { "type": "array", "minItems": 1, "items": { "$ref": "#/$defs/block" } }
      }
    },
    "block": {
      "oneOf": [
        { "$ref": "#/$defs/lesson_objective" },
        { "$ref": "#/$defs/rich_text" },
        { "$ref": "#/$defs/protocol_step" },
        { "$ref": "#/$defs/practice_block" },
        { "$ref": "#/$defs/checklist" },
        { "$ref": "#/$defs/video" },
        { "$ref": "#/$defs/image" },
        { "$ref": "#/$defs/quote" },
        { "$ref": "#/$defs/boundary_note" },
        { "$ref": "#/$defs/faq_block" },
        { "$ref": "#/$defs/table" },
        { "$ref": "#/$defs/cta" }
      ]
    },
    "lesson_objective": {
      "type": "object",
      "additionalProperties": false,
      "required": ["type", "text"],
      "properties": { "type": { "const": "lesson_objective" }, "text": { "$ref": "#/$defs/inline" } }
    },
    "rich_text": {
      "type": "object",
      "additionalProperties": false,
      "required": ["type", "content"],
      "properties": {
        "type": { "const": "rich_text" },
        "content": {
          "type": "array",
          "minItems": 1,
          "items": {
            "oneOf": [
              {
                "type": "object",
                "additionalProperties": false,
                "required": ["kind", "text"],
                "properties": { "kind": { "enum": ["p", "h3"] }, "text": { "$ref": "#/$defs/inline" } }
              },
              {
                "type": "object",
                "additionalProperties": false,
                "required": ["kind", "items"],
                "properties": { "kind": { "enum": ["ul", "ol"] }, "items": { "$ref": "#/$defs/list" } }
              }
            ]
          }
        }
      }
    },
    "protocol_step": {
      "type": "object",
      "additionalProperties": false,
      "required": ["type", "step", "title"],
      "properties": {
        "type": { "const": "protocol_step" },
        "step": { "type": "integer", "minimum": 1 },
        "title": { "$ref": "#/$defs/inline" },
        "text": { "$ref": "#/$defs/inline" },
        "timing": { "type": "string" }
      }
    },
    "practice_block": {
      "type": "object",
      "additionalProperties": false,
      "required": ["type", "title"],
      "properties": {
        "type": { "const": "practice_block" },
        "title": { "$ref": "#/$defs/inline" },
        "text": { "$ref": "#/$defs/inline" },
        "durationMin": { "type": "number", "exclusiveMinimum": 0 }
      }
    },
    "checklist": {
      "type": "object",
      "additionalProperties": false,
      "required": ["type", "items"],
      "properties": {
        "type": { "const": "checklist" },
        "title": { "$ref": "#/$defs/inline" },
        "requiredForCompletion": { "type": "boolean" },
        "items": {
          "type": "array",
          "minItems": 1,
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": ["text"],
            "properties": { "text": { "$ref": "#/$defs/inline" } }
          }
        }
      }
    },
    "video": {
      "type": "object",
      "additionalProperties": false,
      "required": ["type", "provider", "videoId"],
      "properties": {
        "type": { "const": "video" },
        "provider": { "const": "youtube" },
        "videoId": { "type": "string", "minLength": 1 },
        "title": { "$ref": "#/$defs/inline" },
        "durationMin": { "type": "number", "exclusiveMinimum": 0 }
      }
    },
    "image": {
      "type": "object",
      "additionalProperties": false,
      "required": ["type", "src", "alt"],
      "properties": {
        "type": { "const": "image" },
        "src": { "type": "string", "pattern": "^(https?://|/)" },
        "alt": { "type": "string", "minLength": 1 },
        "caption": { "$ref": "#/$defs/inline" }
      }
    },
    "quote": {
      "type": "object",
      "additionalProperties": false,
      "required": ["type", "text"],
      "properties": {
        "type": { "const": "quote" },
        "text": { "$ref": "#/$defs/inline" },
        "author": { "type": "string" }
      }
    },
    "boundary_note": {
      "type": "object",
      "additionalProperties": false,
      "required": ["type", "text"],
      "properties": { "type": { "const": "boundary_note" }, "text": { "$ref": "#/$defs/inline" } }
    },
    "faq_block": {
      "type": "object",
      "additionalProperties": false,
      "required": ["type", "items"],
      "properties": {
        "type": { "const": "faq_block" },
        "items": {
          "type": "array",
          "minItems": 1,
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": ["question", "answer"],
            "properties": { "question": { "$ref": "#/$defs/inline" }, "answer": { "$ref": "#/$defs/inline" } }
          }
        }
      }
    },
    "table": {
      "type": "object",
      "additionalProperties": false,
      "required": ["type", "rows"],
      "properties": {
        "type": { "const": "table" },
        "title": { "$ref": "#/$defs/inline" },
        "head": { "$ref": "#/$defs/list" },
        "rows": {
          "type": "array",
          "minItems": 1,
          "items": {
            "type": "array",
            "minItems": 1,
            "items": {
              "anyOf": [
                { "$ref": "#/$defs/inline" },
                {
                  "type": "object",
                  "additionalProperties": false,
                  "required": ["kind", "items"],
                  "properties": {
                    "kind": { "enum": ["ul", "ol"] },
                    "items": { "$ref": "#/$defs/list" },
                    "start": { "type": "integer", "minimum": 1 }
                  }
                }
              ]
            }
          }
        }
      }
    },
    "cta": {
      "type": "object",
      "additionalProperties": false,
      "required": ["type", "label", "href"],
      "properties": {
        "type": { "const": "cta" },
        "label": { "type": "string", "minLength": 1 },
        "href": { "type": "string", "pattern": "^(https?:|mailto:|tel:)" },
        "text": { "$ref": "#/$defs/inline" }
      }
    }
  }
}
```

## Приклад

```json
{
  "title": "Ранкова практика",
  "pretitle": "10 хвилин, щоб прокинутися в тілі",
  "tagline": "Короткий ранковий ритуал для тіла, дихання й уваги",
  "summary": "Сім коротких практик, які збирають ранок: рух, дихання, вода і тиша.",
  "locale": "uk",
  "kind": "mini",
  "categories": [
    "movement",
    "breathing"
  ],
  "durationDays": 7,
  "audience": [
    "Тим, хто прокидається важко і поспіхом",
    "Тим, хто хоче почати день з тіла, а не з телефона"
  ],
  "results": [
    "Легше прокидатися",
    "Спокійніший темп ранку"
  ],
  "format": [
    "7 уроків по 10–15 хвилин",
    "Відео і чек-листи"
  ],
  "accessNote": "[ЗАПОВНИ: скільки діє доступ]",
  "schedule": {
    "mode": "daily",
    "start": "purchase",
    "gate": "soft",
    "reminderHour": 8
  },
  "modules": [
    {
      "title": "Перший тиждень",
      "lessons": [
        {
          "title": "День 1. Знайомство",
          "summary": "Маршрут тижня і перша коротка практика.",
          "durationMin": 12,
          "blocks": [
            {
              "type": "lesson_objective",
              "text": "Познайомитися з маршрутом і спробувати першу практику."
            },
            {
              "type": "rich_text",
              "content": [
                {
                  "kind": "p",
                  "text": [
                    {
                      "text": "Цей тиждень про "
                    },
                    {
                      "text": "м’який старт",
                      "bold": true
                    },
                    {
                      "text": ": без зусилля, у вашому темпі."
                    }
                  ]
                },
                {
                  "kind": "h3",
                  "text": "Що знадобиться"
                },
                {
                  "kind": "ul",
                  "items": [
                    "Килимок",
                    "Склянка теплої води",
                    "10 хвилин тиші"
                  ]
                }
              ]
            },
            {
              "type": "video",
              "provider": "youtube",
              "videoId": "[ЗАПОВНИ: ID відео YouTube]",
              "title": "Вступ"
            },
            {
              "type": "practice_block",
              "title": "Пробудження хребта",
              "text": "Повільні нахили й скручування сидячи.",
              "durationMin": 5
            },
            {
              "type": "protocol_step",
              "step": 1,
              "title": "Склянка теплої води",
              "timing": "одразу після сну"
            },
            {
              "type": "protocol_step",
              "step": 2,
              "title": "Три повільні видихи",
              "text": "Видих довший за вдих."
            },
            {
              "type": "table",
              "title": "Ритм тижня",
              "head": [
                "День",
                "Фокус"
              ],
              "rows": [
                [
                  "1–2",
                  "Хребет"
                ],
                [
                  "3–5",
                  {
                    "kind": "ul",
                    "items": [
                      "Дихання",
                      "Стопи"
                    ]
                  }
                ]
              ]
            },
            {
              "type": "checklist",
              "title": "Після практики",
              "items": [
                {
                  "text": "Випити воду"
                },
                {
                  "text": "Записати одне відчуття"
                }
              ]
            },
            {
              "type": "faq_block",
              "items": [
                {
                  "question": "А якщо я пропустив день?",
                  "answer": "Просто продовжуйте з наступного."
                }
              ]
            },
            {
              "type": "quote",
              "text": "Тіло пам’ятає ритм, якому довіряє.",
              "author": "[ЗАПОВНИ: автор]"
            },
            {
              "type": "boundary_note",
              "text": "Практика не замінює медичну консультацію. При болю чи запамороченні зупиніться."
            }
          ]
        }
      ]
    },
    {
      "title": "Довідник",
      "reference": true,
      "lessons": [
        {
          "title": "Рецепти теплих напоїв",
          "blocks": [
            {
              "type": "rich_text",
              "content": [
                {
                  "kind": "ol",
                  "items": [
                    "Вода з лимоном",
                    "Імбирний чай"
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```
