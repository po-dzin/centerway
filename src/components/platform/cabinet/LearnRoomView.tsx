"use client";

/**
 * THE ROOM — the library's third shelf view, at `/learn`.
 *
 * Ported from docs/design-system/prototypes/library-depth-2026-08-26.html
 * (зб. 59, branch claude/library-room-prototype-f17a4a — 40 commits of
 * hand-tuned geometry). The packing math and the ink-drawn niche/spine
 * generators below are that prototype's own functions, translated to
 * TypeScript and fed real courses instead of its mock catalogue — not
 * re-derived. Re-deriving a weighted bin-packing layout blind, without the
 * live visual iteration the original 32 commits had, is how you re-introduce
 * bugs that were already found and fixed once.
 *
 * WHAT THIS STEP DOES NOT CARRY (see the CSS module's own header for why):
 * sound, mouse-parallax, the ink "attention" glow, the procedural wall
 * canvas, and the open-book reading "spread". A book click navigates straight
 * to the course.
 *
 * THE CAMERA IS HERE (2026-08-29), and it is what makes this a room rather
 * than a picture of one: a library is read by walking up to a shelf. See
 * `frameCase` below for the move itself, and `LearnShelfClient` for what
 * drives it — the subject chips above the room and the wall are ONE choice,
 * not two, so pressing a subject and stepping up to that shelf are the same
 * act seen from two sides.
 *
 * DEPTH IS ALREADY FLAT IN THE SOURCE. The prototype's own `buildRoom` sets
 * `Z_FAR = 0, Z_NEAR = 0, MAXPHI = 0` — rotation and z-translation per niche
 * already multiply out to nothing in зб. 59; what is left of "depth" is
 * niche SIZE (a heavier category sits in a bigger cut) and the shadow inside
 * the cut, not a 3D tilt. So this port has no `translateZ`/`rotateY` per
 * niche and no screen→facet perspective divide: with z pinned at 0 that
 * divide is a constant scalar for every niche, not a perspective at all. The
 * camera is flat for the same reason — a translate and a scale, not a dolly.
 * The prototype's own `frameCase` arithmetic collapses to exactly that once
 * its perspective factor `k = P / (P - z)` is evaluated at the z it actually
 * uses, which is zero: k becomes 1 and the two divisions cancel.
 *
 * WHAT IS LEFT IN THIS FILE IS THE VIEW. The 800 lines of ported arithmetic
 * that used to sit above the component moved out unchanged on 2026-09-11 —
 * `roomGeometry.ts` decides where everything lands, `roomInk.ts` draws it.
 * Neither is a React module, and that is the point: the warning at the top of
 * this header, that this math must not be re-derived blind, is only
 * enforceable if it can be called from a test. It can now — see
 * `roomGeometry.test.ts`.
 */

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { MotionLink } from "@/components/platform/MotionLink";

import type { LearnerShelfCourseDto } from "@/components/lms/lmsClient";
import { courseAction } from "./CourseCard";
import type { CabinetCopy } from "./copy";
import type { ShelfCategory } from "./ShelfFilter";
import styles from "./LearnRoomView.module.css";

/* Where a niche lands and what it is drawn with are two separate questions,
   and neither of them is a React one — see both modules' own headers. */
import { CAMERA_MS, CATEGORY_ORDER, frameCase, layoutRoom, toCases } from "./roomGeometry";
import { codeInk, markInk, nicheInk, rowInk, spineInk } from "./roomInk";

