import { beforeEach, describe, expect, it } from "vitest";

import { FakeSupabase } from "@/lib/admin/fakeSupabase";

import {
  FeedError,
  addComment,
  createFeedPost,
  deleteFeedPost,
  editPlatformPost,
  feedPlatformAuthor,
  isFeedAdmin,
  decideHeldPost,
  feedAuthorForUser,
  getFeedPost,
  listComments,
  listFeed,
  listFeedMarks,
  listTaggableAuthors,
  publicName,
  removeComment,
  resubmitFeedPost,
  saveFeedMark,
  recordShare,
  saveFeedPost,
  setReturnReason,
  toggleReaction,
  unsaveFeedPost,
  type Db,
} from "./server";

const AUTHOR_USER = "00000000-0000-4000-8000-0000000000a1";
const OTHER_AUTHOR_USER = "00000000-0000-4000-8000-0000000000a2";
const READER = "00000000-0000-4000-8000-0000000000b1";
const COURSE = "00000000-0000-4000-8000-0000000000c1";
const FOREIGN_COURSE = "00000000-0000-4000-8000-0000000000c2";
const LESSON = "00000000-0000-4000-8000-0000000000d1";
const TAG_AUTHOR = "00000000-0000-4000-8000-0000000000e1";
const TAG_HIDDEN = "00000000-0000-4000-8000-0000000000e2";
const ASSET = "00000000-0000-4000-8000-0000000000f1";
const ADMIN = "00000000-0000-4000-8000-0000000000aa";

let fake: FakeSupabase;
let db: Db;

beforeEach(() => {
  fake = new FakeSupabase({
    lms_authors: [
      {
        id: "author-evg",
        slug: "evgeniy",
        name: "Євгеній",
        photo: { src: "/e.webp", alt: "Євгеній" },
        listed: true,
        auth_user_id: AUTHOR_USER,
      },
      {
        id: "author-2",
        slug: "avtor-2",
        name: "Автор Два",
        photo: null,
        listed: true,
        auth_user_id: OTHER_AUTHOR_USER,
      },
      { id: "author-hidden", slug: "hidden", name: "Прихований", photo: null, listed: false, auth_user_id: "u-hidden" },
      { id: TAG_AUTHOR, slug: "iryna", name: "Ірина Мельник", photo: null, listed: true, auth_user_id: null },
      { id: TAG_HIDDEN, slug: "unlisted", name: "Неопублікований", photo: null, listed: false, auth_user_id: null },
      {
        id: "author-platform",
        slug: "centerway",
        name: "CenterWay",
        photo: { src: "/cw/brand/cw-icon-192.png", alt: "CenterWay" },
        listed: false,
        auth_user_id: null,
      },
    ],
    user_roles: [{ user_id: ADMIN, role: "admin" }],
    lms_courses: [
      { id: COURSE, title: "Шлях 21", program_slug: "way21", author_id: AUTHOR_USER, author_profile_id: "author-evg" },
      {
        id: FOREIGN_COURSE,
        title: "Чужий",
        program_slug: "other",
        author_id: OTHER_AUTHOR_USER,
        author_profile_id: "author-2",
      },
    ],
    lms_lessons: [
      {
        id: LESSON,
        course_id: COURSE,
        title: "Ранок",
        day_index: 2,
        order: 1,
        blocks: [
          {
            id: "b1",
            type: "practice_block",
            title: "Дихання 4–6",
            text: "Вдих на чотири. Видих на шість.",
            durationMin: 3,
          },
        ],
      },
    ],
    platform_users: [{ auth_user_id: READER, full_name: "Олена Петренко" }],
  });
  // Rows get real uuids: the server refuses anything else as an id, as Postgres would.
  fake.nextId = () => crypto.randomUUID();
  db = fake as unknown as Db;
});

async function author(userId = AUTHOR_USER) {
  const found = await feedAuthorForUser(db, userId);
  if (!found) throw new Error("no author");
  return found;
}

describe("who writes", () => {
  it("is a listed author tied to the account", async () => {
    expect(await feedAuthorForUser(db, AUTHOR_USER)).toMatchObject({ slug: "evgeniy" });
    expect(await feedAuthorForUser(db, "u-hidden")).toBeNull();
    expect(await feedAuthorForUser(db, READER)).toBeNull();
  });
});

