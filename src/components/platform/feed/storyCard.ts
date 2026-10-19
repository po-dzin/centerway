"use client";

/** A shareable file, prepared before the share gesture so iOS keeps activation. */
export async function storyCard(input: {
  author: string;
  text: string;
  image: string | null;
  url: string;
}): Promise<File> {
  await document.fonts.ready;
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unavailable");
  const tokens = getComputedStyle(document.documentElement);
  const color = (token: string) => tokens.getPropertyValue(token).trim();
  // Resolve CSS aliases through a temporary element: canvas does not resolve var().
  const resolved = (token: string) => {
    const element = document.createElement("span");
    element.style.color = `var(${token})`;
    document.body.append(element);
    const value = getComputedStyle(element).color;
    element.remove();
    return value;
  };
  ctx.fillStyle = resolved("--cw-platform-bg");
  ctx.fillRect(0, 0, 1080, 1920);
  ctx.fillStyle = resolved("--cw-platform-text");
  const face = color("--cw-font-ui") || "sans-serif";
  ctx.font = `600 42px ${face}`;
  ctx.fillText("CenterWay · Стрічка", 80, 150);
  ctx.font = `600 54px ${face}`;
  ctx.fillText(input.author, 80, 270, 920);
  let y = 370;
  if (input.image) {
    try {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.src = input.image;
      await image.decode();
      // Fit the whole photo: no cropping someone else's composition.
      const scale = Math.min(920 / image.naturalWidth, 800 / image.naturalHeight);
      const w = image.naturalWidth * scale;
      const h = image.naturalHeight * scale;
      ctx.drawImage(image, (1080 - w) / 2, y, w, h);
      y += h + 70;
    } catch {
      /* The post's words still make a complete card when media is unavailable. */
    }
  }
  ctx.font = `400 46px ${face}`;
  const maxLines = Math.max(3, Math.floor((1660 - y) / 68));
  const words = input.text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (ctx.measureText(`${line} ${word}`).width > 920 && line) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  lines.slice(0, maxLines).forEach((text, index) => {
    const last = index === maxLines - 1 && lines.length > maxLines;
    ctx.fillText(last ? `${text.slice(0, -2)}…` : text, 80, y + index * 68, 920);
  });
  ctx.fillStyle = resolved("--cw-platform-muted");
  ctx.font = `400 28px ${face}`;
  const url = new URL(input.url);
  ctx.fillText(`${url.host}${url.pathname}`, 80, 1800, 920);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((value) => (value ? resolve(value) : reject(new Error("canvas_failed"))), "image/png"),
  );
  return new File([blob], "centerway-story.png", { type: "image/png" });
}
