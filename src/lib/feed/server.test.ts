import { beforeEach, describe, expect, it } from "vitest";

import { FakeSupabase } from "@/lib/admin/fakeSupabase";

import {
  FeedError,
  addComment,
  createFeedPost,
  decideHeldPost,
  feedAuthorForUser,
  getFeedPost,
  listComments,
  listFeed,
  listFeedMarks,
  publicName,
  removeComment,
  resubmitFeedPost,
  saveFeedMark,
  setReturnReason,
  toggleReaction,
  type Db,
} from "./server";

const AUTHOR_USER = "00000000-0000-4000-8000-0000000000a1";
const OTHER_AUTHOR_USER = "00000000-0000-4000-8000-0000000000a2";
const READER = "00000000-0000-4000-8000-0000000000b1";
const COURSE = "00000000-0000-4000-8000-0000000000c1";
const FOREIGN_COURSE = "00000000-0000-4000-8000-0000000000c2";
const LESSON = "00000000-0000-4000-8000-0000000000d1";

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
    ],
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

    const again = await resubmitFeedPost(db, await author(), second.post.id, {
      body: "Тиша допомагає.",
      topic: "focus",
    });
    expect(again.post.status).toBe("published");
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
  it("threads one level, names readers publicly, marks the author, lets the author hide", async () => {
    const { post } = await createFeedPost(db, await author(), { body: "Привіт", topic: "focus" });
    const top = await addComment(db, post.id, READER, { body: "Дякую!" });
    expect(top.comment.who.name).toBe("Олена П.");
    const reply = await addComment(db, post.id, AUTHOR_USER, { body: "Радий!", parentId: top.comment.id });
    const nested = await addComment(db, post.id, READER, { body: "Ще раз", parentId: reply.comment.id });
    expect(nested.comment.parentId).toBe(top.comment.id);

    const asAuthor = await listComments(db, post.id, AUTHOR_USER);
    expect(asAuthor.map((entry) => [entry.who.name, entry.byAuthor, entry.canHide])).toEqual([
      ["Олена П.", false, true],
      ["Автор", true, false],
      ["Олена П.", false, true],
    ]);

    await removeComment(db, top.comment.id, AUTHOR_USER);
    expect((await listComments(db, post.id, null)).map((entry) => entry.body)).toEqual(["Радий!", "Ще раз"]);
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

describe("publicName", () => {
  it("is a first name and an initial, never more", () => {
    expect(publicName("Олена Петренко")).toBe("Олена П.");
    expect(publicName("Марко")).toBe("Марко");
    expect(publicName("")).toBe("Учасник");
  });
});