describe("posting", () => {
  it("publishes what passes the check, with the block it carries", async () => {
    const { post, verdict } = await createFeedPost(db, await author(), {
      body: "Три хвилини дихання до телефону.",
      topic: "breathing",
      courseId: COURSE,
      lessonId: LESSON,
      blockId: "b1",
      blockDisplay: "full",
    });
    expect(verdict.pass).toBe(true);
    expect(post.status).toBe("published");
    expect(post.attachment).toMatchObject({
      kind: "block",
      title: "Дихання 4–6",
      meta: "Шлях 21 · день 2",
      text: "Вдих на чотири. Видих на шість.",
      full: true,
      href: "/programs/way21",
    });
    const page = await listFeed(db, { filter: { topics: [], authors: [] }, me: null });
    expect(page.posts.map((entry) => entry.id)).toEqual([post.id]);
  });

  it("holds what the check stops, and only its author can see it", async () => {
    const { post } = await createFeedPost(db, await author(), { body: "Цей чай вилікує вас.", topic: "nutrition" });
    expect(post.status).toBe("held");
    expect(post.heldReason).toContain("обіцянок");
    expect((await listFeed(db, { filter: { topics: [], authors: [] }, me: null })).posts).toHaveLength(0);
    expect(await getFeedPost(db, post.id, READER)).toBeNull();
    expect(await getFeedPost(db, post.id, AUTHOR_USER)).toMatchObject({ status: "held" });
  });

  it("refuses an unknown topic and someone else's programme", async () => {
    await expect(createFeedPost(db, await author(), { body: "Текст", topic: "announce" })).rejects.toThrow(FeedError);
    await expect(
      createFeedPost(db, await author(), { body: "Текст", topic: "focus", courseId: FOREIGN_COURSE }),
    ).rejects.toMatchObject({ code: "attachment_not_yours" });
  });
});

describe("the team's decision", () => {
  it("publishes once, returns with a reason, and the author can send again", async () => {
    const first = await createFeedPost(db, await author(), { body: "Гарантую результат.", topic: "focus" });
    expect(await decideHeldPost(db, first.post.id, "publish", "tg:1")).toEqual({ changed: true, status: "published" });
    expect(await decideHeldPost(db, first.post.id, "return", "tg:2")).toEqual({ changed: false, status: "published" });

    const second = await createFeedPost(db, await author(), { body: "Гарантую тишу.", topic: "focus" });
    await db.from("feed_posts").update({ tg_message_id: 77 }).eq("id", second.post.id);
    expect((await decideHeldPost(db, second.post.id, "return", "tg:1")).status).toBe("returned");
    expect(await setReturnReason(db, 77, "Приберіть обіцянку")).toBe(true);
    expect(await getFeedPost(db, second.post.id, AUTHOR_USER)).toMatchObject({ returnedReason: "Приберіть обіцянку" });

    await db.from("feed_posts").update({ course_id: COURSE }).eq("id", second.post.id);
    const again = await resubmitFeedPost(db, await author(), second.post.id, {
      body: "Тиша допомагає.",
      topic: "focus",
    });
    expect(again.post.status).toBe("published");
    // The attachment is what was sent this time: none.
    expect(again.post.attachment).toBeNull();

    await db.from("feed_posts").update({ status: "returned" }).eq("id", second.post.id);
    await expect(
      resubmitFeedPost(db, await author(), second.post.id, {
        body: "Тиша допомагає.",
        topic: "focus",
        courseId: FOREIGN_COURSE,
      }),
    ).rejects.toMatchObject({ code: "attachment_not_yours" });
  });
});

describe("filter", () => {
  it("narrows by topic and author slug; an unknown author shows nothing", async () => {
    await createFeedPost(
      db,
      await author(),
      { body: "Про дихання", topic: "breathing" },
      new Date("2026-10-16T08:00:00Z"),
    );
    await createFeedPost(
      db,
      await author(OTHER_AUTHOR_USER),
      { body: "Про сон", topic: "relaxation" },
      new Date("2026-10-16T09:00:00Z"),
    );
    const by = async (topics: string[], authors: string[]) =>
      (await listFeed(db, { filter: { topics: topics as never, authors }, me: null })).posts.map((post) => post.body);
    expect(await by([], [])).toEqual(["Про сон", "Про дихання"]);
    expect(await by(["breathing"], [])).toEqual(["Про дихання"]);
    expect(await by([], ["avtor-2"])).toEqual(["Про сон"]);
    expect(await by(["breathing"], ["avtor-2"])).toEqual([]);
    expect(await by([], ["nobody"])).toEqual([]);
  });

  it("pages by the last published time", async () => {
    for (let i = 0; i < 3; i += 1) {
      await createFeedPost(
        db,
        await author(),
        { body: `Допис ${i}`, topic: "focus" },
        new Date(Date.UTC(2026, 9, 16, i)),
      );
    }
    const first = await listFeed(db, { filter: { topics: [], authors: [] }, me: null, limit: 2 });
    expect(first.posts.map((post) => post.body)).toEqual(["Допис 2", "Допис 1"]);
    const second = await listFeed(db, { filter: { topics: [], authors: [] }, me: null, limit: 2, before: first.next });
    expect(second.posts.map((post) => post.body)).toEqual(["Допис 0"]);
    expect(second.next).toBeNull();
  });
});

