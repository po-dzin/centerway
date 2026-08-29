import { describe, expect, it } from "vitest";

import { isAdminRole, isStaffRole } from "./adminRole";

/**
 * The predicate used to exist twice, in the two admin route files, and the
 * header was about to make a third copy. These cases are the behaviour those
 * copies had between them — including the capitalised spellings one of them
 * matched explicitly, which is why this normalises rather than compares.
 */
describe("isAdminRole", () => {
  it("admits admin and support", () => {
    expect(isAdminRole("admin")).toBe(true);
    expect(isAdminRole("support")).toBe(true);
  });

  it("is case- and whitespace-insensitive", () => {
    // The old predicate hardcoded "Admin"/"Support" alongside the lowercase
    // pair, which says the data has been seen in both spellings.
    for (const value of ["Admin", "ADMIN", " admin ", "Support"]) {
      expect(isAdminRole(value)).toBe(true);
    }
  });

  it("refuses everything else, including the absent role", () => {
    for (const value of ["user", "author", "", "administrator", "adm", null, undefined]) {
      expect(isAdminRole(value)).toBe(false);
    }
  });

  it("does not admit a role that merely contains an admitted one", () => {
    // Guards against a future refactor reaching for .includes().
    expect(isAdminRole("nonadmin")).toBe(false);
    expect(isAdminRole("admin-readonly")).toBe(false);
  });
});

describe("isStaffRole", () => {
  it("is wider than admin: coach is staff, not an admin", () => {
    expect(isStaffRole("coach")).toBe(true);
    expect(isAdminRole("coach")).toBe(false);
  });

  it("covers everyone admin covers", () => {
    for (const role of ["admin", "support"]) {
      expect(isAdminRole(role)).toBe(true);
      expect(isStaffRole(role)).toBe(true);
    }
  });

  it("refuses buyers and the absent role", () => {
    for (const value of ["user", "", null, undefined]) {
      expect(isStaffRole(value)).toBe(false);
    }
  });
});