export function LearnRoomView({
  courses,
  copy,
  match,
  category = "all",
  onCategory,
}: {
  courses: LearnerShelfCourseDto[];
  copy: CabinetCopy;
  /* THE QUERY DIMS; IT DOES NOT REPACK. A predicate rather than an already
     filtered list, and that is the whole point — the wall is laid out from
     every course the shelf holds, and the query only decides which cuts go
     quiet. The prototype's own rule: "стіна не перебудовується під запит, вона
     пригасає". A wall that repacks itself on every keystroke has answered a
     different question from the one that was typed, and the reader loses the
     one thing the room is for: seeing WHERE a work stands. */
  match?: (course: LearnerShelfCourseDto) => boolean;
  /* WHICH SHELF THE READER IS STANDING AT — the same value the subject chips
     above the room are pressed into, and deliberately not a second piece of
     state owned in here. Two would have been two answers to one question: a
     chip saying «Nutrition» while the camera stands in front of «Movement» is
     a room that disagrees with its own controls. So walking up to a shelf IS
     choosing that subject, and «All» IS the way back to the middle of the
     room. `undefined` `onCategory` leaves the wall a picture: nothing on it
     can be walked up to, because there is nowhere for the choice to go. */
  category?: ShelfCategory;
  onCategory?: (next: ShelfCategory) => void;
}) {
  /* Which course is being looked at, wherever the looking came from. The
     prototype's rule: "стан рядка не залежить від того, звідки прийшла увага"
     — a row and its spine light together whether the pointer is on the text
     or on the shelf, because otherwise half the scene answers and half does
     not. */
  const [hot, setHot] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [dark, setDark] = useState(false);

  const cases = useMemo(() => toCases(courses, copy), [courses, copy]);
  const shown = useMemo(() => (match ? courses.filter(match) : courses), [courses, match]);
  const lit = useMemo(() => new Set(shown.map((c) => c.slug)), [shown]);

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (box) setSize({ w: box.width, h: box.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    const root = stageRef.current?.closest<HTMLElement>("[data-cw-theme]");
    const read = () => setDark((root?.getAttribute("data-cw-theme") ?? "") === "dark");
    read();
    if (!root) return;
    const obs = new MutationObserver(read);
    obs.observe(root, { attributes: true, attributeFilter: ["data-cw-theme"] });
    return () => obs.disconnect();
  }, []);

  const narrow = size.w > 0 && size.w <= 640;
  const niches = useMemo(() => layoutRoom(cases, size.w, size.h, narrow), [cases, size.w, size.h, narrow]);

  /* THE OPEN SHELF IS THE CHOSEN SUBJECT, resolved against what the wall
     actually holds. `ci` is an index into CATEGORY_ORDER and not into `cases`
     — `toCases` numbers before it drops the empty ones — so a subject with no
     courses on this shelf resolves to a case that is not on the wall, and the
     camera stays in the hall rather than framing an empty coordinate. */
  const open = useMemo(() => {
    if (category === "all") return -1;
    const ci = CATEGORY_ORDER.indexOf(category);
    return cases.some((one) => one.ci === ci) ? ci : -1;
  }, [category, cases]);
  const openCase = open < 0 ? null : (cases.find((one) => one.ci === open) ?? null);

  const camera = useMemo(() => frameCase(niches, open, size.w, size.h, narrow), [niches, open, size.w, size.h, narrow]);

  /* THE WALK IS WRITTEN ONTO THE ELEMENT, NOT RENDERED INTO IT — both halves
     of it, and in this order.

     WILL-CHANGE LIVES EXACTLY AS LONG AS THE MOVEMENT DOES: the prototype's
     rule, and one this product has already been bitten by once (see the
     topbar's own note). A layer promoted for good costs its own pixels for
     good, and this room stands still almost all of the time.

     IT IS ARMED BY A CHANGE OF SHELF, NOT BY A CHANGE OF CAMERA. The camera
     also moves when the stage is resized, and a window being dragged is not a
     walk across a room — it should land where it lands, every frame, with
     nothing easing after it. That is the whole reason the two effects below
     are two: one watches the shelf and one watches the numbers.

     And they are effects writing to the DOM rather than state driving a
     render, because state here would be a render caused by a render (see the
     `react-hooks/set-state-in-effect` rule) to say something no other part of
     this component needs to know. Declaration order is the guarantee that
     matters: the transition is on the element before the transform it is
     meant to ease. */
  const cameraRef = useRef<HTMLDivElement>(null);
  const stood = useRef(false);
  const backRef = useRef<HTMLButtonElement>(null);
  const nicheEnterRefs = useRef(new Map<number, HTMLButtonElement>());
  const focusBackAfterOpen = useRef(false);
  const returnFocusCi = useRef<number | null>(null);

  useLayoutEffect(() => {
    const el = cameraRef.current;
    if (!el) return;
    if (!stood.current) {
      /* The first paint is wherever the reader already was: arriving at a
         shelf chosen before the room was drawn is not a walk across it. */
      stood.current = true;
      return;
    }
    el.dataset.walking = "true";
    const timer = window.setTimeout(() => {
      el.dataset.walking = "false";
    }, CAMERA_MS + 120);
    return () => window.clearTimeout(timer);
  }, [open]);

  useLayoutEffect(() => {
    const el = cameraRef.current;
    if (!el) return;
    el.style.setProperty("--px", `${camera.x.toFixed(1)}px`);
    el.style.setProperty("--py", `${camera.y.toFixed(1)}px`);
    el.style.setProperty("--cs", camera.s.toFixed(3));
  }, [camera]);

  /* FOCUS WALKS WITH THE READER. Activating a niche removes that niche's
     entry button, so leaving focus to the browser would drop it on `<body>`
     and make the documented Escape path unreachable. Only room-originated
     moves participate: choosing a subject chip above the room keeps focus on
     that chip, and choosing «Усі» there does the same. */
  useLayoutEffect(() => {
    if (open >= 0 && focusBackAfterOpen.current) {
      focusBackAfterOpen.current = false;
      backRef.current?.focus({ preventScroll: true });
      return;
    }
    if (open < 0 && returnFocusCi.current !== null) {
      const ci = returnFocusCi.current;
      returnFocusCi.current = null;
      nicheEnterRefs.current.get(ci)?.focus({ preventScroll: true });
    }
  }, [open]);

  const leaveCase = () => {
    if (open < 0 || !onCategory) return;
    returnFocusCi.current = open;
    onCategory("all");
  };

  /* LOD IS READ THROUGH THE CAMERA. The prototype polled it every 110ms
     because its zoom was a live DOM measurement mid-flight; here the scale is
     a number this render already knows, so the reading is one multiplication:
     what matters is how wide a spine is ON SCREEN, and the camera is the only
     thing between the layout and the screen. The gauge is a spine of the shelf
     being looked at — in the hall any of them will do, since none is nearer
     than another. */
  const gauge = (open < 0 ? niches[0] : niches.find((n) => n.ci === open))?.books[0];
  const gaugeW = (gauge?.w ?? 0) * camera.s;
  const gaugeH = (gauge?.h ?? 0) * camera.s;
  const lod: "name" | "plate" | "bare" = !gauge
    ? "name"
    : gaugeW >= 22 && gaugeH >= 80
      ? "name"
      : gaugeW >= 9
        ? "plate"
        : "bare";

  if (cases.length === 0) {
    return (
      <div className={styles.room}>
        <div className={styles.empty}>{copy.learningEmptyTitle}</div>
      </div>
    );
  }

  return (
    <div
      className={styles.room}
      data-lod={lod}
      data-case={open >= 0}
      /* The keyboard's own release, and the same rule: focus moving from one
         spine to the next never passes through nothing. `onBlur` is React's
         `focusout`, so it bubbles here and can ask where the focus WENT. */
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHot(null);
      }}
      /* THE WAY OUT OF A SHELF IS ALSO A KEY. Escape is what every other
         entered thing in this product answers to, and a reader who walked in
         with the keyboard should not have to tab to the way back. */
      onKeyDown={(event) => {
        if (event.key === "Escape" && open >= 0 && onCategory) {
          event.stopPropagation();
          leaveCase();
        }
      }}
    >
      <div
        className={styles.stage}
        ref={stageRef}
        /* ATTENTION IS RELEASED BY LEAVING THE ROOM, NOT BY LEAVING A BOOK.
           Each spine used to clear `hot` on its own mouseleave, so sliding
           along a shelf ran leave→enter on every neighbour and the whole
           niche's titles blinked off for the frame in between — a row of
           names strobing under the pointer. The niche keeps its attention
           until the pointer is out of the scene entirely. */
        onMouseLeave={() => setHot(null)}
      >
        {/* THE CAMERA IS THE ONLY THING THAT MOVES. Everything that belongs to
            the room — wall, light, cuts, books — rides inside this one
            element, so approaching a shelf is a single composited transform
            rather than a hundred elements being re-laid-out. The stage stays
            put around it: it is what the size is measured from, and measuring
            through a transform mid-flight is how a layout starts chasing its
            own animation. */}
        <div className={styles.camera} ref={cameraRef}>
          <div className={styles.wall} />
          <div className={styles.rake} aria-hidden="true" />
          {niches.map((n) => (
            <div
              key={`${n.ci}:${n.from}`}
              className={styles.niche}
              /* ATTENTION IS ONE STATE, WHEREVER IT CAME FROM. A niche is hot
               when the course being looked at stands in it — pointed at on the
               wall, or pointed at in the column beside it. Same `hot` as the
               row and the spine, so the three never disagree about which work
               is being read. */
              data-hot={n.books.some((b) => b.slug === hot)}
              data-dim={!n.books.some((b) => lit.has(b.slug))}
              /* THE SHELF BEING READ, AND THE SHELVES THAT ARE NOT. `data-away`
               is not a stronger `data-dim`: a query DIMS, because where a work
               stands is the one thing this view knows and a wall that empties
               itself under a search has thrown that away — but a reader who
               has walked up to one shelf is not looking at the others at all,
               and at three times the scale the others are not shelves in the
               background, they are slabs sliding across the text column. */
              data-open={open === n.ci}
              data-away={open >= 0 && open !== n.ci}
              style={{ left: n.x, top: n.y, width: n.w, height: n.h, ["--depth" as string]: n.depth.toFixed(2) }}
            >
              <div className={styles.nicheCast} aria-hidden="true" />
              {/* WALKING UP TO THE SHELF — the cut itself, as a control.
                A button UNDER the books rather than around them: a link inside
                a button is not markup a browser has an answer for, and the two
                are genuinely different acts anyway. The spines answer «open
                this work»; the shelf they stand on answers «bring me closer to
                these». Its name says which shelf, because the drawing does not
                say anything to a reader who cannot see it. */}
              {onCategory && open !== n.ci ? (
                <button
                  className={styles.nicheEnter}
                  type="button"
                  ref={(node) => {
                    if (node) nicheEnterRefs.current.set(n.ci, node);
                    else nicheEnterRefs.current.delete(n.ci);
                  }}
                  aria-label={copy.roomEnter(cases.find((one) => one.ci === n.ci)?.label ?? "")}
                  onClick={() => {
                    const category = CATEGORY_ORDER[n.ci];
                    if (!category) return;
                    focusBackAfterOpen.current = true;
                    onCategory(category);
                  }}
                  onMouseEnter={() => setHot(n.books[0]?.slug ?? null)}
                />
              ) : null}
              {/* THE MARK LIVES OUTSIDE THE CUT — it is drawn AROUND the shelf,
                and `.nicheBox` clips. Drawn eagerly rather than on first look
                (the prototype's `ensureMark`): that laziness paid for a wall of
                a hundred openings, and this room has one cut per section of one
                of three categories. Drawing it up front is what lets the fade
                actually be a fade. */}
              <div
                className={styles.nicheMark}
                aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: markInk(n.ci, n.w, n.h, dark) }}
              />
              <div className={styles.nicheBox}>
                <div
                  className={styles.nichePersp}
                  dangerouslySetInnerHTML={{ __html: nicheInk(n.ci, n.w, n.h, dark) }}
                />
                {n.books.map((b) => {
                  /* The prototype's own arithmetic for a name on a board, kept:
                   the size is a fraction of the spine's width, clamped, and
                   the fit test is the name's own run down the board against
                   the board's height. Two things are added to it, and both
                   because this room is inside a product rather than a page of
                   its own: the name is only written on the shelf being read
                   (in the hall it would be three walls of speckle), and only
                   when the camera has actually made it a size a person can
                   read — 7px on screen, below which type is a texture. */
                  const fs = Math.max(2.6, Math.min(9, b.w * 0.52));
                  const fits = b.title.trim().length * fs * 0.58 <= b.h * 0.76;
                  const named = open === n.ci && fits && fs * camera.s >= 7;
                  return (
                    <MotionLink
                      key={b.slug}
                      className={styles.book}
                      data-live={b.live}
                      data-hot={hot === b.slug}
                      style={{
                        left: b.x,
                        bottom: b.y,
                        width: b.w,
                        height: b.h,
                        ["--tilt" as string]: `${b.tilt.toFixed(1)}deg`,
                      }}
                      aria-label={`${b.title} · ${b.state}`}
                      href={courseAction(b.course, copy).href}
                      onMouseEnter={() => setHot(b.slug)}
                      onFocus={() => setHot(b.slug)}
                    >
                      <span className={styles.bookDraw} dangerouslySetInnerHTML={{ __html: spineInk(b.w, b.h) }} />
                      {/* THE NAME ARRIVES WITH THE CAMERA, and this is the whole
                      reason the camera exists. At wall distance a title on a
                      20px board is speckle, which is why a spine wears a
                      LABEL there (see `spineCode`). Walked up to, the same
                      board is sixty pixels across and the label has something
                      to say. The size is taken from the SPINE, never from a
                      rem: a rem knows nothing about how wide the board is, so
                      the camera used to multiply the letters past the edges
                      of the thing they were written on. When even so the name
                      will not fit down the board, the label stays — a cut
                      title on a spine says nothing the label did not, and
                      lies that it can be read. */}
                      {named ? (
                        <span
                          className={styles.bookTitle}
                          aria-hidden="true"
                          style={{ fontSize: `${fs.toFixed(1)}px` }}
                        >
                          {b.title}
                        </span>
                      ) : (
                        <span
                          className={styles.bookSpine}
                          aria-hidden="true"
                          dangerouslySetInnerHTML={{ __html: codeInk(b.title, b.w, b.h) }}
                        />
                      )}
                    </MotionLink>
                  );
                })}
              </div>
              {n.label ? <span className={styles.nicheLabel}>{n.label}</span> : null}
              {n.more ? <span className={styles.nicheMore}>+{n.more}</span> : null}
            </div>
          ))}
        </div>

        {/* THE SHELF SAYS ITS OWN NAME WHILE YOU STAND AT IT.
            Every niche's label goes out on the way in — the camera scales the
            room's type along with the room, and a 0.6rem heading at three
            times the size is a poster on the wall, in the middle of a drawing
            that is otherwise all hairlines. So the name moves OUT of the
            scene and into the frame, where it is set at the size it was
            written for and does not travel with the camera. It is a caption,
            not a control: the way back is the button beside it, and it is a
            button rather than a chevron on the wall because leaving is a
            thing done TO the room and not a place inside it. */}
        {openCase && onCategory ? (
          <div className={styles.frame}>
            <button ref={backRef} className={styles.back} type="button" onClick={leaveCase}>
              <span aria-hidden="true">←</span>
              {copy.roomBack}
            </button>
            <span className={styles.frameName}>{openCase.label}</span>
          </div>
        ) : null}
      </div>

      {/* THE ROOM IS THE ENVIRONMENT; THIS IS THE CONTENT.
          In the prototype the shelves live in a fixed, `aria-hidden` stage and
          the thing a reader actually reads is a text column beside them — which
          is why its niches are packed into the right half and the left half is
          not empty space but the column's. Porting the stage without the column
          left a room that looked broken and, worse, could only be used by
          pointing at 20px spines: the titles were in the drawing, not in the
          document. The column is the shelf as text — the same courses, the same
          doorways, in a list that can be read, scrolled and tabbed through. */}
      <nav className={styles.sheet} aria-label={copy.learningLabel} onMouseLeave={() => setHot(null)}>
        <ol className={styles.shelfList}>
          {shown.map((course, i) => {
            const done = course.standing?.completedLessons ?? 0;
            const total = course.standing?.totalLessons ?? 0;
            const live = course.access === "enrolled";
            return (
              <li key={course.slug}>
                <MotionLink
                  className={styles.row}
                  href={courseAction(course, copy).href}
                  data-hot={hot === course.slug}
                  onMouseEnter={() => setHot(course.slug)}
                  onFocus={() => setHot(course.slug)}
                >
                  <span className={styles.rowIndex}>{String(i + 1).padStart(2, "0")}</span>
                  <span className={styles.rowMain}>
                    {/* THE STROKE UNDER THE NAME, IN TWO STRENGTHS. The weaker
                        one is where attention is pointing (pointer, keyboard,
                        or the shelf on the wall). It is the same pen the room
                        is drawn with, and it is the product's one way of saying
                        "here" — never a filled highlight. */}
                    <span className={styles.inkLabel}>
                      <span className={styles.rowTitle}>{course.title}</span>
                      <span
                        className={styles.rowMark}
                        aria-hidden="true"
                        dangerouslySetInnerHTML={{ __html: rowInk(i * 5 + 3, dark) }}
                      />
                    </span>
                    <span className={styles.rowNote}>
                      {course.categories.map((c) => copy.courseCategories[c]).join(" · ")}
                    </span>
                  </span>
                  <span className={styles.rowState} data-held={live}>
                    {total > 0
                      ? `${done} / ${total}`
                      : course.access === "locked"
                        ? copy.courseLocked
                        : copy.courseNotStarted}
                  </span>
                </MotionLink>
              </li>
            );
          })}
        </ol>
        {/* An empty result is as much of an answer as a list, and it says so in
            the list's own place rather than replacing the room. */}
        {shown.length === 0 ? <p className={styles.noMatch}>{copy.shelfNoMatch}</p> : null}
      </nav>
    </div>
  );
}