describe("reactions", () => {
  it("toggles one emoji per person and refuses one outside the set", async () => {
    const { post } = await createFeedPost(db, await author(), { body: "Привіт", topic: "focus" });
    expect(await toggleReaction(db, post.id, READER, "fire")).toEqual([{ emoji: "fire", count: 1, mine: true }]);
    expect(await toggleReaction(db, post.id, READER, "fire")).toEqual([]);
    await expect(toggleReaction(db, post.id, READER, "grinning")).rejects.toMatchObject({ code: "emoji_invalid" });
  });
});

describe("comments", () => {
  it("threads one level, names readers publicly, shows the author as themself, lets the author hide", async () => {
    const { post } = await createFeedPost(db, await author(), { body: "Привіт", topic: "focus" });
    const top = await addComment(db, post.id, READER, { body: "Дякую!" });
    expect(top.comment.who.name).toBe("Олена П.");
    const reply = await addComment(db, post.id, AUTHOR_USER, { body: "Радий!", parentId: top.comment.id });
    expect(reply.comment.who.href).toMatch(/^\/expert\/.+\?tab=posts$/);
    const nested = await addComment(db, post.id, READER, { body: "Ще раз", parentId: reply.comment.id });
    expect(nested.comment.parentId).toBe(top.comment.id);

    const asAuthor = await listComments(db, post.id, AUTHOR_USER);
    expect(asAuthor.map((entry) => [entry.who.name, entry.byAuthor, entry.canHide])).toEqual([
      ["Олена П.", false, true],
      ["Євгеній", true, false],
      ["Олена П.", false, true],
    ]);

    await removeComment(db, top.comment.id, AUTHOR_USER);
    // The thread goes with its first comment: replies have nowhere to hang.
    expect(await listComments(db, post.id, null)).toEqual([]);
    expect((await getFeedPost(db, post.id, null))?.commentCount).toBe(0);
    await expect(removeComment(db, reply.comment.id, READER)).rejects.toMatchObject({ code: "forbidden" });
  });

  it("holds a comment with a foreign link and shows it only to its writer", async () => {
    const { post } = await createFeedPost(db, await author(), { body: "Привіт", topic: "focus" });
    const held = await addComment(db, post.id, READER, { body: "Мій курс: https://elsewhere.com" });
    expect(held.held).toBe(true);
    expect(await listComments(db, post.id, null)).toHaveLength(0);
    expect(await listComments(db, post.id, READER)).toHaveLength(1);
  });
});

describe("marks for the journal", () => {
  it("saves, replaces by client id, and names the post's author", async () => {
    const { post } = await createFeedPost(db, await author(), { body: "Три хвилини дихання", topic: "breathing" });
    await saveFeedMark(db, READER, { clientId: "mark-000001", postId: post.id, quote: "дихання" });
    await saveFeedMark(db, READER, { clientId: "mark-000001", postId: post.id, quote: "дихання", note: "Спробую" });
    const marks = await listFeedMarks(db, READER);
    expect(marks).toHaveLength(1);
    expect(marks[0]).toMatchObject({ note: "Спробую", authorName: "Євгеній" });
  });
});

