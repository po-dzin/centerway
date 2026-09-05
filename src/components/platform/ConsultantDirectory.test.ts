import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ConsultantDirectory } from "./ConsultantDirectory";

describe("ConsultantDirectory", () => {
  it("renders every listed author in the consultation carousel, including an author without consultation opt-in", () => {
    const html = renderToStaticMarkup(createElement(ConsultantDirectory, {
      authors: [{
        id: "author-1",
        slug: "author",
        name: "Автор",
        photo: {
          src: "https://project.supabase.co/storage/v1/object/public/course-media/authors/author-1/photo.webp",
          alt: "Портрет автора",
        },
        bio: "Дослідник і практик",
        experienceBadge: "12 років практики",
        achievementBadge: "Магістр комплементарної медицини",
        facts: ["Перший факт", "Другий факт", "Третій факт", "Не показуємо"],
        consultation: { enabled: true, summary: "Онлайн-розмова" },
      }, {
        id: "author-2",
        slug: "second-author",
        name: "Другий автор",
        bio: "Автор програми",
      }],
    }));

    expect(html).toContain('src="https://project.supabase.co/storage/v1/object/public/course-media/authors/author-1/photo.webp"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain("Третій факт");
    expect(html).not.toContain("Не показуємо");
    /* The badges repeat the facts word for word on a real profile, so a card
       that has facts shows the list alone — see `AuthorCard`. */
    expect(html).not.toContain("12 років практики");
    expect(html).toContain("Другий автор");
    /* An author with nothing to list still says something: their own line. */
    expect(html).toContain("Автор програми");
    /* Every card carries the way through to the author's own page. */
    expect(html).toContain('href="/expert/author"');
    expect(html).toContain("Більше про автора");
    /* The block's own header: the noun labels it, the heading is a sentence —
       the same shape every block on the hub uses. */
    expect(html).toContain("Автори");
    expect(html).toContain("З ким можна продовжити розмову");
  });
});
