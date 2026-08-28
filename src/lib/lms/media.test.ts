import { describe, expect, it } from "vitest";

import { mediaSources } from "./media";

const BASE = "https://x.supabase.co/storage/v1/object/public/course-media/courses/c1/abc";

describe("mediaSources", () => {
  it("offers the smaller rendition for an upload made by the route", () => {
    const { srcSet } = mediaSources(`${BASE}/1600.webp`);
    expect(srcSet).toBe(`${BASE}/1600.webp 1600w, ${BASE}/640.webp 640w`);
  });

  it("stays silent about flat paths written before the pipeline existed", () => {
    expect(mediaSources(`https://x.supabase.co/storage/v1/object/public/course-media/courses/c1/abc.webp`).srcSet)
      .toBeUndefined();
  });

  it("stays silent about an animation, which has no renditions", () => {
    expect(mediaSources(`${BASE}/original.gif`).srcSet).toBeUndefined();
  });

  it("does not let a pasted link claim renditions it never had", () => {
    expect(mediaSources("https://someone-else.example/img/1600.webp").srcSet).toBeUndefined();
  });

  it("leaves a repo asset alone", () => {
    expect(mediaSources("/cw/platform/cabinet/cover.webp")).toEqual({ src: "/cw/platform/cabinet/cover.webp" });
  });
});