describe("wave 2: topics", () => {
  it("carries one to three topics, keeps the first as `topic`, and the filter matches any", async () => {
    const { post } = await createFeedPost(db, await author(), {
      body: "Дихання і сон",
      topics: ["breathing", "relaxation", "breathing"],
    });
    expect(post.topics).toEqual(["breathing", "relaxation"]);
    expect(post.topic).toBe("breathing");
    expect(fake.rows("feed_posts")[0]).toMatchObject({ topic: "breathing", topics: ["breathing", "relaxation"] });
    const by = async (topics: string[]) =>
      (await listFeed(db, { filter: { topics: topics as never, authors: [] }, me: null })).posts.length;
    expect(await by(["relaxation"])).toBe(1);
    expect(await by(["focus", "breathing"])).toBe(1);
    expect(await by(["focus"])).toBe(0);
  });

  it("refuses none, four, or an unknown one; the old single `topic` still posts", async () => {
    const me = await author();
    await expect(createFeedPost(db, me, { body: "Т", topics: [] })).rejects.toMatchObject({ code: "topic_invalid" });
    await expect(
      createFeedPost(db, me, { body: "Т", topics: ["focus", "energy", "movement", "nutrition"] }),
    ).rejects.toMatchObject({ code: "topic_invalid" });
    await expect(createFeedPost(db, me, { body: "Т", topics: ["focus", "announce"] })).rejects.toMatchObject({
      code: "topic_invalid",
    });
    expect((await createFeedPost(db, me, { body: "Т", topic: "focus" })).post.topics).toEqual(["focus"]);
  });

  it("reads a row from before the migration by its single topic", async () => {
    const { post } = await createFeedPost(db, await author(), { body: "Старий", topic: "energy" });
    await db.from("feed_posts").update({ topics: [] }).eq("id", post.id);
    expect((await getFeedPost(db, post.id, null))?.topics).toEqual(["energy"]);
  });
});

describe("wave 2: body with formatting", () => {
  it("counts the visible words, not the markup, and the gate sees a link hidden behind words", async () => {
    const me = await author();
    const words = "слово ".repeat(665).trim();
    const marked = `**${words}**`;
    expect((await createFeedPost(db, me, { body: marked, topic: "focus" })).post.status).toBe("published");
    await expect(createFeedPost(db, me, { body: "слово ".repeat(700), topic: "focus" })).rejects.toMatchObject({
      code: "body_too_long",
    });
    const hidden = await createFeedPost(db, me, { body: "Дивіться [тут](https://elsewhere.com/x)", topic: "focus" });
    expect(hidden.post.status).toBe("held");
    expect(hidden.verdict.findings.map((finding) => finding.rule)).toContain("links");
  });
});

describe("wave 2: media and tags", () => {
  const photo = (file = "1600.webp") => ({ path: `author-evg/${ASSET}/${file}`, w: 1600, h: 1000 });

  it("stores the author's own photos, a YouTube id from a link, and an audio; answers addresses", async () => {
    const { post } = await createFeedPost(db, await author(), {
      body: "Ранок",
      topic: "focus",
      media: {
        photos: [{ ...photo(), spoiler: true }, photo("640.webp")],
        video: { youtubeId: "https://youtu.be/dQw4w9WgXcQ" },
        audio: { path: `author-evg/${ASSET}/audio.webm`, durationSec: 61.4, mime: "audio/webm" },
      },
    });
    expect(post.media.photos.map((entry) => [entry.spoiler, entry.src.endsWith(`/feed-media/${entry.path}`)])).toEqual([
      [true, true],
      [false, true],
    ]);
    expect(post.media.video).toEqual({ youtubeId: "dQw4w9WgXcQ" });
    expect(post.media.audio).toMatchObject({ durationSec: 61, mime: "audio/webm" });
    expect(fake.rows("feed_posts")[0]?.media).not.toHaveProperty(["photos", 0, "src"]);
  });

  it("refuses another author's path, eleven photos, a bad link and a long audio", async () => {
    const me = await author();
    const post = (media: unknown) => createFeedPost(db, me, { body: "Т", topic: "focus", media });
    await expect(post({ photos: [{ ...photo(), path: `author-2/${ASSET}/1600.webp` }] })).rejects.toMatchObject({
      code: "media_invalid",
    });
    await expect(post({ photos: [{ ...photo(), path: `author-evg/../x/1600.webp` }] })).rejects.toMatchObject({
      code: "media_invalid",
    });
    await expect(
      post({ photos: Array.from({ length: 11 }, (_, i) => photo(i % 2 ? "640.webp" : "1600.webp")) }),
    ).rejects.toMatchObject({ code: "media_too_many_photos" });
    await expect(post({ video: { youtubeId: "not a video" } })).rejects.toMatchObject({ code: "media_video_invalid" });
    await expect(
      post({ audio: { path: `author-evg/${ASSET}/audio.webm`, durationSec: 601, mime: "audio/webm" } }),
    ).rejects.toMatchObject({ code: "media_audio_too_long" });
    await expect(
      post({ audio: { path: `author-evg/${ASSET}/audio.mp3`, durationSec: 10, mime: "audio/webm" } }),
    ).rejects.toMatchObject({ code: "media_invalid" });
  });

  it("names listed authors only, never the writer, at most three", async () => {
    const me = await author();
    const { post } = await createFeedPost(db, me, { body: "Разом", topic: "focus", taggedAuthorIds: [TAG_AUTHOR] });
    expect(post.tagged.map((entry) => entry.name)).toEqual(["Ірина Мельник"]);
    await expect(
      createFeedPost(db, me, { body: "Т", topic: "focus", taggedAuthorIds: [TAG_HIDDEN] }),
    ).rejects.toMatchObject({ code: "tags_invalid" });
    await expect(
      createFeedPost(db, me, { body: "Т", topic: "focus", taggedAuthorIds: ["author-2"] }),
    ).rejects.toMatchObject({ code: "tags_invalid" });
    // An author unlisted after the post was written drops out of its «з …».
    await db.from("lms_authors").update({ listed: false }).eq("id", TAG_AUTHOR);
    expect((await getFeedPost(db, post.id, null))?.tagged).toEqual([]);
  });

  it("offers every other listed author for tagging", async () => {
    const names = (await listTaggableAuthors(db, await author())).map((entry) => entry.slug).sort();
    expect(names).toEqual(["avtor-2", "iryna"]);
  });
});

