/**
 * A phone's photo is several megabytes; the host refuses a request body over
 * 4.5 MB before the route sees it, so the photo is made smaller here first. The
 * server prepares its own renditions from whatever arrives (2400 px is more than
 * the widest one it keeps). A file that is small enough, an animation, or one the
 * browser cannot draw goes as it is.
 */

const KEEP_BELOW = 3 * 1024 * 1024;
const LONG_EDGE = 2400;

export async function shrinkPhoto(file: File): Promise<File> {
  if (file.size <= KEEP_BELOW || file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, LONG_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}
