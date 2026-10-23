/**
 * The shared path a person's own picture takes into `course-media`: every
 * rendition under one folder, one ledger row, and nothing left behind when a
 * step fails. The pipeline itself (sharp) is stood in for.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const prepareMedia = vi.fn();
vi.mock("@/lib/lms/mediaPipeline", () => ({
  MAX_INPUT_BYTES: 20 * 1024 * 1024,
  isPrepareFailure: (value: { error?: string }) => typeof value.error === "string",
  prepareMedia: (...args: unknown[]) => prepareMedia(...args),
}));

const { readProfileImageFile, storeProfileImage } = await import("./profileImage");

type Call = { path: string };
function fakeDb(options: { failUpload?: string; failLedger?: string } = {}) {
  const uploads: Call[] = [];
  const removed: string[][] = [];
  const ledger: Record<string, unknown>[] = [];
  const db = {
    storage: {
      from: () => ({
        upload: async (path: string) => {
          if (options.failUpload && path.endsWith(options.failUpload)) return { error: { message: "boom" } };
          uploads.push({ path });
          return { error: null };
        },
        remove: async (paths: string[]) => {
          removed.push(paths);
          return {};
        },
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn/course-media/${path}` } }),
      }),
    },
    from: () => ({
      insert: async (row: Record<string, unknown>) => {
        if (options.failLedger) return { error: { message: options.failLedger } };
        ledger.push(row);
        return { error: null };
      },
    }),
  };
  return { db: db as never, uploads, removed, ledger };
}

const file = () => new File([new Uint8Array([1, 2, 3])], "face.jpg", { type: "image/jpeg" });

beforeEach(() => {
  prepareMedia.mockReset();
  prepareMedia.mockResolvedValue({
    renditions: [
      { name: "1600.webp", contentType: "image/webp", bytes: new Uint8Array(10), width: 1600 },
      { name: "640.webp", contentType: "image/webp", bytes: new Uint8Array(4), width: 640 },
    ],
    width: 1600,
    height: 1600,
  });
});

describe("storeProfileImage", () => {
  it("stores every rendition under one folder and records one ledger row", async () => {
    const { db, uploads, ledger } = fakeDb();
    const result = await storeProfileImage(db, { prefix: "accounts/u1", uploadedBy: "u1", file: file() });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const folder = result.path.replace(/\/1600\.webp$/, "");
    expect(folder).toMatch(/^accounts\/u1\/[0-9a-f-]{36}$/);
    expect(uploads.map((call) => call.path)).toEqual([`${folder}/1600.webp`, `${folder}/640.webp`]);
    expect(result.src).toBe(`https://cdn/course-media/${folder}/1600.webp`);
    expect(ledger).toEqual([
      expect.objectContaining({ asset_key: folder, course_id: null, bytes: 14, uploaded_by: "u1" }),
    ]);
  });

  it("removes what it stored when a later rendition fails", async () => {
    const { db, removed, ledger } = fakeDb({ failUpload: "640.webp" });
    const result = await storeProfileImage(db, { prefix: "authors/u1", uploadedBy: "u1", file: file() });
    expect(result).toEqual({ ok: false, error: "media_upload_failed:boom", status: 502 });
    expect(removed).toHaveLength(1);
    expect(ledger).toHaveLength(0);
  });

  it("removes the objects when the ledger refuses the row", async () => {
    const { db, removed } = fakeDb({ failLedger: "nope" });
    const result = await storeProfileImage(db, { prefix: "authors/u1", uploadedBy: "u1", file: file() });
    expect(result).toEqual({ ok: false, error: "media_ledger_failed:nope", status: 502 });
    expect(removed[0]).toHaveLength(2);
  });

  it("answers 415 for bytes that are not an image", async () => {
    prepareMedia.mockResolvedValueOnce({ error: "media_not_an_image" });
    const { db, uploads } = fakeDb();
    const result = await storeProfileImage(db, { prefix: "accounts/u1", uploadedBy: "u1", file: file() });
    expect(result).toEqual({ ok: false, error: "media_not_an_image", status: 415 });
    expect(uploads).toHaveLength(0);
  });
});

describe("readProfileImageFile", () => {
  const request = (form: FormData) => new Request("http://localhost/x", { method: "POST", body: form });

  it("asks for the file field", async () => {
    expect(await readProfileImageFile(request(new FormData()))).toEqual({
      ok: false,
      error: "media_missing_file",
      status: 400,
    });
  });

  it("refuses a type the pipeline does not take", async () => {
    const form = new FormData();
    form.append("file", new File(["x"], "a.svg", { type: "image/svg+xml" }));
    expect(await readProfileImageFile(request(form))).toMatchObject({ ok: false, status: 415 });
  });
});