describe("wave 2: block attachments carry the block", () => {
  it("hands the renderer the whole block only when the author shows it whole", async () => {
    const shown = await createFeedPost(db, await author(), {
      body: "Практика",
      topic: "breathing",
      courseId: COURSE,
      lessonId: LESSON,
      blockId: "b1",
      blockDisplay: "full",
    });
    expect(shown.post.attachment).toMatchObject({
      full: true,
      block: { id: "b1", type: "practice_block", durationMin: 3 },
    });
    const excerpt = await createFeedPost(db, await author(), {
      body: "Практика",
      topic: "breathing",
      courseId: COURSE,
      lessonId: LESSON,
      blockId: "b1",
    });
    // An excerpt never carries the block itself: a paid lesson stays paid.
    expect(excerpt.post.attachment).toMatchObject({ full: false, block: null });
  });
});

describe("wave 2: three reactions per person", () => {
  it("refuses a fourth different emoji, and frees a place when one is taken back", async () => {
    const { post } = await createFeedPost(db, await author(), { body: "Привіт", topic: "focus" });
    for (const emoji of ["fire", "heart", "calm"]) await toggleReaction(db, post.id, READER, emoji);
    await expect(toggleReaction(db, post.id, READER, "joy")).rejects.toMatchObject({
      code: "reaction_limit",
      status: 409,
    });
    // Someone else is not limited by the reader's three.
    await toggleReaction(db, post.id, AUTHOR_USER, "joy");
    await toggleReaction(db, post.id, READER, "fire");
    const after = await toggleReaction(db, post.id, READER, "joy");
    expect(
      after
        .filter((entry) => entry.mine)
        .map((entry) => entry.emoji)
        .sort(),
    ).toEqual(["calm", "heart", "joy"]);
  });
});

describe("wave 2: «Зберегти»", () => {
  it("saves once into the journal's marks as a bookmark, shows as saved, and comes back out", async () => {
    const { post } = await createFeedPost(db, await author(), { body: "**Три** хвилини дихання", topic: "breathing" });
    await saveFeedPost(db, READER, post.id);
    await saveFeedPost(db, READER, post.id);
    await saveFeedMark(db, READER, { clientId: "mark-000001", postId: post.id, quote: "дихання" });

    const journal = await listFeedMarks(db, READER);
    expect(journal.map((mark) => mark.kind).sort()).toEqual(["bookmark", "highlight"]);
    expect(journal.find((mark) => mark.kind === "bookmark")).toMatchObject({
      quote: "Три хвилини дихання",
      authorName: "Євгеній",
    });
    // The post's own paint asks only for passages.
    expect((await listFeedMarks(db, READER, [post.id])).map((mark) => mark.kind)).toEqual(["highlight"]);
    expect((await getFeedPost(db, post.id, READER))?.saved).toBe(true);
    expect((await getFeedPost(db, post.id, null))?.saved).toBe(false);
    // Everyone sees how many saved it; a passage mark is not a save, and saving twice counts once.
    expect((await getFeedPost(db, post.id, null))?.saveCount).toBe(1);

    await unsaveFeedPost(db, READER, post.id);
    expect((await getFeedPost(db, post.id, READER))?.saved).toBe(false);
    expect((await getFeedPost(db, post.id, null))?.saveCount).toBe(0);
    expect(await listFeedMarks(db, READER)).toHaveLength(1);
  });

  it("refuses a post that is not published, and a highlight posing as a bookmark", async () => {
    const { post } = await createFeedPost(db, await author(), { body: "Гарантую результат.", topic: "focus" });
    await expect(saveFeedPost(db, READER, post.id)).rejects.toMatchObject({ code: "not_found" });
    await expect(
      saveFeedMark(db, READER, { clientId: `saved-${post.id}`, postId: post.id, quote: "x" }),
    ).rejects.toMatchObject({ code: "client_id_invalid" });
  });
});

