import { describe, expect, it } from "vitest";

import { CONTENT_SIGNAL, TRAINING_CRAWLERS, renderRobots } from "./agentPolicy";

/** Groups as a crawler reads them: consecutive User-Agent lines share the rules under them. */
function groups(robots: string): Array<{ agents: string[]; rules: string[] }> {
  const out: Array<{ agents: string[]; rules: string[] }> = [];
  for (const raw of robots.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith("Sitemap:")) continue;
    const [key, ...rest] = line.split(":");
    const value = rest.join(":").trim();
    const last = out.at(-1);
    if (key === "User-Agent") {
      if (last && last.rules.length === 0) last.agents.push(value);
      else out.push({ agents: [value], rules: [] });
    } else {
      last?.rules.push(`${key}: ${value}`);
    }
  }
  return out;
}

describe("renderRobots", () => {
  it("opens the showcase to everyone and states the signal there", () => {
    const star = groups(renderRobots({ personal: false })).find((g) => g.agents.includes("*"));
    expect(star?.rules).toEqual([`Content-Signal: ${CONTENT_SIGNAL}`, "Allow: /"]);
  });

  it("closes the showcase to every training crawler, in one group", () => {
    const training = groups(renderRobots({ personal: false })).find((g) => g.agents.includes("GPTBot"));
    expect(training?.agents).toEqual([...TRAINING_CRAWLERS]);
    expect(training?.rules).toEqual(["Disallow: /"]);
  });

  it("never names an agent that also serves search or a person's request", () => {
    const refused = new Set<string>(TRAINING_CRAWLERS);
    for (const agent of [
      "Googlebot",
      "Bingbot",
      "Applebot",
      "OAI-SearchBot",
      "ChatGPT-User",
      "Claude-SearchBot",
      "Claude-User",
      "PerplexityBot",
      "Perplexity-User",
    ]) {
      expect(refused.has(agent)).toBe(false);
    }
  });

  it("closes the personal host to everyone, without a sitemap", () => {
    const robots = renderRobots({ personal: true });
    expect(groups(robots)).toEqual([{ agents: ["*"], rules: ["Disallow: /"] }]);
    expect(robots).not.toContain("Sitemap:");
  });

  it("keeps the training refusal out of the signal's open half", () => {
    expect(CONTENT_SIGNAL).toContain("ai-train=no");
    expect(CONTENT_SIGNAL).toContain("search=yes");
    expect(CONTENT_SIGNAL).toContain("ai-input=yes");
  });
});
