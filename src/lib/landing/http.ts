export function htmlResponse(
  html: string,
  cacheControl = "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400"
): Response {
  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": cacheControl,
    },
  });
}
