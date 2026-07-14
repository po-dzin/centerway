# Landing Testimonials Selection — 2026-07-06

## Scope

- Routes: `src/landing-static/way21/index.html`, `src/landing-static/reset-day/index.html`
- Surface: separate funnel routes
- Block role: `proof + trust`
- Token source: shared landing DS (`shared/css/landing.css`) + existing landing skins via `--cw-net-*`
- Content source: real screenshots from `/Users/G/Documents/CW media/cw_feedback`

## User Questions

- `way21`: "Есть ли у людей реальный глубокий результат от 21-дневной программы?"
- `reset-day`: "Действительно ли это мягкий старт без голода и с быстрым ощущением легкости?"

## Selection Logic

### way21

Selected screenshots emphasize deeper program outcomes:

1. `focus-weight-20250927.jpg` — weight correction, focus, productivity, sleep
2. `minus3-sleep-20230320.jpg` — `-3 кг`, lightness, better sleep
3. `no-hunger-20221119.jpg` — no hunger compared with previous diets
4. `food-freedom-20220209.jpg` — freedom around food, better wellbeing
5. `comfort-minus4-20220215.jpg` — `-4 кг`, comfortable process, works in real life
6. `minus55-20241211.jpg` — `-5.5 кг за 2 тижні`, strong progress proof
7. `minus6-day21-20220209.jpg` — day 21, `-6 кг`, stable condition
8. `repeat-program-20240719.jpg` — wants to repeat the program
9–10. `lightness-sleep-inshot-1.jpg` and `lightness-sleep-inshot-2.jpg` — one long screenshot, split into consecutive carousel slides
11–12. `weight-cravings-inshot-1.jpg` and `weight-cravings-inshot-2.jpg` — one long screenshot, split into consecutive carousel slides

### reset-day

Selected screenshots emphasize soft entry, lightness, and absence of stress. Exclude deep-cleansing claims, multi-week transformation results, and any screenshot that explicitly describes the `Шлях 21` course:

1. `no-hunger-20221119.jpg` — "waiting for hunger, but it isn't there"
2. `food-freedom-20220209.jpg` — less compulsion around food
3. `repeat-program-20240719.jpg` — wants to return to the program

## Rendering Decision

- Use compact horizontal carousels instead of static 3-card review rows.
- Normalize screenshots at the component level with a fixed media frame and `object-fit: contain`.
- Keep screenshots as screenshots rather than retyping them, because proof value here is visual authenticity.
