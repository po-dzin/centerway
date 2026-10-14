/**
 * YouTube addresses built from a stored video id. The id is all the platform
 * keeps (see `youtubeIdFrom` in src/lms-core/blocks.ts); these are the two
 * places it is turned back into something a browser loads.
 */

/** YouTube's own still for a video — what a gallery tile shows before play. */
export function youtubePoster(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

/** The privacy-enhanced player, started on load because a press opened it. */
export function youtubeEmbed(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&autoplay=1`;
}
