import { tool } from "ai";
import { z } from "zod";

/**
 * This tool is NOT scraping the web.
 * It’s a simple router:
 * given what the user wants + allowed domains,
 * return a small list of candidate PDP URLs to try with Rye.
 *
 * You can start simple and evolve later.
 */
export const findAllowedMerchantUrlsTool = tool({
  description:
    "Given a product intent and allowed merchants, return candidate product URLs from ONLY the allowed merchant domains.",

  // ✅ MUST be a z.object(...)
  inputSchema: z.object({
    query: z.string().min(1).describe("What the user is looking for"),
    allowedDomains: z
      .array(z.string())
      .min(1)
      .describe("List of allowed merchant domains"),
    maxResults: z
      .number()
      .min(1)
      .max(10)
      .default(3)
      .describe("Max URLs to return"),
  }),

  async *execute({ query, allowedDomains, maxResults = 3 }) {
    yield { state: "loading" as const };

    /**
     * v0 approach:
     * We don’t scrape here.
     * We just return domain-scoped search URLs
     * so the model can:
     *  1) pick a domain
     *  2) use searchAmazonProducts OR a domain-specific search tool later
     *
     * If you *do* want real PDP discovery later,
     * we’ll add per-merchant search tools (Nike, REI, etc.)
     */
    const urls = allowedDomains.slice(0, maxResults).map((domain) => {
      // Provide a safe search URL on that domain
      const q = encodeURIComponent(query);
      return `https://${domain}/search?q=${q}`;
    });

    yield {
      state: "ready" as const,
      urls,
      query,
      totalResults: urls.length,
    };
  },
});