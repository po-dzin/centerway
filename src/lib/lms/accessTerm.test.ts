import { describe, expect, it } from "vitest";

import { ACCESS_TERM_NOTES, accessRuleForNote, noteForAccessRule, presetNoteFor, sameAccessRule } from "./accessTerm";

describe("access term: one choice, the words and the rule", () => {
  it("maps every preset to the rule it promises", () => {
    expect(accessRuleForNote("30 днів")).toEqual({ accessDays: 30, accessLifetime: false });
    expect(accessRuleForNote("Пів року")).toEqual({ accessDays: 180, accessLifetime: false });
    expect(accessRuleForNote("Рік")).toEqual({ accessDays: 365, accessLifetime: false });
    expect(accessRuleForNote("Назавжди")).toEqual({ accessDays: null, accessLifetime: true });
  });

  it("does not invent a rule for words that are not a preset", () => {
    expect(accessRuleForNote("доступ назавжди")).toBeNull();
    expect(accessRuleForNote("")).toBeNull();
    expect(accessRuleForNote(undefined)).toBeNull();
  });

  it("round-trips every preset", () => {
    for (const note of ACCESS_TERM_NOTES) {
      const rule = accessRuleForNote(note);
      expect(rule).not.toBeNull();
      expect(noteForAccessRule(rule!)).toBe(note);
    }
  });

  it("gives honest words to a catalogue term the author's list does not offer", () => {
    expect(noteForAccessRule({ accessDays: 14, accessLifetime: false })).toBe("14 днів");
  });

  it("compares rules by what they grant", () => {
    expect(sameAccessRule({ accessDays: null, accessLifetime: true }, { accessDays: 30, accessLifetime: true })).toBe(
      true,
    );
    expect(sameAccessRule({ accessDays: 30, accessLifetime: false }, { accessDays: 30, accessLifetime: false })).toBe(
      true,
    );
    expect(sameAccessRule({ accessDays: 30, accessLifetime: false }, { accessDays: null, accessLifetime: true })).toBe(
      false,
    );
  });
});

describe("presetNoteFor", () => {
  it("reads a hand-written note as the preset it names", () => {
    expect(presetNoteFor("Назавжди")).toBe("Назавжди");
    expect(presetNoteFor("доступ назавжди")).toBe("Назавжди");
    expect(presetNoteFor("Доступ назавжди ")).toBe("Назавжди");
    expect(presetNoteFor("  90  днів")).toBe("90 днів");
  });

  it("names nothing for prose that is not a term, or for nothing", () => {
    expect(presetNoteFor("доступ до матеріалів лишається після програми")).toBeNull();
    expect(presetNoteFor("")).toBeNull();
    expect(presetNoteFor(undefined)).toBeNull();
  });
});
