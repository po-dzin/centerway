/**
 * Make an author's file small enough to travel, before it travels.
 *
 * THE SYMPTOM THIS IS FOR. Replacing a profile photo from a phone looked
 * broken: you pick the picture, and for the better part of a minute nothing
 * happens. Nothing was broken. A current phone camera writes 8–12 MB per
 * frame, the form was posting those bytes untouched, and on mobile data that
 * is most of a minute of upload before the server has anything to prepare.
 *
 * WHY THIS IS NOT THE SECOND COPY OF A RULE. `mediaPipeline.ts` says the
 * downscale belongs on the server and only there, because "what may be stored"
 * must not exist in two places that can drift. It still does: this decides
 * nothing about what is STORED. It is a transport bound, deliberately far
 * above the pipeline's own 1600px ceiling — anything this hands over is still
 * re-measured, re-encoded and bounded server-side exactly as a file posted
 * straight from a laptop is. If this module were deleted tomorrow, every
 * stored rendition would be byte-for-byte what it is today, just slower to
 * arrive.
 *
 * IT ALSO FIXES HEIC BY ACCIDENT, AND THAT IS FINE. An iPhone set to keep
 * originals hands over `image/heic`, which the upload route rejects. The
 * browser can decode what it can display, and what comes out of the canvas
 * here is always JPEG — so a photo the product used to refuse now uploads. A
 * file the browser cannot decode is passed through untouched, and the route
 * gives the same answer it always did.
 */

/** Well above the pipeline's 1600px, and still ~1/10th the bytes of a phone frame. */
const MAX_EDGE = 2400;

/** Under this there is nothing to win — the re-encode would cost more than it saves. */
const WORTH_SHRINKING_BYTES = 1.5 * 1024 * 1024;

const RE_ENCODE_QUALITY = 0.9;

export async function shrinkForUpload(file: File): Promise<File> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return file;

  /* A GIF is the one format whose point is that it moves; a canvas would hand
     back its first frame and call that the picture. The pipeline keeps GIFs
     whole for the same reason. */
  if (file.type === "image/gif") return file;

  const isHeic = file.type === "image/heic" || file.type === "image/heif";
  if (file.size < WORTH_SHRINKING_BYTES && !isHeic) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    /* Not decodable here — hand the original over and let the route answer. */
    return file;
  }

  try {
    const longest = Math.max(bitmap.width, bitmap.height);
    const ratio = longest > MAX_EDGE ? MAX_EDGE / longest : 1;
    /* An undecodable HEIC would have thrown above, so reaching here with one
       means the browser CAN read it — and it must still be re-encoded even at
       1:1, because JPEG is the part the route will accept. */
    if (ratio === 1 && !isHeic) return file;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * ratio);
    canvas.height = Math.round(bitmap.height * ratio);
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", RE_ENCODE_QUALITY)
    );
    if (!blob) return file;
    /* Never send the bigger of the two. A small, already-optimised JPEG can
       come back out of the canvas larger than it went in. */
    if (blob.size >= file.size && !isHeic) return file;

    const name = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${name}.jpg`, { type: "image/jpeg", lastModified: file.lastModified });
  } finally {
    bitmap.close();
  }
}
