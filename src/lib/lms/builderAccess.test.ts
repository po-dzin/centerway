import { describe, expect, it } from "vitest";

import { canCreateCourse, canEditCourse, courseFilterFor, type BuilderIdentity } from "./builderAccess";

const admin: BuilderIdentity = { authUserId: "admin-1", email: "a@example.com", isAdmin: true };
const author: BuilderIdentity = { authUserId: "author-1", email: "b@example.com", isAdmin: false };
const other: BuilderIdentity = { authUserId: "author-2", email: "c@example.com", isAdmin: false };

describe("builder access", () => {
  it("lets an author edit their own course", () => {
    expect(canEditCourse(author, "author-1")).toBe(true);
  });

  it("refuses another author's course", () => {
    expect(canEditCourse(other, "author-1")).toBe(false);
  });

  /**
   * The case a naive `authorId !== identity.id` check gets exactly backwards.
   *
   * Both courses that exist today have author_id NULL, meaning house-managed.
   * Read as "no owner, so nobody is excluded", every signed-in learner could
   * edit way21.
   */
  it("treats an unowned course as admin-only, not as everyone's", () => {
    expect(canEditCourse(author, null)).toBe(false);
    expect(canEditCourse(other, null)).toBe(false);
    expect(canEditCourse(admin, null)).toBe(true);
  });

  it("lets an admin edit any course", () => {
    expect(canEditCourse(admin, "author-1")).toBe(true);
  });

  it("scopes the list to the author, and leaves it unscoped for an admin", () => {
    expect(courseFilterFor(author)).toEqual({ authorId: "author-1" });
    expect(courseFilterFor(admin)).toEqual({});
  });

  it("never scopes to an empty author id", () => {
    // An empty filter value would silently widen the list to every course,
    // because the query only applies `.eq` when the field is truthy.
    const filter = courseFilterFor(author);
    expect(filter.authorId).toBeTruthy();
  });
});

describe("first course permission", () => {
  it("admits a linked author profile without a course, but not an ordinary learner", () => {
    expect(canCreateCourse({ ...author, hasAuthorProfile: true }, 0)).toBe(true);
    expect(canCreateCourse(author, 0)).toBe(false);
    expect(canCreateCourse(author, 1)).toBe(true);
    expect(canEditCourse({ ...author, hasAuthorProfile: true }, "author-2")).toBe(false);
  });
});
