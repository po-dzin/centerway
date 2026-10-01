import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { AGENT_USER_AGENT, isAgentRequest, isAgentUserAgent } from "./agentTraffic";

const headers = (entries: Record<string, string>) => new Headers(entries);
const CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const IPHONE_INSTAGRAM =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 390.0.0.0";

describe("isAgentUserAgent", () => {
  it.each([
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ChatGPT-User/1.0; +https://openai.com/bot)",
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-User/1.0; +Claude-User@anthropic.com)",
    "Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)",
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/140.0.0.0 Safari/537.36",
  ])("names %s an agent", (ua) => {
    expect(isAgentUserAgent(ua)).toBe(true);
  });

  it("leaves people alone, including in-app browsers", () => {
    expect(isAgentUserAgent(CHROME)).toBe(false);
    expect(isAgentUserAgent(IPHONE_INSTAGRAM)).toBe(false);
    expect(isAgentUserAgent(null)).toBe(false);
  });
});

describe("isAgentRequest", () => {
  it("catches a signed browser agent whose User-Agent is plain Chrome", () => {
    expect(isAgentRequest(headers({ "user-agent": CHROME, "signature-agent": '"https://chatgpt.com"' }))).toBe(true);
  });

  it("trusts the cookie the proxy set on an earlier request", () => {
    expect(isAgentRequest(headers({ "user-agent": CHROME }), "1")).toBe(true);
  });

  it("is false for a person", () => {
    expect(isAgentRequest(headers({ "user-agent": CHROME }), undefined)).toBe(false);
    expect(isAgentRequest(headers({ "user-agent": CHROME }), "0")).toBe(false);
  });
});

describe("the landings' copy", () => {
  it("carries the same pattern — the static bundle cannot import this module", () => {
    const pixel = readFileSync(join(process.cwd(), "src/landing-static/shared/js/landing-pixel.js"), "utf8");
    expect(pixel).toContain(`/${AGENT_USER_AGENT.source}/i`);
  });
});
