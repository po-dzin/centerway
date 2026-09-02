import { describe, expect, it } from "vitest";

import {
  OTP_CODE_LENGTH,
  classifySignInError,
  isCompleteOtpCode,
  normalizeOtpCode,
  normalizeSignInEmail,
} from "./emailSignIn";

describe("normalizeSignInEmail", () => {
  it("trims and lowercases, because the address is matched against a paid order", () => {
    expect(normalizeSignInEmail("  Buyer@Ukr.NET ")).toBe("buyer@ukr.net");
  });

  it("accepts the mail hosts this door was built for", () => {
    for (const address of [
      "buyer@ukr.net",
      "buyer@i.ua",
      "buyer@icloud.com",
      "buyer@meta.ua",
      "buyer.name+way21@gmail.com",
      "b@x.co",
    ]) {
      expect(normalizeSignInEmail(address)).toBe(address);
    }
  });

  it("rejects what is not an address at all", () => {
    for (const bad of ["", "   ", "buyer", "buyer@", "@ukr.net", "buyer@@ukr.net", "buyer @ukr.net", "buyer@ukr"]) {
      expect(normalizeSignInEmail(bad)).toBeNull();
    }
  });

  it("rejects a trailing or leading dot in the domain rather than sending mail nowhere", () => {
    expect(normalizeSignInEmail("buyer@.ukr.net")).toBeNull();
    expect(normalizeSignInEmail("buyer@ukr.net.")).toBeNull();
  });
});

describe("normalizeOtpCode", () => {
  it("keeps the digits out of however the code was pasted", () => {
    expect(normalizeOtpCode("123 456")).toBe("123456");
    expect(normalizeOtpCode("Ваш код: 123456")).toBe("123456");
    expect(normalizeOtpCode("123-456")).toBe("123456");
  });

  it("keeps a leading zero, which is why the field is not type=number", () => {
    expect(normalizeOtpCode("012345")).toBe("012345");
    expect(isCompleteOtpCode(normalizeOtpCode("012345"))).toBe(true);
  });

  it("stops at the code length so a pasted paragraph cannot overflow the field", () => {
    expect(normalizeOtpCode("1234567890")).toHaveLength(OTP_CODE_LENGTH);
  });

  it("is not complete until every digit is there", () => {
    expect(isCompleteOtpCode("12345")).toBe(false);
    expect(isCompleteOtpCode("123456")).toBe(true);
  });
});

describe("classifySignInError", () => {
  it("says nothing went wrong when nothing went wrong", () => {
    expect(classifySignInError(null)).toBeNull();
  });

  it("reads a rate limit from the status before trusting any wording", () => {
    expect(classifySignInError({ message: "whatever it says today", status: 429 })).toBe("rate_limited");
    expect(
      classifySignInError({ message: "For security purposes, you can only request this after 51 seconds" })
    ).toBe("rate_limited");
  });

  it("separates an expired code from a wrong one, since only one of them means try again", () => {
    expect(classifySignInError({ message: "Token has expired or is invalid" })).toBe("expired_code");
    expect(classifySignInError({ message: "Invalid token" })).toBe("invalid_code");
    expect(classifySignInError({ message: "Invalid OTP" })).toBe("invalid_code");
  });

  it("recognises the client that could not be built at all", () => {
    expect(classifySignInError({ message: "auth_unavailable" })).toBe("unavailable");
  });

  it("falls back rather than guessing, so an unknown failure still gets a real message", () => {
    expect(classifySignInError({ message: "Signups not allowed for otp" })).toBe("unknown");
    expect(classifySignInError({ message: "" })).toBe("unknown");
  });
});
