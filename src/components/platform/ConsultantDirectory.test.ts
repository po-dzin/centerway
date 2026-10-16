import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ConsultantDirectory } from "./ConsultantDirectory";

const withConsultation = {
  id: "author-1",
  slug: "author",
  name: "Автор",
  role: "Аюрведа",
  photo: {
    src: "https://project.supabase.co/storage/v1/object/public/course-media/authors/author-1/photo.webp",
    alt: "Портрет автора",
  },
  consultation: {
    enabled: true,
    title: "Аюрведична консультація",
    summary: "Онлайн-розмова",
    points: ["Харчування", "Режим дня"],
  },
};

describe("ConsultantDirectory", () => {
  it("shows each author's consultation, with the profile and the open request as its two ways in", () => {
    const html = renderToStaticMarkup(createElement(ConsultantDirectory, { authors: [withConsultation] }));

    expect(html).toContain("З ким можна поговорити");
    expect(html).toContain("Аюрведична консультація");
    expect(html).toContain("Режим дня");
    /* Points win over the summary: the card shows one of the two. */
    expect(html).not.toContain("Онлайн-розмова");
    /* The whole card is the profile; the button goes straight to the request. */
    expect(html).toContain('href="/expert/author"');
    expect(html).toContain('href="/expert/author#request"');
    expect(html).toContain("Записатися");
    /* No second, textual way to the profile. */
    expect(html).not.toContain("Більше про автора");
  });

  it("renders nothing for an author who has not agreed to consultations", () => {
    const html = renderToStaticMarkup(
      createElement(ConsultantDirectory, {
        authors: [withConsultation, { id: "author-2", slug: "second", name: "Другий автор" }],
      }),
    );
    expect(html).not.toContain("Другий автор");
  });

  it("has no block at all with nobody to list", () => {
    expect(renderToStaticMarkup(createElement(ConsultantDirectory, { authors: [] }))).toBe("");
  });
});