describe("publicName", () => {
  it("is a first name and an initial, never more", () => {
    expect(publicName("Олена Петренко")).toBe("Олена П.");
    expect(publicName("Марко")).toBe("Марко");
    expect(publicName("")).toBe("Учасник");
  });
});

describe("«Поділитися»: one per account", () => {
  it("counts a person once however often they share, and refuses an unknown channel", async () => {
    const { post } = await createFeedPost(db, await author(), { body: "Три хвилини дихання", topic: "breathing" });
    expect(await recordShare(db, post.id, READER, "link")).toBe(true);
    expect(await recordShare(db, post.id, READER, "telegram")).toBe(false);
    expect(await recordShare(db, post.id, "00000000-0000-4000-8000-0000000000aa", "system")).toBe(true);
    await expect(recordShare(db, post.id, READER, "email")).rejects.toMatchObject({ code: "share_invalid" });

    expect((await getFeedPost(db, post.id, null))?.shareCount).toBe(2);
    expect((await getFeedPost(db, post.id, READER))?.shared).toBe(true);
    expect((await getFeedPost(db, post.id, null))?.shared).toBe(false);
  });
});

describe("the platform as an author", () => {
  async function platform() {
    const found = await feedPlatformAuthor(db, ADMIN);
    if (!found) throw new Error("no platform author");
    return found;
  }

  it("is written by an admin, published at once, with the platform's name", async () => {
    expect(await isFeedAdmin(db, ADMIN)).toBe(true);
    expect(await isFeedAdmin(db, READER)).toBe(false);
    const { post } = await createFeedPost(
      db,
      await platform(),
      { body: "Гарантую результат.", topic: "focus" },
      new Date(),
      { platform: true },
    );
    expect(post.status).toBe("published");
    expect(post.author).toMatchObject({ slug: "centerway", name: "CenterWay" });
  });

  it("is pinned once: a new pinned post takes the tape and leads the first page", async () => {
    const first = await createFeedPost(db, await platform(), { body: "Перший", topic: "focus" }, new Date(), {
      platform: true,
      pinned: true,
    });
    await createFeedPost(db, await author(), { body: "Автор", topic: "focus" });
    const second = await createFeedPost(db, await platform(), { body: "Другий", topic: "focus" }, new Date(), {
      platform: true,
      pinned: true,
    });
    const page = await listFeed(db, { filter: { topics: [], authors: [] }, me: ADMIN });
    expect(page.posts[0]).toMatchObject({ id: second.post.id, pinned: true });
    expect(page.posts.find((entry) => entry.id === first.post.id)?.pinned).toBe(false);
    expect(page.posts.filter((entry) => entry.id === second.post.id)).toHaveLength(1);
  });

  it("is changed and removed by an admin, and by no one else", async () => {
    const { post } = await createFeedPost(db, await platform(), { body: "Вступ", topic: "focus" }, new Date(), {
      platform: true,
      pinned: true,
    });
    const asAdmin = await listFeed(db, { filter: { topics: [], authors: [] }, me: ADMIN });
    expect(asAdmin.posts[0]?.canManage).toBe(true);
    const asReader = await listFeed(db, { filter: { topics: [], authors: [] }, me: READER });
    expect(asReader.posts[0]?.canManage).toBe(false);

    const edited = await editPlatformPost(db, await platform(), post.id, {
      body: "Новий вступ",
      topic: "focus",
      pinned: false,
    });
    expect(edited.post).toMatchObject({ body: "Новий вступ", pinned: false, status: "published" });

    await deleteFeedPost(db, null, post.id, { userId: READER });
    expect((await getFeedPost(db, post.id, READER))?.id).toBe(post.id);
    await deleteFeedPost(db, null, post.id, { userId: ADMIN });
    expect(await getFeedPost(db, post.id, READER)).toBeNull();
  });
});
