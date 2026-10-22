import { describe, expect, it } from "vitest";

import { accountAvatar, accountAvatarCrop, accountMetaFromAuthor, accountName } from "./accountIdentity";

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
});
