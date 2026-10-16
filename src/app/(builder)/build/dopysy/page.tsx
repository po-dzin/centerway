import { BuilderPosts } from "@/components/builder/BuilderPosts";

/**
 * The author's own posts in «Стрічка»: what is out, what waits for the team,
 * what came back and why (2026-10-16).
 *
 * `dopysy` is a reserved slug (`BUILDER_RESERVED_SLUGS`) because this static
 * segment wins over `/build/[course]`.
 */
export default function BuilderPostsPage() {
  return <BuilderPosts />;
}
