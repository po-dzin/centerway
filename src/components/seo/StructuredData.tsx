/**
 * One way to put a graph on a page.
 *
 * A server component on purpose: structured data has to be in the HTML the
 * crawler is handed, not written in by a client effect. `<` is escaped because
 * a course title is author-supplied text and `</script>` inside a JSON string
 * would otherwise end the block early.
 */
import type { ReactElement } from "react";

export function JsonLd({ data }: { data: Record<string, unknown> }): ReactElement {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
