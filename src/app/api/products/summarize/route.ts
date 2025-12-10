import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { z } from "zod";

const BodySchema = z.object({
  url: z.string().url(),
  name: z.string().optional(),
});

const ALLOWED_REVIEW_DOMAINS = [
  "dcrainmaker.com",
  "reddit.com",
  "amazon.com",
  "rei.com",
  "nike.com",
  "lululemon.com",
  "whoop.com",
  "therabody.com",
];

const ALLOWED_REVIEW_SOURCES: Array<{
  match: RegExp;
  reviews: string[];
}> = [
  // Example mappings — add your own:
  // {
  //   match: /garmin.*forerunner/i,
  //   reviews: ["https://www.dcrainmaker.com/2023/03/garmin-forerunner-965-review.html"],
  // },
];

function stripToText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/?[^>]+(>|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(req: Request) {
  const { url, name } = BodySchema.parse(await req.json());

  // 1) Fetch PDP (best effort)
  let pdpText = "";
  try {
    const pdpHtml = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
    }).then((r) => r.text());
    pdpText = stripToText(pdpHtml).slice(0, 12000);
  } catch {
    pdpText = "";
  }

  // 2) Pick deterministic review sources (v0)
  const joined = `${name ?? ""} ${url}`;
  const matched =
    ALLOWED_REVIEW_SOURCES.find((m) => m.match.test(joined))?.reviews ?? [];

  const reviewUrls = matched.filter((u) =>
    ALLOWED_REVIEW_DOMAINS.some((d) => u.includes(d))
  );

  const reviewTexts = await Promise.all(
    reviewUrls.map(async (u) => {
      try {
        const html = await fetch(u, {
          headers: { "User-Agent": "Mozilla/5.0" },
          cache: "no-store",
        }).then((r) => r.text());
        return stripToText(html).slice(0, 12000);
      } catch {
        return "";
      }
    })
  );

  // 3) LLM summary
  const result = await generateText({
    model: openai("gpt-4o-mini"),
    system: `
You summarize products for an ecommerce Buy-Now screen.

Use ONLY what is provided in PDP text and review excerpts.
If reviews are empty, say so and summarize PDP only.

Return JSON ONLY in this shape:
{
  "title": string,
  "summary": string,
  "pros": string[],
  "cons": string[],
  "sentiment": { "positive": number, "neutral": number, "negative": number },
  "sources": string[]
}
`,
    prompt: JSON.stringify({
      url,
      name,
      pdpText,
      reviews: reviewTexts.filter(Boolean),
      sources: reviewUrls,
    }),
  });

  let json: any;
  try {
    json = JSON.parse(result.text);
  } catch {
    json = {
      title: name ?? "Product highlights",
      summary: "We couldn’t generate highlights for this item yet.",
      pros: [],
      cons: [],
      sentiment: { positive: 0, neutral: 1, negative: 0 },
      sources: reviewUrls,
    };
  }

  return Response.json(json);
}