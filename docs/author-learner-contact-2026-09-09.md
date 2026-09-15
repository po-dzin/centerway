# Author ↔ learner contact: what exists, what others do, where our line falls

Research note, 2026-09-09. Nothing here is implemented; this is the contract to
agree before any of it is.

## The question

The overview now tells an author how many people are inside their courses and how
many are still moving (`docs/builder-author-overview-2026-09-07.md`). That
immediately raises the next one: those people can see the author — name, photo,
path, `/expert/[slug]` — and the author can see only a count. Should either be
able to reach the other, and through what?

## What exists today

| direction | channel | notes |
| --- | --- | --- |
| learner → house | `centerway_support_bot`, one Telegram thread | access, payment, FAQ, bug intake. Not the author. |
| learner → author | `author.consultation.contactUrl` on `/expert/[slug]` | a link OUT, unauthenticated, only for authors who enabled consultation |
| house → learner | `notify.ts` → Telegram, addressed to a LEARNER not to a channel | reminders only; `email`/`webpush` declared and honestly unimplemented |
| author → learner | **nothing** | — |

Two facts constrain everything below.

**`notify.ts` is already the right shape.** It resolves a learner's channels from
their profile and refuses to pretend an unimplemented channel delivered
something. Anything author-originated should be a new *caller* of it, never a
second dispatcher.

**Two privacy decisions are already on the record.** `lms_annotations` has no
staff read policy — an author does not see what a learner underlined. And the
audience counts on the overview deliberately stop at integers: seven people
opened the course, never which seven. Any contact feature either honours that
line or explicitly moves it, and moving it is a decision, not a side effect.

## What the industry actually ships

Four distinct primitives, routinely conflated because platforms bundle them.

**1. Announcement — author to everyone enrolled, one way.** Moodle, Blackboard,
Tutor LMS, MasterStudy. The written best practice is explicit that the
announcements forum is *not* a place to solicit replies; a discussion forum is.
It is cheap, it creates no inbox, and it transfers no identity: the author writes
about the course, not to a person.

**2. Course Q&A — learner asks in public, per lecture.** Udemy's model. The
design bet is leverage: the answer serves every future learner who has the same
question, which is why Udemy pushes Q&A as the primary route and keeps private
messaging as the narrower fallback (and disables it entirely on free courses).

**3. Community feed and member DM.** Circle, Skool, Mighty Networks. Highest
engagement, highest moderation cost. Worth noting how Circle *ships* DM: members
can disable messaging for their own account, admins can disable it per member,
and admins retain the ability to message anyone regardless. Even the platforms
built around messaging treat "can be reached" as a switch with a house override.

**4. Scheduled synchronous — office hours, cohort calls, 1:1.** Maven. Maven's
own guidance is that personal feedback is what makes a premium course premium;
the failure mode visible in their creators' own descriptions is the instructor
who reviews every submission personally and cannot scale past one cohort.

## Why we cannot simply copy the Udemy model

**The questions here are health questions.** A public course Q&A in a wellness
programme means learners publishing special-category data about themselves to
everyone else enrolled. The research on peer health forums is blunt about this:
such forums cannot guarantee privacy, public posting is not the same as consent
to how a post is later used, and the disclosure risk is carried by the person who
posted, not by the platform. A body-practice course's Q&A would fill with
symptoms within a week.

**Written answers to personal health questions sit outside scope of practice.**
The health-coaching bodies (NBHWC, ACE) draw the line at educate/guide/empower
versus diagnose/prescribe, and the standard risk-management advice is to document
the limits of the role and name the point at which someone should seek licensed
care. Our own `/consult` page already carries that boundary block. A per-lesson
Q&A that answers "what should I do about my symptom" in writing is precisely the
act those boundaries exist to prevent — and it would be doing it in the author's
name, on the house's platform.

**And an open author inbox contradicts the product's own stance.** The premium
model here is request → intake → personal answer, deliberately not a conveyor.
An always-open DM is the conveyor: it turns the author into a 24/7 helpdesk,
sets an SLA nobody agreed to, and competes with Telegram, where this audience
already is and where the house already runs one thread.

## The asymmetry, which is the actual finding

The two directions are not one feature pointed both ways. They differ in what
they carry:

- **author → learner is a broadcast about the material.** No identity has to
  cross, no inbox is created, expectations are bounded by the fact that it is
  one-way. Low risk, real value, and the gap that exists today.
- **learner → author is a question about the person asking.** It carries health
  detail, it carries an expectation of a reply, and answering it in writing is
  where scope of practice bites. High risk, and its honest escalation — a paid
  personal consultation with a boundary already written — is a product we
  already sell.

Building them as one "messages" feature would price the first at the risk of the
second, which is how this ends up either unshipped or unsafe.

## Proposed ladder

Each rung is independently shippable and independently useful. None of it exists
yet.

**L1 — Оголошення (author → course).** The author writes one note; everyone with
open access to that course receives it through `notify.ts` and sees it in the
course. One way, no replies, no identity crosses, rate-limited per course. This
is the missing primitive and the cheapest honest one.

**L2 — Питання про матеріал (learner → author, mediated).** Asked from inside a
lesson, so it is anchored to what it is about. Three properties do the work:

- *not public.* The asker is shown to the author as "учень курсу" with the lesson
  they were on, not as an account. The health-forum disclosure problem does not
  arise, and the existing annotation line stays where it is.
- *answer once, serve everyone — by promotion, not by default.* The author may
  mark an answered question as public, which appends it to that lesson's FAQ.
  That recovers Udemy's actual leverage without making disclosure the default
  state.
- *the boundary is at the point of asking,* not in a footer: the form says what
  this channel is for (the material) and what it is not (personal health), and
  offers the consultation route for the second kind — which is the same sentence
  `/consult` already makes.

**L3 — Консультація.** Exists. What changes is that L2 routes to it explicitly
instead of leaving the learner to find it.

## Guardrails any rung inherits

- **Askable is a switch.** Per author and per course, with the house able to
  override — Circle's shape, for Circle's reason.
- **The house can always read the thread.** It is the platform's liability and
  its moderation duty; a channel nobody can audit is not a channel we can
  operate in a health context.
- **State the response expectation in words.** "Автор відповідає, коли може" is
  honest; silence that looks like a support SLA is not.
- **No new dispatcher.** L1 and L2 deliveries are callers of `notify.ts`.
- **Nothing here grants an author a learner's identity.** If that is ever wanted,
  it is its own decision with its own consent, not a consequence of shipping
  messages.

## Status

Researched and not built, by decision on 2026-09-09. The ladder below is the
agreed shape to build against when contact is picked up as its own cycle; no
table, route, toggle or copy from it exists yet.

## Dashboard consequence

Only one new number is worth putting on the overview, and only once L2 exists:
questions awaiting an answer, with how long they have waited — the same shape as
«Перевірка», and for the same reason. Announcements sent is a vanity count and
should not appear.

## Sources

- Udemy, Communication Tools / Q&A / Direct Messages rules and guidelines
- Circle, messaging availability and per-account/per-member DM controls
- Moodle (AsULearn), Blackboard, Tutor LMS, MasterStudy — announcement semantics
- Maven, "Designing a Top-Rated Course" and Teach on Maven
- NBHWC Scope of Practice; ACE, "Navigating Boundaries"; FMCA scope guidance
- JMIR 2025, "Evaluating Peer Online Forums to Support Health: Ethical and
  Practical Challenges"; AMA Journal of Ethics, "The Benefits of Online Health
  Communities"; ONC, "Your Health Information Privacy"
