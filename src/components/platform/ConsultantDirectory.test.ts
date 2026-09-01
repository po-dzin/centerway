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
    expect(html).toContain("12 років практики");
    expect(html).toContain("Магістр комплементарної медицини");
    expect(html).toContain("Дослідник і практик");
    expect(html).toContain("Третій факт");
    expect(html).not.toContain("Не показуємо");
    expect(html).toContain("Другий автор");
    expect(html).toContain("Автори CenterWay");
  });
});
