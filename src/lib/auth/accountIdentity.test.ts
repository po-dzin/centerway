import { describe, expect, it } from "vitest";

import {
  accountAvatar,
  accountAvatarCrop,
  accountMetaFromAuthor,
  accountMetaFromUpload,
  accountName,
  providerAvatarAtSize,
} from "./accountIdentity";

describe("account identity", () => {
  const google = { full_name: "Gleb P.", name: "Gleb", avatar_url: "https://lh3/g.jpg" };

  it("reads the provider's name and photo when nothing was chosen", () => {
    expect(accountName(google)).toBe("Gleb P.");
    expect(accountAvatar(google)).toBe("https://lh3/g.jpg");
    expect(accountAvatarCrop(google)).toBeUndefined();
  });

  it("prefers the chosen name and photo, which a Google sign-in never overwrites", () => {
    const meta = { ...google, cw_name: "Центр П.", cw_avatar: "https://cw/face.webp", cw_avatar_crop: { x: 40 } };
    expect(accountName(meta)).toBe("Центр П.");
    expect(accountAvatar(meta)).toBe("https://cw/face.webp");
    expect(accountAvatarCrop(meta)).toEqual({ x: 40 });
  });

  it("clears the chosen photo when the profile has none", () => {
    expect(accountMetaFromAuthor({ name: "Центр П." })).toEqual({
      cw_name: "Центр П.",
      cw_avatar: null,
      cw_avatar_crop: null,
    });
  });

  it("puts an uploaded face first and drops the crop that framed the old one", () => {
    const meta = { ...google, cw_avatar: "https://cw/old.webp", cw_avatar_crop: { x: 40 } };
    const patch = accountMetaFromUpload("https://cw/new.webp");
    expect(patch).toEqual({ cw_avatar: "https://cw/new.webp", cw_avatar_crop: null });
    /* As Supabase merges it: a null key is removed. */
    const merged = Object.fromEntries(Object.entries({ ...meta, ...patch }).filter(([, value]) => value !== null));
    expect(accountAvatar(merged)).toBe("https://cw/new.webp");
    expect(accountAvatarCrop(merged)).toBeUndefined();
  });
});

describe("provider avatar size", () => {
  it("asks Google for a larger picture and leaves our own uploads alone", () => {
    expect(providerAvatarAtSize("https://lh3.googleusercontent.com/a/abc=s96-c", 1024)).toBe(
      "https://lh3.googleusercontent.com/a/abc=s1024-c",
    );
    expect(providerAvatarAtSize("https://x.supabase.co/storage/v1/object/public/course-media/a/1600.webp", 1024)).toBe(
      "https://x.supabase.co/storage/v1/object/public/course-media/a/1600.webp",
    );
    expect(providerAvatarAtSize(null, 256)).toBeNull();
  });
});
