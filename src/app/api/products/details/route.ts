import { z } from "zod";

const BodySchema = z.object({
  url: z.string().url(),
});

function stripToText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/?[^>]+(>|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickMeta(html: string, name: string) {
  const m = html.match(
    new RegExp(`<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']+)["']`, "i")
  );
  return m?.[1];
}

export async function POST(req: Request) {
  const { url } = BodySchema.parse(await req.json());

  // ✅ v0: scrape PDP
  let title = "";
  let imageUrl = "";
  let price = "Varies";
  let variants: any[] = []; // [{ id, title, options, merchantUrl }]

  try {
    const html = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
    }).then(r => r.text());

    title =
      pickMeta(html, "og:title") ||
      pickMeta(html, "twitter:title") ||
      "";

    imageUrl =
      pickMeta(html, "og:image") ||
      pickMeta(html, "twitter:image") ||
      "";

    // naive price sniff (best effort)
    const text = stripToText(html);
    const priceMatch = text.match(/\$[\d,]+(?:\.\d{2})?/);
    if (priceMatch) price = priceMatch[0];

    /**
     * ✅ v1 TODO (Rye Catalog):
     * Call Rye external catalog endpoint here,
     * then set:
     *  - title, images, price
     *  - variants = [{ id, title, options:{size,color}, merchantUrl }]
     *
     * Keep the response shape the same.
     */
  } catch {
    // leave best-effort defaults
  }

  return Response.json({
    url,
    title: title || "Product",
    imageUrl: imageUrl || null,
    price,
    variants, // may be empty in v0
  });
}