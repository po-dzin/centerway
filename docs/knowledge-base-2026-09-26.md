# База знань клубу CenterWay — структура, джерела, зв'язок із клубом

Date: 2026-09-26
Status: proposal. Nothing on the platform changed: no migration, no route, no production data.
The structure and first batch live as a **pending SymbolField proposal** (Space
«CenterWay · База знань», proposal `8f064600-0077-4b24-beda-fca7ff3cbcc6`, 42 nodes /
77 links) that the owner applies in SymbolField.

Context: the Telegram model decided on 2026-09-26 (artifact «Соцсхема CenterWay»):
a free public channel with comments, and **one closed club** (a group with topics) for
everyone with active program access or a monthly/yearly subscription. One club
topic is «База знань»; the knowledge base itself lives on the platform / in
SymbolField and is linked from that topic.

Voice for entries: CenterWay's, Ukrainian, «ви». Multi-author; Євгеній Корякін
is the first author and owns every program listed below.

## 1. Inventory of source material

All five courses are in `data/courses/*.json` (validated by `src/lms-core/course.ts`),
author Євгеній Корякін.

| Program (file · products) | What it holds that a knowledge base can use | Form |
|---|---|---|
| **Шлях 21** (`way21.json` · way21, way21-support) | Rules for the whole day: sleep, drinking, meal timing by dosha (`w1-nutrition`); the list of foods cut out during cleansing and the list of permitted foods; the morning sequence of ghee, soda inhalation, kapalabhati/uddiyana, Anu tail, mouth rinse and herbal collection (`w1-morning`); week-1 procedures (baths, rubbing, nasya); herbal collections №1–№3 with brewing (`phyto-protocol`); shopping list by week (`prepare`); 7-day return to solid food, fresh juices and prune cocktail (`w3-food-return`); balance markers (`w3-final`); 8 sweet recipes, one with a senna warning (`recipes`); 3 webinars (basics, women's health, seasons); report format | Text, fully written out |
| **Природнє тіло з Аюрведою** (`natural-body.json` · natural-body, ideal-body) | 21 lessons: goals, 5 elements, doshas, 13 functions of life with Vata, then Pitta and Kapha, 6 stages of disease, toxins, tastes, properties of fruit, vegetables, grains, oils/dairy, spices, food combining, daily cycles, gunas, balancing each dosha. The instruction lesson covers meal timing, unfavourable foods, cooking methods by dosha and portion size. Sweet recipes | **Theory is video only**: each lesson is one objective line plus a YouTube video. The instruction lesson and recipes are text |
| **Розвантажувальний день** (`reset-day.json` · reset-day, mini-detox) | Daily routine for all 3 stages with meal timing by dosha; stage 1 preparation with 4 vegetable dinners; stage 2 with 6 variants from rice with ghee to water only; stage 3 exit; checklists; the course's only `faq_block` (how often to repeat, what comes next); 5 soups marked by constitution | Text + video |
| **Short-Перезавантаження** (`short.json` · short, reboot) | The 7-exercise «Перезавантаження» set; the morning cleansing breath set (kapalabhati, static and dynamic uddiyana, isolated abdominal work); the evening calming set (bend in vajrasana, apanasana, ujjayi, nadi shodhana); the day-4 questions lesson and day-5 feedback lesson | Text protocol steps + video |
| **ІВЕМ-гімнастика** (`irem-gymnastics.json` · irem) | General recommendations; exercise descriptions in 3 parts (drawing up energy, filling and redistribution, harmonisation and stretching); sequence reminders; 7 daily video lessons | Text + video. The encoding was repaired on main (`2d31cc8`). On 2026-10-02 the «Вправа / Вправа» duplicates were removed, exercises numbered per part, and `exercise-sequence-reminders` rebuilt as a cheat sheet (part 1 by day, parts 2–3 in groups) |
| **Тест доші** (`src/lib/dosha/*`) | 12 questions and 7 result types (vata, pitta, kapha, vata_pitta, pitta_kapha, vata_kapha, tridosha). Each result has title, softTitle, summary, weekVector and recommendation (`doshaResultCopy.ts`) | Code copy |
| **Трави** (`/herbs`, `src/landing-static/herbs`) | Three collections (role, composition, task, sensation), individual selection, ayurvedic analogues abroad. There is no herb entity or table: `herbs` is a price-less product (`docs/herbs-no-price-no-checkout-2026-09-04.md`) | Landing copy |

Questions that recur in support:

- **Access and account.** Source: `src/lib/telegram/tgSupportBotCopy.ts`, keys `where_course`, `access_missing`, `login`, `schedule`, `check_payment`, `payment_problem`. The eval set in `data/agent/question-eval.json` adds: where the course is after payment, the sign-in email not arriving, lessons ahead of schedule, refunds, personal data, what the dosha test shows, whether the test is paid, and the price and contents of Шлях 21.
- **Health questions that must go to a person.** Blood pressure, thyroid, pregnancy, medication (`question-eval.json`).
- **Landing FAQs** (`src/landing-static/*/index.html`):
  - way21: safety, fasting, herbs abroad, time per day, «what if it doesn't work».
  - reset-day: is it real fasting, «I'll break», who it doesn't suit, what next.
  - irem / short: anyone can do it, gymnastics vs training, starting from zero, how to progress.
  - dosha: is it free, is it a diagnosis.
  - herbs: without a program, contraindications, delivery abroad, how selection works.
  - consult: online, what to prepare, is it a medical appointment.

## 2. Structure

### Sections

1. **Основи Аюрведи**: 5 elements, doshas, gunas, 13 functions, 6 stages, toxins, 6 tastes.
2. **Режим дня**: sleep, waking, meal timing by dosha, drinking, morning sequence.
3. **Харчування і рецепти**: foods, combining, cleansing lists, return to food, recipes.
4. **Трави і фітопротоколи**: collections, how selection works, oil procedures (nasya).
5. **Практики: рух і дихання**: techniques (one entry each) and complexes (protocols).
6. **Тіло і сигнали**: balance markers for self-observation, not self-diagnosis.
7. **Питання**: recurring questions from support and landings.
8. **Межі**: one boundary entry. It is linked from every entry that has a health risk.

### Entry types

Поняття · Режим · Практика/техніка · Протокол · Рецепт · Трава/збір · Питання · Межа.

Required fields on every entry:

- **author**: the owner of the source program;
- **source**: course slug / lesson slug;
- **access**: see below;
- **doshas**: when relevant;
- **related entries**.

### Access levels

| Mark | Who sees it | What goes there |
|---|---|---|
| **Відкрито** | Anyone. Can be linked from the public channel | Definitions, boundaries, access FAQ, how herb selection works, dosha test |
| **Клуб** | Every club member (active program access or subscription) | General regimen, single techniques, recipes, collection roles, balance markers |
| **Програма** | Only holders of that program. The knowledge base shows a summary plus a link to the lesson | Protocols with doses, day sequences, collection compositions and brewing, anything that assumes support |

Defaults in the first batch follow this table. **The author confirms each mark.**

### Ownership rules

- An entry points to its lesson and never contradicts it or replaces it.
- Two authors on one concept means two linked entries, never a merged «shared» entry.
- Entries that span programs (meal timing, sleep) list every source lesson.

### Cross-links

- The dosha is the main axis. `Три доші` links to meal timing, sleep, soups (marked by constitution), collections, and the dosha test.
- Protocols link to their techniques: morning sequence → kapalabhati, uddiyana, nasya, drinking.
- Protocols flow into outcomes: taboo list → return to food → balance markers.
- The boundary entry references every risky entry.

## 3. First batch (in the SymbolField proposal)

The proposal contains:

- **Frame nodes**: root, access legend, entry types, authorship, club topic, gaps.
- **Sources**: the 5 programs and the dosha test.
- **Section hubs**: 7.
- **21 entries**:

| Section | Entry | Access mark |
|---|---|---|
| Основи | Три доші | Відкрито |
| Режим дня | Час прийому їжі за дошею | Клуб |
| Режим дня | Сон і пробудження | Клуб |
| Режим дня | Питний режим | Клуб |
| Режим дня | Ранкова послідовність Шляху 21 | Програма |
| Харчування | Що прибираємо на очищенні | Програма |
| Харчування | Вихід у тверду їжу | Програма |
| Харчування | Солодощі без білого цукру | Клуб |
| Харчування | Супи для розвантажувального дня | Клуб |
| Харчування | Шість варіантів розвантажувального дня | Програма |
| Трави | Фітозбори №1–№3: роль | Клуб for roles; composition is Програма |
| Трави | Як підбираються трави | Відкрито |
| Трави | Насья | Програма |
| Практики | Комплекс «Перезавантаження» | Клуб |
| Практики | Капалабхаті | Клуб |
| Практики | Удіяна бандха | Клуб |
| Практики | Вечірній комплекс | Клуб |
| Практики | ІВЕМ: три частини | Клуб |
| Тіло | Орієнтири балансу | Клуб |
| Питання | Де мій курс | Відкрито |
| Питання | Як часто повторювати розвантажувальний день | Клуб |
| Питання | Я не в Україні — трави | Відкрито |
| Межі | Межі: чого база знань не замінює | Відкрито |

All entry text is taken from lesson copy. Doses stay in the lessons.

## 4. Link to the club and subscription

- The «База знань» topic in the club pins one message: a link to the knowledge base and the access legend. A new entry gets a short post in the topic. Topic questions that recur become «Питання» entries, closing the loop from support to the knowledge base.
- Club membership = active program access **or** a monthly/yearly subscription. On the platform today:
  - **There is no subscription.** No recurring payments (`docs/meta-audit-repo-2026-08-28.md`). Subscription is «LATER» (`docs/ontology-sync-2026-08-26.md`). The planned membership «Практика CenterWay» is at 350–500 ₴/міс (`docs/centerway-deconstruction-roadmap-2026-09-01.md`).
  - **There is no per-lesson free/preview flag.** Free is per course: `lms_course_offers.amount = 0`.
  - **There is no knowledge layer.** `KnowledgeEntry` / `GlossaryTerm` are ✗ in `docs/ontology-sync-2026-08-26.md`. `src/lib/agent/knowledge/` is the support agent's corpus (offer text, FAQ, policies), not a member knowledge base.
- So until a platform surface exists, SymbolField is the working home. The three marks are enforced by where a link is posted (public channel vs club) and by the lesson itself (Програма entries link into `/learn/<course>/<lesson>`, which already checks entitlement).
- **Platform step, only when asked:**
  1. a `kb_entries` record with author, source course/lesson, access level, doshas and links;
  2. an access check reusing the entitlement check for Програма entries and a future subscription entitlement for Клуб;
  3. a route under `(platform)` that passes the canon preflight.
  4. The support agent corpus could then index Відкрито entries.

## 5. Gaps and follow-ups

1. The theory of «Природнє тіло» (lessons 2–18) exists only as video. Transcripts or author text are needed before Основи can grow past definitions.
2. ~~The ІВЕМ `exercise-sequence-reminders` lesson has broken encoding.~~ Fixed on main; the cheat-sheet rework (2026-10-02) is in the course file and reaches the library only after `npm run lms:import`.
3. Collection compositions disagree between the Шлях 21 `phyto-protocol` lesson and the `/herbs` landing:
   - №2: the lesson lists бузина, валеріана, фіалка, фенхель/кріп/кмин; the landing lists меліса, фенхель, цикорій.
   - №3: кульбаба appears on the landing only.
   The author should decide which is current.
4. The author confirms the access marks and approves each entry before it is posted to the club.
