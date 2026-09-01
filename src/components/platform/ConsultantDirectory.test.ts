import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ConsultantDirectory } from "./ConsultantDirectory";

describe("ConsultantDirectory", () => {
  it("renders a cabinet-uploaded external portrait without Next image host validation", () => {
    const html = renderToStaticMarkup(createElement(ConsultantDirectory, {
      authors: [{
        id: "author-1",
        slug: "author",
        name: "Автор",
        photo: {
          src: "https://project.supabase.co/storage/v1/object/public/course-media/authors/author-1/photo.webp",
          alt: "Портрет автора",
        },
        consultation: { enabled: true, summary: "Онлайн-розмова" },
      }],
    }));

    expect(html).toContain('src="https://project.supabase.co/storage/v1/object/public/course-media/authors/author-1/photo.webp"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain("Профіль і консультація");
  });
});
